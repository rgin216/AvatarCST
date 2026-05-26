const scripts = {
  cst_intro_reminiscence: [
    {
      id: 'welcome_check_in',
      title: 'Welcome',
      prompt: 'A gentle check-in to begin the session.',
      visualHint: 'Warm living room, tea, calm daylight',
      reply: ({ name }) =>
        `Hello ${name}. It is lovely to see you today. Before we begin, how are you feeling right now?`,
    },
    {
      id: 'orientation_today',
      title: 'Today',
      prompt: 'Notice the day, place, and present moment.',
      visualHint: 'Simple calendar and window scene',
      reply: ({ name }) =>
        `Thank you for sharing that, ${name}. Let us take a moment to settle in. What is something you have noticed about today? It could be the weather, the room, or how the day has felt so far.`,
    },
    {
      id: 'word_association',
      title: 'Word Game',
      prompt: 'Say the first word or memory that comes to mind.',
      visualHint: 'Large friendly word card: Garden',
      reply: () =>
        'Let us try a short word game now. I will say a word, and you can tell me the first thing that comes to mind. The word is: garden.',
    },
    {
      id: 'reminiscence_prompt',
      title: 'Memories',
      prompt: 'Explore a personal memory with sensory details.',
      visualHint: 'Garden path with flowers and family photos',
      reply: ({ memoryLine }) => {
        const memoryBridge = memoryLine
          ? `I remember that ${memoryLine.toLowerCase()}. `
          : '';
        return `${memoryBridge}That is a lovely connection. Can you tell me about a place from your past that felt special to you? What could you see, hear, or smell there?`;
      },
    },
    {
      id: 'music_and_mood',
      title: 'Music',
      prompt: 'Connect music with mood and memory.',
      visualHint: 'Record player, music notes, relaxed colours',
      reply: () =>
        'Music can bring back powerful memories. Is there a song, singer, or kind of music that you have enjoyed over the years?',
    },
    {
      id: 'closing_reflection',
      title: 'Reflection',
      prompt: 'End with affirmation and one remembered highlight.',
      visualHint: 'Soft sunset and a simple highlight card',
      reply: ({ name }) =>
        `Thank you, ${name}. You have shared some wonderful thoughts today. Before we finish, what is one part of our conversation that you would like to remember?`,
    },
  ],
};

export const getScript = (scriptId = 'cst_intro_reminiscence') =>
  scripts[scriptId] || scripts.cst_intro_reminiscence;

export const getScriptStep = (scriptId, stepIndex) => {
  const script = getScript(scriptId);
  const boundedIndex = Math.min(Math.max(stepIndex, 0), script.length - 1);
  return {
    step: script[boundedIndex],
    boundedIndex,
    isFinalStep: boundedIndex === script.length - 1,
    totalSteps: script.length,
  };
};
