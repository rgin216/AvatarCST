// Evaluation-only pacing: never adds artificial delays to participant sessions.
export function createPacedGenerator(generate, { intervalMs = 61000, maxRetries = 2,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onWait = () => {} } = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 300000) throw new Error('delay-ms must be 0–300000');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) throw new Error('quota-retries must be 0–5');
  const due = new Map();
  const events = [];
  const keyOf = options => `${options.provider}:${options.model}`;
  async function wait(ms, event) {
    if (ms <= 0) return;
    onWait({ ...event, waitMs: ms });
    await sleep(ms);
  }
  const paced = async (messages, options) => {
    const key = keyOf(options);
    for (let attempt = 0; ; attempt++) {
      due.set(key, now() + intervalMs);
      try { return await generate(messages, options); }
      catch (error) {
        if (!/error 429\b/i.test(error.message)) throw error;
        const seconds = /try again in ([\d.]+)s/i.exec(error.message);
        const waitMs = Math.max(intervalMs, seconds ? Math.ceil(Number(seconds[1]) * 1000) + 1000 : 61000);
        events.push({ model: key, attempt: attempt + 1, error: error.message, retry: attempt < maxRetries, waitMs });
        if (attempt >= maxRetries) throw error;
        await wait(waitMs, { model: key, reason: 'quota retry', attempt: attempt + 1 });
      }
    }
  };
  paced.beforeCall = options => wait(Math.max(0, (due.get(keyOf(options)) || 0) - now()), { model: keyOf(options), reason: 'request pacing' });
  paced.events = events;
  return paced;
}
