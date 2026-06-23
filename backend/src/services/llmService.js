const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5.4-mini';

const GROQ_TIMEOUT_MS = 10_000;
const OPENAI_TIMEOUT_MS = 15_000;

const stripAssistantPrefix = (raw = '') =>
  raw.trim().replace(/^(here['']?s my response[^:]*:|response:|aria says:?|as aria,?)\s*/i, '');

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
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 140;
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
        model: GROQ_MODEL,
        messages,
        temperature,
        max_tokens: maxTokens,
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
  const raw = data.choices[0]?.message?.content?.trim() || '';
  return stripAssistantPrefix(raw);
};

const generateOpenAIResponse = async (messages, options = {}) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set - cannot generate OpenAI response');
  }

  const maxTokens = options.maxTokens ?? 140;
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
        model: OPENAI_TEXT_MODEL,
        instructions: getResponsesInstructions(messages),
        input: chatMessagesToResponsesInput(messages),
        max_output_tokens: maxTokens,
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
  return stripAssistantPrefix(extractResponsesText(data));
};

export const generateResponse = async (messages, options = {}) => {
  if (options.provider === 'openai') return generateOpenAIResponse(messages, options);
  return generateGroqResponse(messages, options);
};
