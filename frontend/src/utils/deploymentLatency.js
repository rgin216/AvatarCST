// Opt-in, in-memory records. No transcripts, audio, or participant names are saved.
export function createLatencyCapture({ now = () => performance.now(), id = () => crypto.randomUUID() } = {}) {
  let enabled = false;
  let rows = [];
  let current = null;
  let recordingStop = null;
  const elapsed = start => start == null ? null : now() - start;
  return {
    enable(value) { enabled = value; if (!value) { current = null; recordingStop = null; } },
    clear() { rows = []; current = null; recordingStop = null; },
    recordingStopped() { if (enabled) recordingStop = now(); },
    begin({ sessionId, inputMode, avatarMode, lipSyncMode }) {
      if (!enabled) return null;
      if (current && current.playbackStatus === 'pending') current.playbackStatus = 'superseded';
      const row = { id: id(), sessionId, inputMode, avatarMode, lipSyncMode, startedAt: new Date().toISOString(),
        requestStart: now(), stopStart: inputMode === 'audio' ? recordingStop : null,
        status: 'pending', playbackStatus: 'pending', requestMs: null, responseToPlayingMs: null,
        requestToPlayingMs: null, stopToPlayingMs: null };
      recordingStop = null; rows.push(row); current = row; return row;
    },
    response(row, turn) {
      if (!row) return;
      row.requestMs = elapsed(row.requestStart); row.responseStart = now(); row.status = 'ok';
      row.turnId = turn.turnId || null; row.serverTimings = turn.timings || null;
      row.pipelineMode = turn.pipelineMode || null;
      const segments = turn.avatar?.audio?.segments;
      row.audioSegments = Array.isArray(segments) ? segments.filter(s => s.url).length : turn.avatar?.audio?.url ? 1 : 0;
      row.audioStatus = turn.audioStatus || (row.audioSegments ? 'available' : 'missing');
      if (!row.audioSegments) row.playbackStatus = 'missing_audio';
    },
    failed(row, status) { if (row) { row.requestMs = elapsed(row.requestStart); row.status = 'error'; row.httpStatus = status || null; row.playbackStatus = 'request_failed'; } },
    playing() {
      if (!current || current.status !== 'ok' || current.requestToPlayingMs !== null || !current.audioSegments) return;
      current.responseToPlayingMs = elapsed(current.responseStart);
      current.requestToPlayingMs = elapsed(current.requestStart);
      current.stopToPlayingMs = elapsed(current.stopStart);
      current.playbackStatus = 'playing';
    },
    blocked() { if (current?.playbackStatus === 'pending') { current.playbackStatus = 'autoplay_blocked'; current.autoplayBlocked = true; } },
    unavailable() { if (current) current.playbackStatus = 'audio_error'; },
    finished() { if (current?.playbackStatus === 'playing') current.playbackStatus = 'completed'; current = null; },
    snapshot() { return rows.map(row => Object.fromEntries(Object.entries(row)
      .filter(([key]) => !['requestStart', 'responseStart', 'stopStart'].includes(key)))); },
  };
}

export const deploymentLatency = createLatencyCapture();

export function latencyCsv(rows) {
  const columns = ['id', 'turnId', 'sessionId', 'startedAt', 'inputMode', 'avatarMode', 'lipSyncMode', 'pipelineMode',
    'status', 'httpStatus', 'audioStatus', 'audioSegments', 'playbackStatus', 'autoplayBlocked', 'requestMs', 'responseToPlayingMs',
    'requestToPlayingMs', 'stopToPlayingMs', 'sttMs', 'orchestratorMs', 'ttsMs', 'rhubarbMs', 'totalMs'];
  const cell = value => {
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && /^\s*[=+@-]/u.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [columns, ...rows.map(row => columns.map(key => row[key] ?? row.serverTimings?.[key]))]
    .map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
