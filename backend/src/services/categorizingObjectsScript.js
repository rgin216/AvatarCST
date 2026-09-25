import { buildStandardSessionOpening } from './cstSessionOpening.js';
import { adaptiveConversation } from './cstScriptHelpers.js';
import { oddItems, pairItems } from './categorizingObjectsData.js';

export function createCategorizingObjectsScript(shared) {
  const reuseClosing = (suffix, deckSlide, overrides = {}) => ({
    ...shared.find(step => step.id === 'current_affairs_' + suffix),
    id: 'categorizing_objects_' + suffix, deckSlide,
    visualHint: 'Source deck: NZ10. Categorizing Objects, slide ' + deckSlide,
    ...overrides,
  });
  const activity = (suffix, deckSlide, title, reply, extra = {}) => ({
    id: 'categorizing_objects_' + suffix, deckSlide, title, prompt: title,
    subtitle: 'Categorizing Objects', bullets: [], turns: 1, acceptAnyAnswer: true,
    accent: '#4472C4', inactivityTimeoutMs: 180000,
    visualHint: 'Source deck: NZ10. Categorizing Objects, slide ' + deckSlide,
    reply: typeof reply === 'function' ? reply : () => reply, ...extra,
  });
  return [
    ...buildStandardSessionOpening({
      prefix: 'categorizing_objects',
      deckLabel: 'NZ10. Categorizing Objects',
      welcome: {
        title: 'Virtual Cognitive Stimulation Therapy',
        sessionNumber: 10,
        sessionTitle: 'Categorizing Objects',
        reply: ({ name }) => `Welcome back, ${name}. Today is our tenth session: Categorizing Objects. We will explore our senses, group everyday objects, and try a category word game. Take your time. Say ready when you would like to begin.`,
      },
      themeSong: {
        title: 'Welcome Back', subtitle: 'Your theme song', bullets: ['Welcome back', 'Theme song'],
        reply: ({ themeSong }) => themeSong?.status === 'available'
          ? `Let us begin with your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to 30 seconds. When you have finished listening, press Done, or say or type done.`
          : 'I could not find a saved theme song this time. Press Done, or say or type done, when you are ready to continue.',
      },
      checkIn: {
        shareThemeSongSlide: true,
        adaptiveFollowUp: adaptiveConversation('If they share a positive or neutral feeling with some personal detail, invite one concrete detail about what shaped their day. Do not follow up if they seem tired, distressed, or ready to continue.'),
      },
      includeYearReveal: true,
      yearReveal: { detail: '' },
      seasonReplyStyle: 'dynamic',
      weather: {
        adaptiveFollowUp: adaptiveConversation('If they add a meaningful detail, invite one brief sensory observation or a gentle comparison with weather they remember, without turning it into a factual test.'),
      },
      currentAffairsSlide: {
        id: 'categorizing_objects_positive_news',
        subtitle: 'A current headline from our news service',
        adaptiveFollowUp: adaptiveConversation('Invite one reaction to the current story. If they ask for more, use only the vetted article details supplied by the news service; never invent missing facts.'),
        reply: ({ currentAffairs }) => currentAffairs?.status === 'available'
          ? `Here is a recent positive story from New Zealand: ${currentAffairs.article.title}. You can ask me to tell you more, or tell me what you think about it.`
          : 'I could not find a clearly positive New Zealand story just now. Have you heard anything pleasant or interesting lately?',
      },
      exercise: {
        reply: () => 'Next is the same short seated exercise. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
      },
      themeIntro: {
        sessionTitle: 'Categorizing Objects', bullets: ['Our senses', 'Everyday objects', 'Categories'],
        reply: () => 'Our theme today is Categorizing Objects. We will explore different ways of grouping everyday things.',
      },
    }),
    ...[
      ['soft_bitter', 'If you feel comfortable, close your eyes, or simply look down. Think of something soft, then something bitter. When you are ready, tell me the two things you thought of. One idea is fine too.'],
      ['loud_cold', 'Next, think of something loud and something cold. Take your time, then tell me what came to mind.'],
      ['scent_yellow', 'For our last pair, think of something with a strong scent and something yellow. What did you think of?'],
    ].map(([suffix, reply]) => activity('senses_' + suffix, 16, 'Five Senses Game', reply, {
      adaptiveFollowUp: undefined,
      activityKind: 'senses',
    })),
    activity('odd_one_out', 17, "What doesn't belong?", 'Look at all these pictures. Which items do you think do not belong with the others? Tap or click to circle them, then press Check selections. You can change your choices before checking.', {
      interaction: { type: 'objectSelection', mode: 'odd', items: oddItems }, activityKind: 'odd',
    }),
    activity('pairs', 18, 'What goes together?', 'Choose two objects you think go together. Each pair will have its own colour and number. There are many possible connections: how we use them, a room they belong in, their material, or their colour. You can reuse an object in a different pair. Choose two to begin, and press Done whenever you have had enough.', {
      interaction: { type: 'objectSelection', mode: 'pairs', items: pairItems }, activityKind: 'pairs',
    }),
    activity('category', 19, 'Choose a category', 'Now we will try Categories from A to Z. First choose a category, such as animals, foods, places, or names. Then we will choose a letter and think of words in that category beginning with it. What category would you like?', { activityKind: 'category' }),
    activity('letter', 19, 'Choose a letter', ({ categorizing = {} }) => `Our category is ${categorizing.category || 'animals'}. Which letter would you like to try? You could choose A, B, or C, or another letter.`, { activityKind: 'letter' }),
    activity('words', 19, 'Words in your category', ({ categorizing = {} }) => `Let us think of ${categorizing.category || 'animals'} beginning with ${categorizing.letter || 'A'}. Tell me as many words as you like, in one go or a few at a time. There is no target or time limit. Say done when you have finished, or say you are not sure.`, { activityKind: 'words' }),
    activity('holiday', 20, 'Childhood holidays', 'What did you always bring on your childhood holidays? It could be something useful, something to play with, or a favourite possession.', {
      adaptiveFollowUp: adaptiveConversation('Invite one gentle memory about their holiday object or how it was used. Accept any memory or a wish to move on.'),
    }),
    reuseClosing('spin_question', 21),
    reuseClosing('summary_song', 22, {
      followUps: [({ sessionSummary }) => `Let us look back over today. ${sessionSummary || 'We explored our senses, grouped everyday objects, tried category words, and remembered holidays.'} What is one part you would like to remember?`],
    }),
    reuseClosing('closing', 23, {
      subtitle: 'Session 11: Orientation', bullets: ['Thank you', 'Orientation'],
      reply: ({ name }) => `Thank you for joining me today, ${name}. Next time our theme is Orientation. Ka kite anō, and I look forward to seeing you again.`,
    }),
  ];
}
