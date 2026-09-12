export function parseMatchingAnswer(step, content = '') {
  if (!content.startsWith('[[matching:')) return null;
  const fail = () => { const error = new Error('Invalid matching answer for this activity'); error.status = 400; throw error; };
  if (step?.interaction?.type !== 'matching' || !content.endsWith(']]')) return fail();
  let matches;
  try { matches = JSON.parse(content.slice(11, -2)); } catch { return fail(); }
  if (!matches || Array.isArray(matches) || typeof matches !== 'object') return fail();
  const { left, right } = step.interaction;
  if (Object.entries(matches).some(([source, target]) => !left.some((item) => item.id === source) || !right.some((item) => item.id === target))) return fail();
  if (new Set(Object.values(matches)).size !== Object.values(matches).length) return fail();
  const results = left.map((item) => ({
    clue: item.label,
    chosen: right.find((option) => option.id === matches[item.id])?.label || null,
    answer: right.find((option) => option.id === item.answerId).label,
    correct: matches[item.id] === item.answerId,
  }));
  const correctCount = results.filter((item) => item.correct).length;
  const corrections = results.filter((item) => !item.correct).map((item) => item.chosen
    ? `For "${item.clue}", you chose ${item.chosen}. The correct match is ${item.answer}.`
    : `For "${item.clue}", the missing match is ${item.answer}.`);
  return {
    results,
    transcript: `My matches: ${results.map((item) => `${item.clue} — ${item.chosen || 'not matched'}`).join('; ')}.`,
    response: correctCount === left.length
      ? `You matched all ${left.length} correctly. Well done.`
      : `${correctCount ? `You matched ${correctCount} correctly. ` : 'Thank you for giving it a go. '}${corrections.join(' ')}`,
  };
}
