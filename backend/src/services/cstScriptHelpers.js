export const adaptiveConversation = (guidance) => ({
  enabled: true,
  guidance,
});

export const adaptiveReminiscence = adaptiveConversation;

export const seatedExerciseInteraction = {
  type: 'youtubeShort',
  videoId: 'ICDSAV31w1U',
  videoUrl: 'https://www.youtube.com/watch?v=ICDSAV31w1U',
  // Regular landscape upload, not a vertical Short - tells the frontend to size
  // the embedded player as 16:9 instead of the Shorts-style 9:16 frame.
  orientation: 'landscape',
  aspectRatio: '16 / 9',
  completionPrompt: 'When you are finished, press Done, or say or type "done" to continue.',
};

export const spotifySongInteraction = ({ summarizeOnComplete = false } = {}) => ({
  type: 'spotifySong',
  playbackSeconds: 60,
  ...(summarizeOnComplete ? { summarizeOnComplete: true } : {}),
});

export const getCurrentNzYear = () => new Intl.DateTimeFormat('en-NZ', {
  year: 'numeric',
  timeZone: 'Pacific/Auckland',
}).format(new Date());

// Context-aware reveal line for an orientation answer (year/season), acknowledging
// whether the patient's prior answer was correct, a reasonable miss, or "not sure".
export const orientationRevealReply = ({ answer, detail, context = {} }) => {
  const normalizedAnswer = String(answer).toLowerCase();
  const suppliedAnswer = String(context.orientationAnswer || '').toLowerCase();

  if (context.orientationOutcome === 'correct') {
    return `Yes, ${answer} is right. ${detail}`;
  }
  if (
    context.orientationOutcome === 'incorrect' &&
    normalizedAnswer === 'spring' &&
    /\bwinter\b/.test(suppliedAnswer)
  ) {
    return `Winter was an understandable answer because the seasons have only just changed. It is spring now. ${detail}`;
  }
  if (context.orientationOutcome === 'incorrect') {
    return `That was a reasonable try. It is ${answer}. ${detail}`;
  }
  if (context.orientationOutcome === 'unsure') {
    return `No problem. It is ${answer}. ${detail}`;
  }

  return `It is ${answer}. ${detail}`;
};
