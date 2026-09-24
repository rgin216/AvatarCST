import { generateAnthropicResponse } from './anthropicService.js';
import { isSupportedProvider } from './llmProviders.js';
import { getSessionLlm, paceSessionRequest } from './llmContext.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.4-mini';

const GROQ_TIMEOUT_MS = 10_000;
const OPENAI_TIMEOUT_MS = 15_000;

// The system prompt itself uses **bold** to emphasize instructions to the
// model, which the model can imitate in its own spoken output - strip markdown
// emphasis/code markers so TTS never reads "asterisk" aloud.
const stripMarkdownEmphasis = (text = '') =>
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]*)`/g, '$1');

const stripAssistantPrefix = (raw = '') =>
  stripMarkdownEmphasis(
    raw.trim().replace(/^(here['']?s my response[^:]*:|response:|aria says:?|as aria,?)\s*/i, '')
  );

const getGroqGenerationOptions = (model) =>
  /^openai\/gpt-oss-(?:20b|120b)$/.test(model)
    ? {
        reasoning_effort: 'low',
        include_reasoning: false,
      }
    : model === 'qwen/qwen3.8-27b'
    ? { reasoning_effort: 'none', reasoning_format: 'hidden' }
    : {};

const getResponsesInstructions = (messages = []) =>
  messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

const chatMessagesToResponsesInput = (messages = []) =>
  messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));

const extractResponsesText = (data = {}) => {
  if (typeof data.output_text === 'string') return data.output_text;

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.transcript || '')
    .filter(Boolean)
    .join('\n')
    .trim();
};

const generateGroqResponse = async (messages, options = {}) => {
  const model = options.model || GROQ_MODEL;
  const temperature = options.temperature ?? 0.7;
  // GPT-OSS shares its completion allowance between reasoning and visible text.
  const maxTokens = Math.max(options.maxTokens ?? 140, /^openai\/gpt-oss-/.test(model) ? 512 : 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        ...getGroqGenerationOptions(model),
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Groq request timed out after 10s');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const raw = choice?.message?.content?.trim() || '';
  if (choice?.finish_reason === 'length' || !raw) {
    console.warn(`[llm] Groq ${choice?.finish_reason || 'empty'} output at ${maxTokens} tokens; ${options.completionRetry ? 'using caller fallback' : 'retrying once'}.`);
    if (!options.completionRetry) return generateGroqResponse(messages, { ...options, maxTokens: Math.max(maxTokens, Math.min(maxTokens * 2, 8192)), completionRetry: true });
    throw new Error('Groq did not produce a complete response');
  }
  return options.json ? raw : stripAssistantPrefix(raw);
};

const generateOpenAIResponse = async (messages, options = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot generate OpenAI response');
  }

  const maxTokens = options.maxTokens ?? 140;
  const model = options.model || OPENAI_TEXT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: getResponsesInstructions(messages),
        input: chatMessagesToResponsesInput(messages),
        max_output_tokens: maxTokens,
        ...(options.textFormat || options.json ? { text: { format: options.textFormat || { type: 'json_object' } } } : {}),
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('OpenAI request timed out after 15s');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const raw = extractResponsesText(data);
  if (data.status === 'incomplete' || !raw.trim()) throw new Error('OpenAI did not produce a complete response');
  return options.json ? raw : stripAssistantPrefix(raw);
};

const generateProviderResponse = async (messages, options = {}) => {
  if (options.provider && !isSupportedProvider(options.provider)) {
    throw new Error(`Unsupported LLM provider: ${options.provider}`);
  }
  if (options.provider === 'openai') return generateOpenAIResponse(messages, options);
  if (options.provider === 'anthropic') {
    const raw = await generateAnthropicResponse(messages, options);
    return options.json ? raw : stripAssistantPrefix(raw);
  }
  return generateGroqResponse(messages, options);
};

export const generateResponse = async (messages, options = {}) => {
  const context = getSessionLlm();
  const effective = context ? { ...options, provider: context.facilitator.provider, model: context.facilitator.model } : options;
  await paceSessionRequest(context);
  const started = performance.now();
  const call = { provider: effective.provider || 'groq', model: effective.model, status: 'ok' };
  try {
    const output = await generateProviderResponse(messages, effective);
    call.output = output;
    return output;
  } catch (error) {
    call.status = 'error'; call.error = error.message;
    throw error;
  } finally {
    call.latencyMs = Math.round(performance.now() - started);
    context?.calls.push(call);
  }
};
