export const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);

export async function timeAsync(label, fn, timings, now = nowMs) {
  const start = now();
  try { return await fn(); }
  finally { timings[label] = (timings[label] || 0) + now() - start; }
}
