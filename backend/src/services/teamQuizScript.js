import { teamQuizQuestions, teamQuizScoreReply } from './teamQuizService.js';

/**
 * Build Session 15 with shared opening and closing activities, quiz rounds, and feedback.
 * Cloning preserves live getters and remaps navigation to this session's step IDs.
 * @param {object[]} numberGames Session 13 steps supplying the standard opening.
 * @param {object[]} facesScenes Session 7 steps supplying the wheel, recap, and closing.
 * @returns {object[]} Ordered Team Quiz session steps.
 */
export function createTeamQuizScript(numberGames, facesScenes) {
  const clone = (source, overrides = {}) => {
    const step = Object.defineProperties({}, Object.getOwnPropertyDescriptors(source));
    const rename = id => id.replace(/^(number_games|faces_scenes)_/, 'team_quiz_');
    step.id = rename(step.id);
    if (step.nextStepId) step.nextStepId = rename(step.nextStepId);
    if (step.seasonBranches) step.seasonBranches = Object.fromEntries(Object.entries(step.seasonBranches).map(([season, id]) => [season, rename(id)]));
    Object.assign(step, overrides);
    step.visualHint = `Source deck: NZ15. Team Quiz, slide ${step.deckSlide}`;
    return step;
  };
  const opening = numberGames.slice(0, numberGames.findIndex(s => s.id === 'number_games_theme_intro') + 1).map(s => clone(s));
  Object.assign(opening[0], { subtitle: 'Session 15: Team Quiz', bullets: ['Session 15', 'Team Quiz'], reply: ({ name }) => `Welcome back, ${name}. Today is Session 15: Team Quiz. We will try some questions together and celebrate your efforts.` });
  Object.assign(opening.at(-1), { title: 'Team Quiz', subtitle: 'Four friendly quiz rounds', prompt: 'Team Quiz', bullets: ['General knowledge', 'New Zealand', 'Music and entertainment', 'Sport and everyday life'], reply: () => 'Let us enjoy a Team Quiz together, one question at a time. Some have choices; for others, say or type your answer. You can always pass or say you are unsure. I will add up your score at the end. Take your time and have a go!' });
  const activity = (suffix, deckSlide, title, prompt, extra = {}) => ({ id: `team_quiz_${suffix}`, deckSlide, title, subtitle: 'Team Quiz', prompt, bullets: [], turns: 1, acceptAnyAnswer: true, accent: '#4472C4', reply: () => prompt, ...extra });
  const closingSource = suffix => facesScenes.find(s => s.id === `faces_scenes_${suffix}`);
  return [
    ...opening,
    ...teamQuizQuestions.map((q, i) => activity(`question_${i + 1}`, q.deckSlide, q.category, q.question, {
      acceptAnyAnswer: false,
      trivia: { answer: q.answer, aliases: q.aliases, choices: q.options },
      interaction: { type: q.options ? 'choiceQuestion' : 'focusedQuestion', question: q.question, progress: `Question ${i + 1} of 20`, ...(q.options ? { options: q.options, answerLabel: 'Choose an answer', answerHint: 'You can also say or type the letter or answer.' } : {}) },
      inactivityTimeoutMs: 180000,
      reply: () => `${i === 0 ? `Our first round is ${q.category}. ` : i % 5 === 0 ? `Our next round is ${q.category}. ` : ''}${q.question}${q.options ? ` ${q.options.map((option, index) => `${'ABCD'[index]}, ${option}`).join('; ')}. Choose an answer and press Confirm answer, or say or type it.` : ''} It is fine to be unsure.`,
    })),
    activity('score', 23, 'Your quiz score', 'Let us celebrate your quiz!', { interaction: { type: 'autoAdvance' }, recordAnswer: false, reply: ({ sessionAnswers = [] }) => teamQuizScoreReply(sessionAnswers) }),
    clone(closingSource('spin_question'), { deckSlide: 24 }),
    clone(closingSource('summary_song'), { deckSlide: 25, followUps: [() => 'We explored general knowledge, New Zealand, music, and everyday life together. Thank you for giving the questions a go! What was one part you enjoyed?'] }),
    ...[
      'How have our sessions made you feel?',
      'What surprised you about our sessions together?',
      'What has been helpful to you?',
      'Have you or your family noticed anything different over these past weeks? It is fine if nothing comes to mind.',
      'Do you have any recommendations for our sessions in the future?',
    ].map((question, index) => activity(index === 0 ? 'feedback' : `feedback_${index + 1}`, 27, 'Your feedback', question, {
      interaction: { type: 'focusedQuestion', question, progress: `Feedback ${index + 1} of 5 — you can always pass` },
      ...(index === 0 ? { reply: () => `You have now completed 15 sessions with me, your avatar companion, and you have done wonderfully. Thank you for all the time, effort, and thoughts you have shared. Before we say goodbye, I would love to hear about your experience. ${question}` } : {}),
    })),
    clone(closingSource('closing'), { deckSlide: 26, subtitle: 'Thank you for joining in', bullets: ['Well done', 'Thank you', 'Ka kite anō'], reply: ({ name }) => `Thank you for joining me, ${name}, and for sharing your thoughts throughout our sessions. You have done wonderfully, and it has been lovely spending this time together. Ka kite anō. Take good care.` }),
  ];
}
