const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const GROQ_TIMEOUT_MS = 10_000;

export const generateResponse = async (messages) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 140,
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
  // Strip meta-labels smaller models sometimes prepend despite instructions
  return raw.replace(/^(here['']?s my response[^:]*:|response:|aria says:?|as aria,?)\s*/i, '');
};
