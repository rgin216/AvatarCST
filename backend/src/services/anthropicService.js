const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 60_000;

// Direct Messages API adapter. No assistant prefill or sampling parameters:
// current Sonnet models reject these. Keep JSON untouched for evaluation.
export async function generateAnthropicResponse(messages, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('ANTHROPIC_API_KEY is not set');
  if (options.json && !options.jsonSchema) throw new Error('Anthropic JSON output requires jsonSchema');
  const conversation = messages.filter(m => m.role !== 'system');
  if (!conversation.length || conversation.at(-1).role !== 'user' ||
      conversation.some(m => !['user', 'assistant'].includes(m.role))) {
    throw new Error('Anthropic requires user/assistant messages ending with a user message');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST', signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || process.env.ANTHROPIC_TEXT_MODEL || 'claude-sonnet-5',
        max_tokens: options.maxTokens ?? 256,
        system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'),
        messages: conversation,
        thinking: { type: 'disabled' },
        ...(options.json ? { output_config: { format: { type: 'json_schema', schema: options.jsonSchema } } } : {}),
      }),
    });
    // Include body consumption in the timeout, not just receipt of headers.
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error(response.ok ? 'Anthropic returned invalid JSON' : `Anthropic HTTP ${response.status}`);
    }
    if (!response.ok) {
      // Do not persist provider messages that might echo input or account details.
      throw new Error(`Anthropic HTTP ${response.status}`);
    }
    if (data.stop_reason !== 'end_turn') {
      throw new Error(`Anthropic did not complete response (${data.stop_reason || 'unknown'})`);
    }
    const text = (data.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');
    if (!text.trim()) throw new Error('Anthropic returned empty text');
    return text;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Anthropic request timed out after 60s');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
