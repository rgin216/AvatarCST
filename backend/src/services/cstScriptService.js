const scripts = {
  cst_intro_reminiscence: [
    {
      id: 'welcome_check_in',
      turns: 1,
      deckSlide: 1,
      title: 'Virtual Cognitive Stimulation Therapy',
      subtitle: 'Session 1: Introduction & Welcome',
      prompt: 'How are you feeling right now?',
      bullets: ['Welcome', 'No preparation needed', 'Nothing you can get wrong'],
      visualHint: 'Source deck: NZ01. Welcome.pptx, slide 1',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Hello ${name}, and welcome. I am Aria, and I will be guiding you through our Cognitive Stimulation Therapy sessions. Today is our first one, so we will take it gently. There is nothing to prepare and nothing you can get wrong. How are you feeling today?`,
    },
    {
      id: 'ai_introduction',
      turns: 1,
      deckSlide: 3,
      title: 'Your Virtual CST Facilitator',
      subtitle: 'Meet Aria',
      prompt: 'Does that sound alright?',
      bullets: ['Good company', 'Interesting questions', 'No tests'],
      visualHint: 'Source deck: facilitator introduction',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Thank you for sharing that, ${name}. A little about me: my role is simply to keep us company, ask some interesting questions, and share a bit of fun conversation. I am not here to test you, and there are no right or wrong answers. Does that sound alright?`,
    },
    {
      id: 'getting_to_know_you_name',
      turns: 3, // name → where they live → who's at home
      deckSlide: 4,
      title: 'Introduce Yourselves',
      subtitle: 'Getting to know you',
      prompt: 'What would you like me to call you?',
      bullets: ['Your name', 'Where you live', "Who's at home"],
      visualHint: 'Source deck: Introduce yourselves',
      accent: '#F4C8B0',
      reply: () =>
        'Now I would love to learn about you. To start, what is your name, and what would you like me to call you?',
    },
    {
      id: 'todays_plan',
      turns: 1,
      deckSlide: 5,
      title: "Today's Plan",
      subtitle: 'What we will do together',
      prompt: 'Sound good?',
      bullets: ['Learn about virtual CST', 'Simple details', 'Your questions'],
      visualHint: "Source deck: Virtual CST - Today's plan",
      accent: '#00AEEF',
      reply: () =>
        'Here is what we will do together today. First, I will tell you a bit about what CST is, then we will sort out a few simple details, do a gentle warm-up for the mind, and leave plenty of room for your thoughts and questions. Sound good?',
    },
    {
      id: 'getting_comfortable',
      turns: 1,
      deckSlide: 6,
      title: 'Getting Comfortable',
      subtitle: 'A quick tech check',
      prompt: 'Can you hear me clearly?',
      bullets: ['Hear clearly', 'Read comfortably', 'Tell me if anything is not working'],
      visualHint: 'Source deck: Getting Started on Zoom',
      accent: '#7A9DAD',
      reply: () =>
        'Before we dive in, is everything comfortable on your end? Can you hear me clearly and read everything alright? If anything ever is not working, just let me know and we will sort it out together.',
    },
    {
      id: 'what_is_cst',
      turns: 1,
      deckSlide: 11,
      title: 'What is CST?',
      subtitle: 'Cognitive Stimulation Therapy',
      prompt: 'What would you most like to get out of our time?',
      bullets: ['Evidence-based', 'Good conversation', 'Memory, mood, and connection'],
      visualHint: 'Source deck: What is Cognitive Stimulation Therapy',
      accent: '#A8C5A0',
      reply: () =>
        'So, what is CST? It is a friendly, evidence-based program for people who notice some changes in memory or thinking. Mostly, though, it is about good conversation and a bit of fun. Is there anything you would most like to get out of our time together, such as sharpening your thinking, some company, or simply enjoying yourself?',
    },
    {
      id: 'cst_nutshell',
      turns: 1,
      deckSlide: 13,
      title: 'CST in a Nutshell',
      subtitle: 'The spirit of our sessions',
      prompt: 'Opinions rather than facts',
      bullets: ['Mental stimulation', 'Opinions rather than facts', 'New ideas and associations'],
      visualHint: 'Source deck: CST in a Nutshell',
      accent: '#F4C8B0',
      reply: () =>
        'If I had to sum CST up in three little ideas, they would be gentle mental stimulation, your opinions rather than facts, and chasing new thoughts and connections wherever they take us. That is really the whole spirit of it.',
    },
    {
      id: 'session_logistics',
      turns: 1,
      deckSlide: 14,
      title: 'Our Virtual CST Sessions',
      subtitle: 'How sessions will work',
      prompt: 'How does that sound?',
      bullets: ['Regular sessions', 'Different themes', 'Flexible if life comes up'],
      visualHint: 'Source deck: Our Virtual CST group',
      accent: '#7A9DAD',
      reply: () =>
        'A few simple details. We will meet regularly, and each session will have a different theme. Coming along to each one helps because they build on each other, but life happens, so we can be flexible. How does that sound?',
    },
    {
      id: 'session_name',
      turns: 1,
      deckSlide: 17,
      title: 'Session Name',
      subtitle: 'A shared ritual',
      prompt: 'Would you like to give our sessions a name?',
      bullets: ['The Early Birds', 'Minds That Matter', 'The Warriors'],
      visualHint: 'Source deck: Group Name',
      accent: '#00AEEF',
      reply: () =>
        'Here is a fun CST tradition: people often give their sessions a little name, because it makes it feel like ours. Would you like to give our sessions a name? Anything you fancy.',
    },
    {
      id: 'theme_song',
      turns: 1,
      deckSlide: 19,
      title: 'Theme Song',
      subtitle: 'Music that lifts the spirits',
      prompt: 'Is there a song that always makes you feel good?',
      bullets: ['Here Comes the Sun', 'Que Sera, Sera', 'A Little Help From My Friends'],
      visualHint: 'Source deck: Theme Song',
      accent: '#F4C8B0',
      reply: () =>
        'Some people also pick a theme song, a tune that lifts the spirits. Is there a song that always makes you feel good, or one you would like to be ours?',
    },
    {
      id: 'orientation_day',
      turns: 2, // day/date → season and weather
      deckSlide: 21,
      title: 'Getting Our Bearings',
      subtitle: 'A friendly check-in',
      prompt: 'What day of the week is it?',
      bullets: ['Day', 'Month', 'Year', 'Season'],
      visualHint: 'Source deck: orientation slides',
      accent: '#A8C5A0',
      reply: () =>
        'Let us just get our bearings together for the day. Do you happen to know what day of the week it is? No worry at all if not, it is easy to lose track.',
    },
    {
      id: 'current_affairs',
      turns: 1,
      deckSlide: 31,
      title: 'Current Affairs',
      subtitle: 'Big or small news',
      prompt: 'Have you heard anything interesting lately?',
      bullets: ['Local news', 'Weather', 'Sport', 'Something pleasant'],
      visualHint: 'Source deck: Current Affairs',
      accent: '#00AEEF',
      reply: () =>
        'Have you come across anything in the news lately, or heard anything interesting going on? It can be big or small, even something local or about the weather.',
    },
    {
      id: 'gentle_movement',
      turns: 1,
      deckSlide: 32,
      title: 'Get the Blood Flowing',
      subtitle: 'Gentle seated movement',
      prompt: 'Would you like to try a few gentle moves?',
      bullets: ['Shoulders', 'Arms', 'Fingers and hands'],
      visualHint: 'Source deck: Get the Blood Flowing to Your Brain',
      accent: '#A8C5A0',
      reply: () =>
        'Let us get a little blood flowing to the brain. Nothing strenuous, all from your seat. Would you like to try a few gentle moves with me?',
    },
    {
      id: 'closing_reflection',
      turns: 1,
      deckSlide: 34,
      title: 'See You Then',
      subtitle: 'Looking ahead',
      prompt: 'What part would you like to remember?',
      bullets: ['Thank you', 'Next session', 'Getting to Know You: Childhood'],
      visualHint: 'Source deck: See you then',
      accent: '#F4C8B0',
      reply: ({ name }) =>
        `${name}, this has been a really lovely first session. Thank you for your company and for sharing your thoughts. Our next session will be Getting to Know You: Childhood. Before we finish, what is one part of our conversation that you would like to remember?`,
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
