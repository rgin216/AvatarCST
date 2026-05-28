const scripts = {
  cst_intro_reminiscence: [
    {
      id: 'welcome_check_in',
      title: 'Welcome Back',
      subtitle: 'A gentle start',
      prompt: 'How are you feeling right now?',
      bullets: ['Take your time', 'Notice your body', 'Share one feeling'],
      visualHint: 'Warm sitting room with soft daylight and a cup of tea',
      accent: '#F4C8B0',
      reply: ({ name }) =>
        `Hello ${name}. It is lovely to see you today. Before we begin, how are you feeling right now?`,
    },
    {
      id: 'orientation_today',
      title: 'Today',
      subtitle: 'Present moment',
      prompt: 'What have you noticed about today?',
      bullets: ['Weather', 'Room', 'Time of day'],
      visualHint: 'Simple calendar beside a bright window',
      accent: '#B8CDD8',
      reply: ({ name }) =>
        `Thank you for sharing that, ${name}. Let us settle in together. What is something you have noticed about today, perhaps the weather, the room, or how the day has felt?`,
    },
    {
      id: 'word_association',
      title: 'Word Game',
      subtitle: 'First thought',
      prompt: 'Garden',
      bullets: ['Say the first word', 'Share a memory', 'There is no wrong answer'],
      visualHint: 'Large friendly word card reading Garden',
      accent: '#A8C5A0',
      reply: () =>
        'Let us try a short word game now. I will say a word, and you can tell me the first thing that comes to mind. The word is: garden.',
    },
    {
      id: 'reminiscence_prompt',
      title: 'Memory Lane',
      subtitle: 'Sights, sounds, and feelings',
      prompt: 'Tell me about a special place from your past.',
      bullets: ['What could you see?', 'What could you hear?', 'Who was there?'],
      visualHint: 'Garden path with flowers and family photo frames',
      accent: '#E8A090',
      reply: ({ memoryLine }) => {
        const bridge = memoryLine ? `I remember that ${memoryLine.toLowerCase()}. ` : '';
        return `${bridge}Can you tell me about a place from your past that felt special to you? What could you see, hear, or smell there?`;
      },
    },
    {
      id: 'music_and_mood',
      title: 'Music',
      subtitle: 'Songs and mood',
      prompt: 'Is there a song or singer you have enjoyed?',
      bullets: ['A favourite singer', 'A dance or concert', 'A song from home'],
      visualHint: 'Record player with soft music notes',
      accent: '#7A9DAD',
      reply: () =>
        'Music can bring back powerful memories. Is there a song, singer, or kind of music that you have enjoyed over the years?',
    },
    {
      id: 'closing_reflection',
      title: 'Reflection',
      subtitle: 'One thing to remember',
      prompt: 'What part would you like to remember?',
      bullets: ['A word', 'A person', 'A feeling'],
      visualHint: 'Soft sunset with a simple highlight card',
      accent: '#A8C5A0',
      reply: ({ name }) =>
        `Thank you, ${name}. You have shared some wonderful thoughts today. Before we finish, what is one part of our conversation that you would like to remember?`,
    },
  ],
};

export const getScript = (scriptId = 'cst_intro_reminiscence') =>
  scripts[scriptId] || scripts.cst_intro_reminiscence;

export const getScriptStep = (scriptId, stepIndex = 0) => {
  const script = getScript(scriptId);
  const boundedIndex = Math.min(Math.max(stepIndex, 0), script.length - 1);
  return {
    step: script[boundedIndex],
    boundedIndex,
    isFinalStep: boundedIndex === script.length - 1,
    totalSteps: script.length,
  };
};
