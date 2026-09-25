import { buildStandardSessionOpening } from './cstSessionOpening.js';
import { adaptiveConversation } from './cstScriptHelpers.js';

const DECK_LABEL = 'NZ13. Number Games';
const ACCENTS = ['#00AEEF', '#F47C20', '#A8C5A0', '#4472C4', '#F4C8B0', '#7A9DAD'];
const visualHint = (deckSlide) => `Source deck: ${DECK_LABEL}, slide ${deckSlide}`;

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
};

// Every number mentioned in a guess, in order: digits ("17") and spoken words,
// including compounds like "twenty one".
export const guessedNumbers = (text = '') => {
  const words = String(text).toLowerCase().replace(/-/g, ' ').match(/\d+|[a-z]+/g) || [];
  const numbers = [];
  for (let i = 0; i < words.length; i += 1) {
    if (/^\d+$/.test(words[i])) {
      numbers.push(Number(words[i]));
      continue;
    }
    const value = NUMBER_WORDS[words[i]];
    if (value === undefined) continue;
    const next = NUMBER_WORDS[words[i + 1]];
    if (value >= 20 && next !== undefined && next < 10) {
      numbers.push(value + next);
      i += 1;
    } else {
      numbers.push(value);
    }
  }
  return numbers;
};

// Spoken on the circled-answer slide, straight after the guess. A hedged guess
// ("six or seven") counts as right if either number is.
export const jarRevealReply = ({ answer, noun, hiddenNote = '', previousAnswer = '' }) => {
  const guesses = guessedNumbers(previousAnswer);
  const reveal = `There are ${answer} ${noun} in the jar.`;
  if (guesses.includes(answer)) return `You got it! ${reveal}`;
  const closest = guesses.sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer))[0];
  if (closest !== undefined && Math.abs(closest - answer) === 1) {
    return `So close! ${reveal} Just one ${closest < answer ? 'more' : 'fewer'} than your guess.`;
  }
  const lead = closest === undefined ? reveal : `Thanks for having a guess. ${reveal}`;
  return hiddenNote ? `${lead} ${hiddenNote}` : lead;
};

const FILL_IN_LABELS = ['tyres on a car', 'wheels on a tricycle', 'the unlucky number', 'players in a rugby team'];
const FILL_IN_QUESTIONS = [
  'How many tyres are on a car?',
  'How many wheels are on a tricycle?',
  'Which number is unlucky?',
  'How many players are in a rugby team?',
];

const cloneStep = (source, suffix, deckSlide, overrides = {}) => {
  const step = Object.defineProperties({}, Object.getOwnPropertyDescriptors(source));
  return Object.assign(step, {
    id: `number_games_${suffix}`,
    deckSlide,
    visualHint: visualHint(deckSlide),
    ...overrides,
  });
};

const step = (suffix, deckSlide, fields) => ({
  id: `number_games_${suffix}`,
  turns: 1,
  deckSlide,
  bullets: [],
  visualHint: visualHint(deckSlide),
  accent: ACCENTS[deckSlide % ACCENTS.length],
  ...fields,
});

// One question per card with a spoken or typed answer, like Session 11's
// focused questions. The card replaces the slide image, which prints answers.
const focusedTrivia = (suffix, question, progress, trivia, reply) => step(`calendar_${suffix}`, 16, {
  title: 'What Number Goes With…',
  subtitle: 'Special days of the year',
  prompt: question,
  interaction: { type: 'focusedQuestion', question, progress },
  inactivityTimeoutMs: 120000,
  trivia,
  reply: () => reply,
});

// A personal question that follows a trivia run. It is its own step because a
// trivia step judges every answer given on it against the trivia answer.
const memoryQuestion = (suffix, deckSlide, title, question, reply) => step(`${suffix}_memory`, deckSlide, {
  title,
  subtitle: 'Your memories',
  prompt: question,
  acceptAnyAnswer: true,
  interaction: { type: 'focusedQuestion', question, progress: 'Your memories' },
  inactivityTimeoutMs: 120000,
  reply: () => reply,
});

const jarGuess = (suffix, deckSlide, prompt, reply) => step(`guess_${suffix}`, deckSlide, {
  title: 'Guess How Many?',
  subtitle: 'Just a guess',
  prompt,
  acceptAnyAnswer: true,
  reply: () => reply,
});

const jarReveal = (suffix, deckSlide, answer, noun, hiddenNote = '') => step(`guess_${suffix}_reveal`, deckSlide, {
  title: `${answer} ${noun}`,
  subtitle: 'The answer',
  prompt: 'Let us see the answer',
  interaction: { type: 'autoAdvance' },
  isAnswerReveal: true,
  recordAnswer: false,
  reply: ({ previousAnswer = '' } = {}) => jarRevealReply({ answer, noun, hiddenNote, previousAnswer }),
});

export function createNumberGamesScript(shared) {
  const find = (id) => shared.find((candidate) => candidate.id === id);

  return [
    ...buildStandardSessionOpening({
      prefix: 'number_games',
      deckLabel: DECK_LABEL,
      welcome: {
        title: 'AI-supported Individual Cognitive Stimulation Therapy',
        sessionNumber: 13,
        sessionTitle: 'Number Games',
        reply: ({ name }) =>
          `Welcome back, ${name}. It is lovely to see you again. Today is our thirteenth session, and our theme will be Number Games. When you are ready, say "I'm ready" to begin.`,
      },
      themeSong: {
        title: 'Theme Song',
        subtitle: 'Our song from an earlier session',
        bullets: ['Theme song', 'Listen together'],
        reply: ({ themeSong }) =>
          themeSong?.status === 'available'
            ? `Let us begin with the theme song you chose earlier, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to 30 seconds. When you have finished listening, press Done, or say or type done.`
            : 'I could not find a saved theme song from an earlier session. Press Done, or say or type done, when you are ready to continue.',
      },
      // The deck has no dedicated theme-song slide, and it has its own "2026"
      // year-reveal slide, so the opening spans slides 1-15.
      checkIn: { shareThemeSongSlide: true },
      includeYearReveal: true,
      currentAffairsSlide: {
        subtitle: 'A positive story',
        reply: ({ currentAffairs }) =>
          currentAffairs?.status === 'available'
            ? `Here is a positive story from New Zealand: ${currentAffairs.article.title}. You can ask me to tell you more, or tell me what you think about it.`
            : 'I could not find a new positive New Zealand story just now. Have you heard anything pleasant or interesting lately?',
      },
      exercise: {
        reply: () =>
          'Next is a short seated exercise to get the blood flowing. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
      },
      themeIntro: {
        sessionTitle: 'Number Games',
        bullets: ['Numbers we know', 'Lucky numbers', 'Guess how many'],
        reply: () =>
          'Our theme today is Number Games. We will look at some numbers we all know from everyday life, chat about lucky numbers, and finish with a guessing game. There are no sums involved.',
      },
    }),
    focusedTrivia(
      'valentines',
      "What number goes with Valentine's Day?",
      '1 of 3',
      {
        answer: 'the 14th of February',
        aliases: ['14', '14th', 'fourteen', 'fourteenth'],
        responses: {
          correct: 'Yes, the 14th of February, a day for sweethearts.',
          incorrect: "Good try. Valentine's Day is the 14th of February.",
          unsure: "That is all right. Valentine's Day is the 14th of February.",
        },
      },
      "Let us start with some special days of the year, and the numbers that go with them. First, what number goes with Valentine's Day?"
    ),
    focusedTrivia(
      'waitangi',
      'What number goes with Waitangi Day?',
      '2 of 3',
      {
        answer: 'the 6th of February',
        aliases: ['6', '6th', 'six', 'sixth'],
        responses: {
          correct: 'Exactly, the 6th of February, just a week before Valentine’s Day.',
          incorrect: 'Good effort. Waitangi Day is the 6th of February, just a week before Valentine’s Day.',
          unsure: 'No problem. Waitangi Day is the 6th of February, just a week before Valentine’s Day.',
        },
      },
      'Next, what number goes with Waitangi Day?'
    ),
    focusedTrivia(
      'christmas',
      'What number goes with Christmas?',
      '3 of 3',
      {
        answer: 'the 25th of December',
        // Both are right: the 25th, or December as the 12th month.
        aliases: ['25', '25th', 'twenty five', 'twenty fifth', '12', '12th', 'twelve', 'twelfth', 'december'],
        responses: {
          correct: 'Yes! Christmas Day is the 25th of December, and December is the 12th month, so 25 and 12 both fit.',
          incorrect: 'A good guess. Christmas Day is the 25th of December, and December is the 12th month, so 25 and 12 both go with Christmas.',
          unsure: 'That is all right. Christmas Day is the 25th of December, and December is the 12th month, so 25 and 12 both go with Christmas.',
        },
      },
      'And what number goes with Christmas?'
    ),
    memoryQuestion(
      'christmas',
      16,
      'Christmas Memories',
      'What was Christmas like in your house when you were growing up?',
      'What was Christmas like in your house when you were growing up? If Christmas was not something you celebrated, you could tell me about a favourite celebration instead.'
    ),
    step('fill_in', 17, {
      title: 'Fill in the Number',
      subtitle: 'Everyday numbers',
      prompt: 'Fill in each missing number',
      bullets: FILL_IN_QUESTIONS,
      // Labels never contain their answer, so a re-prompt cannot give it away.
      namingSlots: {
        count: 4,
        labels: FILL_IN_LABELS,
        noun: 'number',
        // A single card left is asked again as its full question.
        singlePrompt: (label) => `And ${FILL_IN_QUESTIONS[FILL_IN_LABELS.indexOf(label)].replace(/^\w/, (c) => c.toLowerCase())}`,
        multiPrompt: (joined) => `And what about ${joined}?`,
        matchByContent: true,
      },
      interaction: {
        type: 'phraseCards',
        icon: '🔢',
        instruction: 'Fill in each missing number — it is fine to guess.',
        cards: [
          { id: 'tyres', text: `${FILL_IN_QUESTIONS[0]} ___` },
          { id: 'tricycle', text: `${FILL_IN_QUESTIONS[1]} ___` },
          { id: 'unlucky', text: `${FILL_IN_QUESTIONS[2]} ___` },
          { id: 'rugby', text: `${FILL_IN_QUESTIONS[3]} ___` },
        ],
      },
      reply: () =>
        'Now for some everyday numbers. There are four questions on the cards: how many tyres are on a car, how many wheels are on a tricycle, which number is unlucky, and how many players are in a rugby team. Have a go at any of them, in any order.',
    }),
    memoryQuestion(
      'rugby',
      17,
      'Rugby',
      'Did you ever follow the rugby, or go along to a game?',
      'Did you ever follow the rugby, or go along to a game? It is fine if sport was never your thing.'
    ),
    // Tap-to-choose like Session 12: every question shows at once, and each
    // round marks the guess right or wrong and shows the real answer.
    step('fours', 18, {
      title: 'Found in Fours',
      subtitle: 'Things that come in fours',
      prompt: 'Three things that come in fours',
      bullets: ['A good-luck plant', 'The New Zealand flag', 'A famous foursome'],
      interaction: {
        type: 'triviaChoice',
        rounds: [
          {
            question: 'Which good-luck plant has four leaves?',
            // Keywords leave out "four": every round is about fours, so it
            // would claim this round whenever another answer mentions it.
            options: [
              { id: 'a', label: 'A four-leaf clover', keywords: ['clover', 'leaf'] },
              { id: 'b', label: 'A rose' },
              { id: 'c', label: 'A daisy' },
            ],
            correctOptionId: 'a',
            fact: 'A four-leaf clover is rare, so finding one is meant to bring good luck.',
          },
          {
            question: 'What does the New Zealand flag have four of?',
            options: [
              { id: 'a', label: 'Stars' },
              { id: 'b', label: 'Moons' },
              { id: 'c', label: 'Stripes' },
            ],
            correctOptionId: 'a',
            fact: 'The New Zealand flag has four red stars, from the Southern Cross.',
          },
          {
            question: 'Which famous foursome made its American debut on The Ed Sullivan Show in 1964?',
            options: [
              // "Beetles" is a likely speech-to-text spelling; naming a Beatle counts too.
              { id: 'a', label: 'The Beatles', keywords: ['beatles', 'beetles', 'lennon', 'mccartney', 'harrison', 'ringo'] },
              { id: 'b', label: 'The Rolling Stones' },
              { id: 'c', label: 'The Beach Boys' },
            ],
            correctOptionId: 'a',
            fact: 'It was the Beatles: John, Paul, George, and Ringo.',
          },
        ],
      },
      reply: () =>
        'Next, three things that come in fours. Pick whichever answer you like, or say it. Which good-luck plant has four leaves? What does the New Zealand flag have four of? And which famous foursome made its American debut on The Ed Sullivan Show in 1964?',
    }),
    memoryQuestion(
      'beatles',
      18,
      'The Beatles',
      'Do you remember the Beatles, or have a favourite song of theirs?',
      'Do you remember the Beatles at all, or have a favourite song of theirs?'
    ),
    step('everyday', 19, {
      acceptAnyAnswer: true,
      title: 'What Everyday Things Come in This Number?',
      subtitle: 'No wrong answers',
      prompt: 'What everyday things come in twos, threes, fours, or dozens?',
      bullets: ['Twos', 'Threes', 'Four wheels', 'Dozens'],
      reply: () =>
        'Here are some everyday things that come in numbers, and there are no wrong answers. Pick whichever one you like, twos, threes, four wheels, or dozens, and tell me some everyday things that come in that number.',
    }),
    step('lucky_number', 20, {
      acceptAnyAnswer: true,
      title: 'Do You Have a Lucky Number?',
      subtitle: 'A personal question',
      prompt: 'Do you have a lucky number?',
      adaptiveFollowUp: adaptiveConversation(
        'If they share a lucky or special number, invite the story behind it, such as a birthday, a house number, a sports jersey, or a special date. If they do not have one, you may gently ask whether any number is special to them, but never ask them to recall a specific date. Do not follow up if they seem ready to move on.'
      ),
      reply: () => 'Now, a more personal one. Do you have a lucky number? Plenty of people do not, and that is fine too.',
    }),
    step('guess_intro', 21, {
      title: 'Guess How Many?',
      subtitle: 'A guessing game',
      prompt: 'Guess how many',
      interaction: { type: 'autoAdvance' },
      recordAnswer: false,
      reply: () =>
        'Next is a guessing game. I will show you a jar, and you guess how many lollies are inside. There is no need to count exactly; a guess is all we are after.',
    }),
    jarGuess(
      'lollies',
      22,
      'How many lollies are in the jar?',
      'How many lollies do you think are in this jar? You can pick one of the numbers on the screen, or make your own guess.'
    ),
    jarReveal('lollies', 23, 7, 'lollies'),
    jarGuess(
      'chocolates',
      24,
      'How many chocolates are in the jar?',
      'Here is a fuller jar. How many chocolates do you think are in this one? Some are hiding behind the others, so it really is a guess.'
    ),
    jarReveal('chocolates', 25, 17, 'chocolates', 'Some were hiding behind the others, which makes it tricky.'),
    step('sweets_memory', 25, {
      acceptAnyAnswer: true,
      title: 'Sweet Memories',
      subtitle: 'Your memories',
      prompt: 'Did you have a favourite lolly or chocolate when you were young?',
      reply: () =>
        'Did you have a favourite lolly or chocolate when you were young? Or do you remember guess-the-jar competitions at a school fair?',
    }),
    cloneStep(find('current_affairs_spin_question'), 'spin_question', 26),
    cloneStep(find('current_affairs_summary_song'), 'summary_song', 27, {
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'Today, you played with numbers from special days and everyday life, talked about lucky numbers, and guessed what was in a jar.'} What is one part of today that you would like to remember?`,
      ],
    }),
    cloneStep(find('current_affairs_closing'), 'closing', 28, {
      subtitle: 'Session 14: Word Games',
      bullets: ['Thank you', 'Next session', 'Word Games'],
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will explore Word Games. Thank you, ka kite anō, and I will look forward to seeing you next time.`,
    }),
  ];
}
