export const pronunciationClips = [
  ['whanau', 'Whānau', 'Family', 'Whanau'],
  ['kaumatua', 'Kaumātua', 'Elder', 'Kaumātua'],
  ['moana', 'Moana', 'Ocean', 'Moana'],
  ['kai', 'Kai', 'Food', 'Kai'],
  ['aroha', 'Aroha', 'Love', 'Aroha'],
  ['ka-pai', 'Ka pai', 'Good, well done', 'KaPai'],
].map(([id, label, meaning, file]) => ({ id, label, meaning, src: `/audio/session14/${file}.mp3` }));

export const brainTeasers = [
  ['Wish upon a star', ['wish on a star', 'wishing upon a star']],
  ['Put your foot down', ['put my foot down', 'putting your foot down']],
  ['Down to Earth', ['down to the earth']],
  ['Wear your heart on your sleeve', ['heart on your sleeve', 'heart on my sleeve', 'wearing your heart on your sleeve']],
  ["Don’t count on it", ['dont count on it', 'do not count on it', "don't count on it"]],
  ['Horsing around', ['horse around', 'horsing about', 'horse about']],
  ['Head over heels', []],
  ['Fall asleep', ['falling asleep', 'fell asleep']],
  ['Big mouth', []],
  ['Over the moon', []],
  ['Way over budget', ['over budget', 'way over the budget']],
  ['A score to settle', ['score to settle', 'settle the score', 'settling the score']],
  ['Double agent', []],
  ['Killing time', ['time to kill', 'kill time']],
];

export function createWordGamesScript(shared) {
  const clone = (source, overrides = {}) => {
    const step = Object.defineProperties({}, Object.getOwnPropertyDescriptors(source));
    step.id = source.id.replace('faces_scenes_', 'word_games_');
    if (step.nextStepId) step.nextStepId = step.nextStepId.replace('faces_scenes_', 'word_games_');
    if (step.seasonBranches) step.seasonBranches = Object.fromEntries(Object.entries(step.seasonBranches).map(([season, id]) => [season, id.replace('faces_scenes_', 'word_games_')]));
    Object.assign(step, overrides);
    step.visualHint = `NZ14. Word Games, slide ${step.deckSlide}`;
    return step;
  };
  const opening = shared.slice(0, shared.findIndex(s => s.id === 'faces_scenes_theme_intro') + 1).map(s => clone(s));
  Object.assign(opening[0], { subtitle: 'Session 14: Word Games', bullets: ['Session 14', 'Word Games'], reply: ({ name }) => `Welcome back, ${name}. Today is Session 14: Word Games. We will explore words and enjoy some puzzles together. Say ready when you would like to begin.` });
  Object.assign(opening.at(-1), { title: 'Word Games', subtitle: 'Words and puzzles', prompt: 'Word Games', bullets: ['Te reo Māori', 'Brain teasers', 'Words that go together'], reply: () => 'Today we will listen to some Māori words, try word brain teasers, and explore words that go together and rhyme. Take your time; it is always fine to be unsure.' });
  const activity = (id, deckSlide, title, prompt, extra = {}) => ({ id: `word_games_${id}`, deckSlide, title, subtitle: 'Word Games', prompt, turns: 1, acceptAnyAnswer: true, bullets: [], accent: '#4472C4', reply: () => prompt, ...extra });
  const associations = [
    ['Salt', 'and', 'pepper'], ['Knife', 'and', 'fork'], ['Cup', 'of', 'tea'], ['Tea', 'and', 'biscuits'],
    ['Jam', 'and', 'bread'], ['Spoon', 'and', 'bowl'], ['Egg', 'and', 'bacon'], ['Pancake', 'and', 'syrup'], ['Kettle', 'and', 'water'],
  ];
  return [
    ...opening,
    activity('pronunciation', 16, 'Common te reo Māori words', 'Click each Māori word to hear it, then try saying it aloud. Listen to all six words before pressing Continue. You can play each word again as often as you like.', { interaction: { type: 'pronunciation', clips: pronunciationClips }, recordAnswer: false }),
    activity('example', 17, 'Word brain teasers', 'The layout of these words hides a saying. Here we have four GIVE words and four GET words: forgive and forget! Try your best with the next puzzles, but feel free to say you are unsure. Say ready when you would like to try.'),
    ...brainTeasers.map(([answer, aliases], i) => activity(`teaser_${i + 18}`, i + 18, 'Word brain teasers', i === 1 ? 'What saying might this picture mean? It is something you say when you want to be firm.' : 'What saying do you think this picture represents? It is fine to be unsure.', { trivia: { answer, aliases: [answer, ...aliases] } })),
    ...associations.map(([word, joiner, example], i) => activity(`association_${word.toLowerCase()}`, 32, 'What goes together?', `${i === 0 ? 'Bread and butter is one example. Now it is your turn. ' : ''}${word} ${joiner} what?`, {
      acceptAnyAnswer: false,
      wordAssociation: { word, example },
      interaction: { type: 'focusedQuestion', question: `${word} ${joiner} ___`, progress: `${i + 1} of ${associations.length}` },
    })),
    ...['Sun', 'Bee', 'Rain', 'Soap', 'Bread'].map((word, i) => activity(`rhyme_${word.toLowerCase()}`, 33, 'Words that rhyme', `${i === 0 ? 'Cat rhymes with hat, bat, and mat. Rhyming words have the same ending sound. ' : ''}Can you name one or more words that rhyme with ${word.toLowerCase()}?`, {
      acceptAnyAnswer: false, rhymeWord: word,
      interaction: { type: 'focusedQuestion', question: `What rhymes with ${word.toLowerCase()}?`, progress: `${i + 1} of 5` },
    })),
    activity('five_letter', 34, 'Five-letter word game', 'Try to find a five-letter word in six guesses. Green means the letter is in the right place. Yellow means it belongs in another place. Grey means that copy of the letter is not needed. Type your guesses in the game. A hint gives you one green letter and one yellow letter. You can finish whenever you like.', { interaction: { type: 'wordGuess' } }),
    clone(shared.find(s => s.id === 'faces_scenes_spin_question'), { deckSlide: 35 }),
    clone(shared.find(s => s.id === 'faces_scenes_summary_song'), { deckSlide: 36, followUps: [({ sessionSummary }) => `Let us look back over today. ${sessionSummary || 'We listened to Māori words, explored sayings, and played with word associations and rhymes.'} What is one part you enjoyed?`] }),
    clone(shared.find(s => s.id === 'faces_scenes_closing'), { deckSlide: 37, subtitle: 'Session 15: Pub Quiz', bullets: ['Thank you', 'Next time: Pub Quiz'], reply: ({ name }) => `Thank you for joining me today, ${name}. Our next session is a Pub Quiz. Ka kite anō, and I look forward to seeing you again.` }),
  ];
}
