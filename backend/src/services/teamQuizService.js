/** Normalize answer text and aliases for case-, accent-, and punctuation-insensitive matching. */
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Source: NZ15 Team Quiz, slides 16–23. Options support less familiar facts;
// everyday recall stays open, with alternate names and spoken-number aliases.
export const teamQuizQuestions = [
  ['General Knowledge', 'Which country is known as the Land of the Rising Sun?', 'Japan', [], ['Japan', 'China', 'Thailand']],
  ['General Knowledge', 'What is the capital city of Australia?', 'Canberra', ['canbera'], ['Sydney', 'Canberra', 'Melbourne']],
  ['General Knowledge', 'How many sides does an octagon have?', 'Eight', ['8'], ['Six', 'Eight', 'Ten']],
  ['General Knowledge', 'Which bird is often associated with delivering babies in stories?', 'Stork', ['a stork', 'storks']],
  ['General Knowledge', 'What is the largest ocean in the world?', 'Pacific Ocean', ['pacific'], ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean']],
  ['New Zealand', 'What is New Zealand’s highest mountain?', 'Aoraki / Mount Cook', ['aoraki', 'mount cook', 'mt cook', 'cook']],
  ['New Zealand', 'What is the name of the strait between the North and South Islands?', 'Cook Strait', ['cook', 'cook straight'], ['Cook Strait', 'Foveaux Strait', 'Tasman Sea']],
  ['New Zealand', 'Which city is known as the Garden City?', 'Christchurch', ['christ church'], ['Auckland', 'Christchurch', 'Dunedin']],
  ['New Zealand', 'What is the name of New Zealand’s national airline?', 'Air New Zealand', ['air nz', 'air new zealand', 'air newzealand']],
  ['New Zealand', 'Which New Zealand city is famous for its cable car?', 'Wellington', ['welly'], ['Wellington', 'Hamilton', 'Nelson']],
  ['Music & Entertainment', 'Which group sang “Mamma Mia” and “Dancing Queen”?', 'ABBA', ['abba', 'a b b a']],
  ['Music & Entertainment', 'Which singer was known as the King of Rock and Roll?', 'Elvis Presley', ['elvis', 'presley']],
  ['Music & Entertainment', 'What was the surname of the singing brothers Barry, Robin and Maurice?', 'Gibb', ['gibbs', 'bee gees', 'the bee gees'], ['Gibb', 'Jackson', 'Wilson']],
  ['Music & Entertainment', 'In Batman stories, who was one of Batman’s sidekicks?', 'Robin', ['nightwing', 'night wing', 'dick grayson', 'batgirl']],
  ['Music & Entertainment', 'Which famous band included John Lennon and George Harrison?', 'The Beatles', ['beatles', 'beetles']],
  ['Sport & Everyday Life', 'In golf, what is the name for one stroke under par?', 'Birdie', ['birdy'], ['Eagle', 'Bogey', 'Birdie']],
  ['Sport & Everyday Life', 'How many players are there in a netball team on court?', 'Seven', ['7'], ['Five', 'Seven', 'Nine']],
  ['Sport & Everyday Life', 'What household appliance is used to keep food frozen?', 'Freezer', ['deep freeze', 'deep freezer', 'fridge freezer']],
  ['Sport & Everyday Life', 'Which precious metal is commonly used to make wedding rings?', 'Gold', ['yellow gold', 'white gold', 'rose gold', 'platinum', 'silver']],
  ['Sport & Everyday Life', 'What do you call a young horse?', 'Foal', ['colt', 'filly', 'baby horse']],
].map(([category, question, answer, aliases, options], index) => ({
  id: `team_quiz_question_${index + 1}`, category, question, answer,
  aliases: [answer, ...aliases], options, deckSlide: 16 + Math.floor(index / 5),
}));

/** Return separately affirmed clauses while keeping negated lists together. */
const affirmedAnswerClauses = (content) => String(content)
  .split(/[,;.!?\n]+(?!\s*(?:and|or)\b)|\b(?:but|rather|instead)\b/i)
  .map(normalize)
  .filter(text => !/\b(?:not|no|never|isnt|isn t|dont|don t)\b/.test(text));

/**
 * Check a typed or spoken answer, expanding option letters and accepting bounded aliases.
 * Uncertainty and negated clauses do not earn credit; affirmed alternatives can.
 * @param {object} question Quiz question with aliases and optional answer choices.
 * @param {string} content Participant's answer.
 * @returns {boolean} Whether the answer earns credit.
 */
export function matchesTeamQuizAnswer(question, content) {
  const text = normalize(content);
  if (/\b(?:don t know|dont know|not sure|unsure|can t remember|cannot remember|no idea)\b/.test(text)) return false;
  return affirmedAnswerClauses(content).some(clause => {
    let text = clause;
    const selection = text.match(/^(?:(?:i think|i choose|i pick|i will go with|i ll go with|it is|it s|the answer is)\s+)?(?:(?:option|letter|answer)\s+)?([abc]|ay|bee|be|see|sea)(?:\s+please)?$/);
    if (selection && question.options) {
      const letters = { ay: 'a', bee: 'b', be: 'b', see: 'c', sea: 'c' };
      text = normalize(question.options[(letters[selection[1]] || selection[1]).charCodeAt(0) - 97]);
    }
    // Word boundaries accept conversational phrasing without accepting substrings.
    return question.aliases.some(alias => (` ${text} `).includes(` ${normalize(alias)} `));
  });
}

/**
 * Count each quiz question once, preferring its recorded outcome over re-evaluation.
 * @param {object[]} [answers=[]] Session answers, including any recorded quiz outcomes.
 * @returns {{correct: number, total: number, attempted: number}} Quiz score and attempt count.
 */
export function tallyTeamQuiz(answers = []) {
  const recorded = new Map();
  for (const entry of answers) if (!recorded.has(entry.stepId)) recorded.set(entry.stepId, entry);
  const attempted = teamQuizQuestions.filter(q => recorded.has(q.id));
  const correct = attempted.filter(q => (recorded.get(q.id).quizOutcome ? recorded.get(q.id).quizOutcome === 'correct' : matchesTeamQuizAnswer(q, recorded.get(q.id).answer))).length;
  return { correct, total: teamQuizQuestions.length, attempted: attempted.length };
}

/**
 * Announce the quiz total with encouragement appropriate to every score.
 * @param {object[]} [answers=[]] Recorded session answers.
 * @returns {string} Score announcement and encouragement.
 */
export function teamQuizScoreReply(answers = []) {
  const { correct, total } = tallyTeamQuiz(answers);
  const cheer = correct >= 16 ? 'Wonderful work! You recalled so much today.' : correct >= 8
    ? 'Well done! You made some lovely connections today.'
    : 'Thank you for giving it a go! Every question was a chance to discover something together, and your effort is worth celebrating.';
  return `You got ${correct} out of ${total} in our Team Quiz. ${cheer}`;
}


// Acknowledge accepted alternatives explicitly instead of substituting the deck's
// example answer (for instance, saying "Gold" after accepting "Platinum").
const alternativeFeedback = {
  team_quiz_question_14: [
    [['nightwing', 'night wing'], 'Nightwing is a good answer; he began as Robin.'],
    [['dick grayson'], 'Dick Grayson is a good answer; he was Robin and later Nightwing.'],
    [['batgirl'], 'Batgirl is also a good answer here.'],
  ],
  team_quiz_question_19: [
    [['platinum'], 'Platinum is also used for wedding rings.'],
    [['silver'], 'Silver is also used for wedding rings.'],
    [['white gold'], 'White gold is a good answer for wedding rings.'],
    [['rose gold'], 'Rose gold is a good answer for wedding rings.'],
  ],
  team_quiz_question_20: [
    [['colt'], 'A colt is a young male horse.'],
    [['filly'], 'A filly is a young female horse.'],
  ],
};

/**
 * Classify one quiz answer and provide varied feedback naming accepted alternatives.
 * @param {object} question Question from the Team Quiz question bank.
 * @param {string} content Participant's typed or spoken answer.
 * @returns {{answered: boolean, outcome: string, response: string}|null} Feedback, or null for missing input.
 */
export function evaluateTeamQuizAnswer(question, content) {
  if (!question || !content) return null;
  const text = normalize(content);
  const unsure = /\b(?:don t know|dont know|not sure|unsure|can t remember|cannot remember|no idea)\b/.test(text)
    || /^(?:i (?:would|d) like to pass|pass|pass please|pass this (?:one|question)|skip|skip this one)$/.test(text);
  const correct = !unsure && matchesTeamQuizAnswer(question, content);
  const index = teamQuizQuestions.indexOf(question);
  const answer = question.answer;
  const detail = alternativeFeedback[question.id]?.find(([aliases]) =>
    aliases.some(alias => affirmedAnswerClauses(content).some(clause =>
      (` ${clause} `).includes(` ${normalize(alias)} `))))?.[1] || `${answer}.`;
  const praise = ['Well done!', 'You have got it!', 'Lovely work!', 'Exactly!', 'That is a good answer!', 'Nicely recalled!'];
  const incorrect = [
    `Good effort. This one is ${answer}.`,
    `Thanks for trying. The answer here is ${answer}.`,
    `This time it is ${answer}. Let us keep exploring together.`,
    `A tricky one! The answer is ${answer}.`,
    `I am glad you had a guess. This one is ${answer}.`,
    `The answer is ${answer}. Every question is another chance to discover something.`,
  ];
  const uncertainty = [
    `No problem at all. This one is ${answer}.`,
    `We can discover it together: ${answer}.`,
    `That is all right. The answer is ${answer}.`,
    `It is fine to pass. This one is ${answer}.`,
    `No need to worry. The answer here is ${answer}.`,
    `Let me share this one with you: ${answer}.`,
  ];
  return {
    answered: true,
    outcome: unsure ? 'unsure' : correct ? 'correct' : 'incorrect',
    response: unsure ? uncertainty[index % uncertainty.length]
      : correct ? `${praise[index % praise.length]} ${detail}`
      : incorrect[index % incorrect.length],
  };
}
