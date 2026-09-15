// Keep each reply in one synthesis request: separate requests can reset delivery
// even with identical voice settings. Paragraph punctuation supplies the pause.
export function continuousSpeechSegments(turn) {
  const segments = turn.speechSegments?.length ? turn.speechSegments : [{ text: turn.assistantText, role: 'script' }];
  return [{
    text: segments.map(segment => segment.text.trim().replace(/([^.!?])$/, '$1.')).join('\n\n'),
    role: 'script',
    advanceSlideAfter: segments.some(segment => segment.advanceSlideAfter),
  }];
}
