// Reads the opt-in `?stream=transcript` respond-audio response: newline-delimited
// JSON with the transcript first, then the full turn (or an in-band error).
const STREAM_CONTENT_TYPE = 'application/x-ndjson';

const parseLines = (text) => text.split('\n').filter((line) => line.trim()).map((line) => {
  try { return JSON.parse(line); } catch { return null; }
});

// The transcript from a partially received body, once its line is complete.
export function readStreamedTranscript(partialText) {
  const text = typeof partialText === 'string' ? partialText : '';
  const event = parseLines(text.slice(0, text.lastIndexOf('\n') + 1))
    .find((line) => line?.type === 'transcript');
  return typeof event?.transcript === 'string' ? event.transcript : null;
}

const getContentType = (headers) =>
  String(headers?.get?.('content-type') ?? headers?.['content-type'] ?? '');

// An axios transformResponse. Ordinary JSON (error statuses, or a backend that
// does not stream) is parsed as usual, so callers always receive the turn.
export function transformTranscriptStreamResponse(data, headers, status) {
  if (typeof data !== 'string') return data;
  if (!getContentType(headers).includes(STREAM_CONTENT_TYPE)) {
    try { return JSON.parse(data); } catch { return data; }
  }
  const events = parseLines(data);
  const turn = events.find((line) => line?.type === 'turn');
  if (turn) return turn.turn;
  const failure = events.find((line) => line?.type === 'error');
  throw Object.assign(new Error(failure?.error || 'The response ended before the reply arrived'), {
    config: this,
    response: { status: failure?.status || status },
  });
}
