export function validateDeploymentPlan({ apiUrl, sessionId, inputs, repeats = 1, timeoutMs = 120000, delayMs = 1000 }) {
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) API base URL without credentials, query or fragment');
  if (!/^[a-f\d]{24}$/iu.test(sessionId || '')) throw new Error('A dedicated test session ObjectId is required');
  if (!Array.isArray(inputs) || !inputs.length || inputs.some(input => typeof input !== 'string' || !input.trim())) throw new Error('Inputs must be a nonempty JSON array of synthetic response strings');
  for (const [name, value, min, max] of [['repeats', repeats, 1, 1000], ['timeoutMs', timeoutMs, 1000, 300000], ['delayMs', delayMs, 0, 60000]]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}–${max}`);
  }
}

export async function runDeployedLatency({ apiUrl, sessionId, inputs, repeats = 1, timeoutMs = 120000, delayMs = 1000,
  avatarMode = 'visualizer', lipSyncMode = 'energy', fetchImpl = fetch, now = () => performance.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), onRow = async () => {} }) {
  validateDeploymentPlan({ apiUrl, sessionId, inputs, repeats, timeoutMs, delayMs });
  if (!['male', 'female', 'visualizer'].includes(avatarMode) || !['energy', 'rhubarb'].includes(lipSyncMode)) throw new Error('Invalid avatar/lip-sync mode');
  const rows = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const [inputIndex, content] of inputs.entries()) {
      if (rows.length && delayMs) await sleep(delayMs);
      const row = { sequence: rows.length, repeat, inputIndex, sessionId, avatarMode, lipSyncMode,
        startedAt: new Date().toISOString(), status: 'ok' };
      const start = now();
      let turn;
      try {
        const response = await fetchImpl(`${apiUrl.replace(/\/$/u, '')}/sessions/${sessionId}/respond`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, avatarMode, lipSyncMode }), signal: AbortSignal.timeout(timeoutMs),
        });
        row.httpStatus = response.status;
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        turn = await response.json();
        if (typeof turn.assistantText !== 'string' || !turn.assistantText.trim()) throw new Error('Invalid turn response');
        row.serverTimings = turn.timings || null; row.turnId = turn.turnId || null; row.pipelineMode = turn.pipelineMode || null;
        row.audioSegments = Array.isArray(turn.avatar?.audio?.segments) ? turn.avatar.audio.segments.filter(s => s.url).length : turn.avatar?.audio?.url ? 1 : 0;
        row.audioStatus = turn.audioStatus || (row.audioSegments ? 'available' : 'missing');
      } catch (error) { row.status = 'error'; row.error = error.message; }
      finally { row.requestMs = now() - start; }
      rows.push(row); await onRow(row);
      // A timed-out write may still be executing. Never send the next turn after an error.
      if (row.status === 'error' || turn?.sessionCompleteAfterResponse) return rows;
    }
  }
  return rows;
}
