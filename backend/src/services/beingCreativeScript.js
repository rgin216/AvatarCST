import { buildStandardSessionOpening } from './cstSessionOpening.js';

const DECK_LABEL = 'NZ09. Being Creative';
const ACCENTS = ['#00AEEF', '#F47C20', '#A8C5A0', '#4472C4', '#F4C8B0', '#7A9DAD'];
const visualHint = (deckSlide) => `Source deck: ${DECK_LABEL}, slide ${deckSlide}`;

// Shown before the session starts, so the participant has a pen and paper
// ready by the time the drawing activity comes round.
export const BEING_CREATIVE_PREPARATION = {
  title: 'Before we begin',
  message: 'For today’s session you will need a pen and some paper. There is a drawing activity near the end.',
  note: 'No pen handy? That is fine. You can picture it in your mind instead.',
  items: ['A pen or pencil', 'Some paper'],
  confirmLabel: 'I am ready',
};

const cloneStep = (source, suffix, deckSlide, overrides = {}) => {
  const step = Object.defineProperties({}, Object.getOwnPropertyDescriptors(source));
  return Object.assign(step, {
    id: `being_creative_${suffix}`,
    deckSlide,
    visualHint: visualHint(deckSlide),
    ...overrides,
  });
};

const step = (suffix, deckSlide, fields) => ({
  id: `being_creative_${suffix}`,
  turns: 1,
  deckSlide,
  bullets: [],
  visualHint: visualHint(deckSlide),
  accent: ACCENTS[deckSlide % ACCENTS.length],
  acceptAnyAnswer: true,
  ...fields,
});

// Every reaction to a piece of art is welcome. Aria acknowledges it, then
// shares the title and artist as a light fact rather than asking for them.
const artwork = (suffix, deckSlide, { title, subtitle, prompt, revealFact, reply }) =>
  step(suffix, deckSlide, {
    title,
    subtitle,
    prompt,
    ...(revealFact ? { revealFact } : {}),
    reply: () => reply,
  });

// The pen-and-paper slide never says "take your time": the drawing has no
// inactivity reminder, and the follow-ups' reminder only repeats the question.
const drawingFollowUp = (suffix, prompt, reply) => step(suffix, 23, {
  title: 'Draw and Describe',
  subtitle: 'Your dream house',
  prompt,
  avoidPacingReassurance: true,
  inactivityReminderLead: '',
  reply: () => reply,
});

export function createBeingCreativeScript(shared) {
  const find = (id) => shared.find((candidate) => candidate.id === id);

  return [
    ...buildStandardSessionOpening({
      prefix: 'being_creative',
      deckLabel: DECK_LABEL,
      welcome: {
        title: 'AI-supported Individual Cognitive Stimulation Therapy',
        sessionNumber: 9,
        sessionTitle: 'Being Creative',
        reply: ({ name }) =>
          `Welcome back, ${name}. It is lovely to see you again. Today is our ninth session, and our theme will be Being Creative. A pen and some paper will come in handy later on.`,
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
      // The deck has its own check-in slide and no year-reveal slide, so the
      // opening spans slides 1-15.
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
        sessionTitle: 'Being Creative',
        bullets: ['Famous paintings', 'Art that makes you think', 'Draw and describe'],
        reply: () =>
          'Our theme today is Being Creative. We will look at some famous paintings and some art that makes you think, and then you will get a chance to draw something of your own. There are no right or wrong answers about art.',
      },
    }),
    artwork('monet_senses', 16, {
      title: 'Using Your Senses',
      subtitle: "Monet's Water Lilies",
      prompt: 'What might you hear or smell on that bridge?',
      revealFact: 'Monet planted this garden himself, and he painted his water lilies around 250 times.',
      reply:
        'Here is a painting by Claude Monet of the water lily pond in his garden in France. Let us use our senses. Imagine stepping onto that little bridge. What do you think you might hear, or smell?',
    }),
    // A personal question of its own, after the painting has been talked about.
    step('water_memory', 16, {
      title: 'A Favourite Spot',
      subtitle: 'Your memories',
      prompt: 'Is there a garden or a spot by the water you have loved?',
      reply: () => 'Is there a garden, or a spot by the water, that you have loved?',
    }),
    artwork('scream', 17, {
      title: 'The Scream',
      subtitle: 'Edvard Munch',
      prompt: 'What made this person react like that?',
      revealFact:
        'This is The Scream, painted by the Norwegian artist Edvard Munch in 1893. It is one of the most famous paintings in the world, and the screaming-face emoji is often said to be based on it.',
      reply: 'Here is a very famous painting. What do you think made this person react like that?',
    }),
    artwork('dali', 18, {
      title: 'The Persistence of Memory',
      subtitle: 'Salvador Dalí',
      prompt: 'What would you call this painting?',
      revealFact:
        'Salvador Dalí called it The Persistence of Memory, painted in 1931. He said the melting clocks were inspired by a runny Camembert cheese on a hot day, and the real painting is only about the size of a sheet of paper.',
      reply: 'This next one is a bit unusual. If this painting were yours to name, what would you call it?',
    }),
    artwork('picasso', 19, {
      title: 'Three Musicians',
      subtitle: 'Pablo Picasso',
      prompt: 'What sort of music are they playing?',
      revealFact:
        'Pablo Picasso painted this in 1921 and called it Three Musicians: a clarinet player, a guitar player, and a singer. There is also a dog hidden under the table, which many people never notice.',
      reply: 'And here are three musicians. What sort of music do you think they are playing?',
    }),
    artwork('drain', 20, {
      title: 'Art That Makes You Think',
      subtitle: 'The world down the drain',
      prompt: 'What do you see in it?',
      revealFact: 'It was painted by a Spanish street artist called Pejac.',
      reply:
        'Now for some art that makes you think. This one is painted on a street gutter. Some people see the world going down the drain, a nudge to look after our planet. Others think everything flows somewhere in the end. What do you see in it?',
    }),
    artwork('love', 21, {
      title: 'Art That Makes You Think',
      subtitle: 'Love',
      prompt: 'What do you see in it?',
      revealFact: 'The sculpture is by the Ukrainian artist Alexander Milov, and at night the two children inside light up.',
      reply:
        'This sculpture is called Love. Two grown-ups sit back to back, as if they have had a falling-out, while the children inside them reach out to each other. Some say the child inside us always wants to make up. Others see how we carry our younger selves with us. What do you see in it?',
    }),
    artwork('box', 22, {
      title: 'Art That Makes You Think',
      subtitle: 'Outside the box',
      prompt: 'What do you see in it?',
      reply:
        'Here is a man sitting in a box, with the lid open and a little light bulb above his head. Some see thinking outside the box. Others see that the walls around us are sometimes only lines we have drawn ourselves. What do you see in it?',
    }),
    step('draw_house', 23, {
      title: 'Draw and Describe',
      subtitle: 'Your dream house',
      prompt: 'Draw a house you would love to live in',
      bullets: ['Anywhere in the world', 'Any size, any style'],
      interaction: {
        type: 'offscreenTask',
        doneLabel: 'I have finished my drawing',
        doneMessage: 'I have finished my drawing.',
      },
      avoidPacingReassurance: true,
      reply: () =>
        'Now it is your turn to be creative. Pick up your pen and paper, and draw a house you would love to live in: anywhere in the world, any size, any style. It does not need to be a masterpiece, and if you would rather not draw, you can simply picture it. When you have finished, press the button, or tell me.',
    }),
    drawingFollowUp(
      'house_favourite_part',
      'What is your favourite part of your house?',
      'What is your favourite part of your house?'
    ),
    drawingFollowUp(
      'home_memory',
      'Is there a home you were especially fond of?',
      'Is there a home you have lived in that you were especially fond of?'
    ),
    cloneStep(find('current_affairs_spin_question'), 'spin_question', 24),
    cloneStep(find('current_affairs_summary_song'), 'summary_song', 25, {
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'Today, you looked at famous paintings, shared what some thought-provoking art meant to you, and drew a house of your own.'} What is one part of today that you would like to remember?`,
      ],
    }),
    cloneStep(find('current_affairs_closing'), 'closing', 26, {
      subtitle: 'Session 10: Categorizing Objects',
      bullets: ['Thank you', 'Next session', 'Categorizing Objects'],
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will explore Categorizing Objects. Thank you, ka kite anō, and I will look forward to seeing you next time.`,
    }),
  ];
}
