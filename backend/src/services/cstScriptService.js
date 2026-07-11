const scriptSlideFolders = {
  cst_intro_reminiscence: 'session1',
  cst_childhood: 'session2',
};

const scripts = {
  cst_intro_reminiscence: [
    {
      id: 'welcome_opening',
      turns: 1,
      deckSlide: 1,
      title: 'AI-supported Individual Cognitive Stimulation Therapy',
      subtitle: 'Session 1: Introduction & Welcome',
      prompt: 'How are you feeling right now?',
      bullets: ['Introduction & Welcome', 'AI-supported CST', 'University of Auckland'],
      visualHint: 'Source deck: NZ01. Welcome, slide 1',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Hello ${name}, and welcome. I am Aria, and I will be guiding you through this AI-supported Cognitive Stimulation Therapy session. Today is our first session, so we will take it gently and get comfortable together. How are you feeling today?`,
    },
    {
      id: 'facilitator_role',
      turns: 1,
      deckSlide: 2,
      title: 'Your AI-supported CST Facilitator',
      subtitle: 'What I am here to do',
      prompt: 'Does that sound alright?',
      bullets: ['Keep each other company', 'Try interesting questions', 'Enjoy fun conversations'],
      visualHint: 'Source deck: NZ01. Welcome, slide 2',
      accent: '#F47C20',
      reply: ({ name }) =>
        `Thank you for sharing that, ${name}. My role is to keep you company, try some interesting questions with you, and enjoy some fun conversation together. There are no tests here and no right or wrong answers. Does that sound alright?`,
    },
    {
      id: 'introduce_yourself',
      turns: 4,
      deckSlide: 3,
      title: 'Introduce Yourself',
      subtitle: 'Getting to know you',
      prompt: "What's your name?",
      bullets: ['Your name', 'Where you live', "Who's at home with you", 'Computer or tablet comfort'],
      visualHint: 'Source deck: NZ01. Welcome, slide 3',
      accent: '#F4C8B0',
      reply: () =>
        'Now I would love to learn about you. To start, what is your name, and what would you like me to call you?',
      followUps: [
        () => 'And where do you live?',
        () => "And who is at home with you these days?",
        () => 'And how are you finding using your computer or tablet today?',
      ],
    },
    {
      id: 'what_is_cst',
      turns: 1,
      deckSlide: 4,
      title: 'What is CST?',
      subtitle: 'Cognitive Stimulation Therapy',
      prompt: 'What do you think about that?',
      bullets: ['Evidence-based', 'Developed at University College London', 'Memory, mood, communication, and social engagement'],
      visualHint: 'Source deck: NZ01. Welcome, slide 4',
      accent: '#A8C5A0',
      reply: () =>
        'Cognitive Stimulation Therapy, or CST, is an evidence-based therapy for people living with cognitive changes or memory loss. It was developed at University College London, and it is designed to actively stimulate the mind in a supportive environment. What do you think about that?',
    },
    {
      id: 'cst_interests',
      turns: 1,
      deckSlide: 5,
      title: 'What is CST?',
      subtitle: 'What you may be interested in',
      prompt: 'Which of those sounds most useful or enjoyable to you?',
      bullets: ['Improving memory and thinking', 'Being with others experiencing similar changes', 'Sharing thoughts and ideas', 'Having some fun'],
      visualHint: 'Source deck: NZ01. Welcome, slide 5',
      accent: '#F47C20',
      reply: () =>
        'People come to CST for different reasons. You may be interested in improving memory and thinking, being with others who understand similar changes, sharing thoughts and ideas, or simply having some fun. Which of those sounds most useful or enjoyable to you?',
    },
    {
      id: 'cst_nutshell',
      turns: 1,
      deckSlide: 6,
      title: 'CST in a Nutshell',
      subtitle: 'The spirit of our sessions',
      prompt: 'Which of those ideas do you like best?',
      bullets: ['Mental stimulation', 'Opinions rather than facts', 'New ideas and associations'],
      visualHint: 'Source deck: NZ01. Welcome, slide 6',
      accent: '#F47C20',
      reply: () =>
        'In a nutshell, CST is about gentle mental stimulation, your opinions rather than facts, and exploring new ideas, thoughts, and associations. Which of those ideas do you like best?',
    },
    {
      id: 'session_themes',
      turns: 1,
      deckSlide: 7,
      title: 'CST Session Themes',
      subtitle: 'What we will explore',
      prompt: 'Which theme sounds most interesting to you?',
      bullets: ['Welcome', 'Childhood', 'Physical games', 'Sounds', 'Food/Kai', 'Current affairs', 'Word games'],
      visualHint: 'Source deck: NZ01. Welcome, slide 7',
      accent: '#F47C20',
      reply: () =>
        'Across the sessions, we will explore a range of themes, including childhood, physical games, sounds, food and kai, current affairs, word association, being creative, orientation, money, number games, word games, and a team quiz. Which theme sounds most interesting to you?',
    },
    {
      id: 'next_session',
      turns: 1,
      deckSlide: 8,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 2: Getting To Know You (Childhood)',
      prompt: 'What part would you like to remember?',
      bullets: ['Session 2', 'Getting To Know You', 'Childhood'],
      visualHint: 'Source deck: NZ01. Welcome, slide 8',
      accent: '#4472C4',
      reply: ({ name }) =>
        `${name}, this has been a lovely first session. Thank you for your company and for sharing your thoughts. Next time, our theme will be Getting To Know You, with a focus on childhood. Before we finish, what is one part of today that you would like to remember?`,
    },
  ],
  cst_childhood: [
    {
      id: 'childhood_welcome_back',
      turns: 1,
      deckSlide: 1,
      title: 'Getting to Know You',
      subtitle: 'Session 2: Childhood',
      prompt: 'Welcome back',
      bullets: ['Welcome back', 'Childhood memories', 'No wrong answers'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 1',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Welcome back, ${name}. It is lovely to see you again. Today our theme is Getting to Know You: Childhood, so we will share a few early memories and enjoy the conversation. How are you feeling today?`,
    },
    {
      id: 'childhood_group_song_recap',
      turns: 1,
      deckSlide: 2,
      title: 'Group Name and Theme Song',
      subtitle: 'Our shared ritual',
      prompt: 'Do you remember our session name or song?',
      bullets: ['Group name', 'Theme song', 'We can choose later if needed'],
      visualHint: 'Source deck: Welcome Back group name/theme song',
      accent: '#F4C8B0',
      reply: () =>
        'Before we begin, let us check in with our little session rituals. Do you remember if we chose a name for our sessions or a theme song last time?',
    },
    {
      id: 'childhood_check_in',
      turns: 1,
      deckSlide: 4,
      title: 'Check In',
      subtitle: 'How are you doing today?',
      prompt: 'How are you doing today?',
      bullets: ['Mood', 'Energy', 'Comfort'],
      visualHint: 'Source deck: Check in - How are you doing today?',
      accent: '#A8C5A0',
      reply: () =>
        'Let us start with a gentle check-in. How are you doing today?',
    },
    {
      id: 'childhood_orientation_day',
      turns: 1,
      deckSlide: 5,
      title: 'Day of the Week',
      subtitle: 'Getting our bearings',
      prompt: 'What day of the week is it?',
      bullets: ['Day of the week', 'No pressure', 'We work it out together'],
      visualHint: 'Source deck: What day of the week is it?',
      accent: '#7A9DAD',
      reply: () =>
        'Let us get our bearings together. Do you happen to know what day of the week it is?',
    },
    {
      id: 'childhood_orientation_month',
      turns: 1,
      deckSlide: 6,
      title: 'Month',
      subtitle: 'Getting our bearings',
      prompt: 'What month are we enjoying?',
      bullets: ['Month', 'Time of year', 'Easy support if unsure'],
      visualHint: 'Source deck: What month are we enjoying?',
      accent: '#00AEEF',
      reply: () =>
        'And what month are we enjoying at the moment?',
    },
    {
      id: 'childhood_orientation_year',
      turns: 1,
      deckSlide: 7,
      title: 'Year',
      subtitle: 'Getting our bearings',
      prompt: 'What year is it?',
      bullets: ['Year', 'No testing', 'Warm support'],
      visualHint: 'Source deck: What year is it?',
      accent: '#F4C8B0',
      reply: () =>
        'And do you happen to know what year it is?',
    },
    {
      id: 'childhood_orientation_season',
      turns: 1,
      deckSlide: 9,
      title: 'Season',
      subtitle: 'Getting our bearings',
      prompt: 'Which season are we enjoying?',
      bullets: ['Season', 'Changes outside', 'Favourite parts'],
      visualHint: 'Source deck: Which season are we enjoying?',
      accent: '#A8C5A0',
      reply: () =>
        'Which season are you enjoying where you are?',
    },
    {
      id: 'childhood_weather',
      turns: 1,
      deckSlide: 14,
      title: 'Weather',
      subtitle: 'Outside today',
      prompt: 'What is the weather like?',
      bullets: ['Sunny', 'Cloudy', 'Rainy', 'Cold or warm'],
      visualHint: 'Source deck: The weather is...',
      accent: '#7A9DAD',
      reply: () =>
        'What is the weather like out your window today?',
    },
    {
      id: 'childhood_current_affairs',
      turns: 1,
      deckSlide: 15,
      title: 'Current Affairs',
      subtitle: 'Big or small news',
      prompt: 'Have you heard anything interesting lately?',
      bullets: ['Local news', 'Weather', 'Sport', 'Something pleasant'],
      visualHint: 'Source deck: Current Affairs',
      accent: '#00AEEF',
      reply: () =>
        'Have you heard anything interesting in the news lately? It can be something big or something small and local.',
    },
    {
      id: 'childhood_movement',
      turns: 1,
      deckSlide: 16,
      title: 'Get the Blood Flowing',
      subtitle: 'Gentle seated movement',
      prompt: 'Would you like to try a few gentle moves?',
      bullets: ['Shoulders', 'Hands', 'Comfort first'],
      visualHint: 'Source deck: Get the Blood Flowing to Your Brain',
      accent: '#A8C5A0',
      reply: () =>
        'Let us get the blood flowing to the brain with a few gentle seated movements. Would you like to try that with me?',
    },
    {
      id: 'childhood_birthplace',
      turns: 2,
      deckSlide: 17,
      title: 'Your Childhood',
      subtitle: 'Where it began',
      prompt: 'Where were you born?',
      bullets: ['Where you were born', 'Where you grew up', 'Places that shaped you'],
      visualHint: 'Source deck: Where were you born? Where did you grow up?',
      accent: '#F4C8B0',
      reply: () =>
        'Now let us wander back to childhood. Where were you born?',
      followUps: [
        () => 'And where did you grow up?',
      ],
    },
    {
      id: 'childhood_parents',
      turns: 1,
      deckSlide: 18,
      title: 'Your Childhood',
      subtitle: 'Family names',
      prompt: "What are your mother and father's names?",
      bullets: ['Mother', 'Father', 'Family memories'],
      visualHint: "Source deck: What are your mother and father's names?",
      accent: '#7A9DAD',
      reply: () =>
        "What are your mother and father's names?",
    },
    {
      id: 'childhood_siblings',
      turns: 1,
      deckSlide: 19,
      title: 'Your Childhood',
      subtitle: 'Brothers and sisters',
      prompt: 'Do you have any brothers or sisters?',
      bullets: ['Brothers', 'Sisters', 'Names'],
      visualHint: 'Source deck: Do you have any brothers or sisters?',
      accent: '#00AEEF',
      reply: () =>
        'Do you have any brothers or sisters? What are their names?',
    },
    {
      id: 'childhood_school',
      turns: 2,
      deckSlide: 20,
      title: 'Your Childhood',
      subtitle: 'School days',
      prompt: 'Where did you go to school?',
      bullets: ['School', 'Favourite subject', 'School memories'],
      visualHint: 'Source deck: Where did you go to school?',
      accent: '#A8C5A0',
      reply: () =>
        'Where did you go to school?',
      followUps: [
        () => 'What was your favourite subject at school?',
      ],
    },
    {
      id: 'childhood_first_job',
      turns: 1,
      deckSlide: 21,
      title: 'Your Childhood',
      subtitle: 'First work',
      prompt: 'My first job was...',
      bullets: ['First job', 'First chores', 'Early responsibility'],
      visualHint: 'Source deck: My first job was...',
      accent: '#F4C8B0',
      reply: () =>
        'Thinking back to when you were young, what was your first job, or one of the first jobs or chores you remember doing?',
    },
    {
      id: 'childhood_modern_family',
      turns: 1,
      deckSlide: 22,
      title: 'Modern Family',
      subtitle: 'Your opinion',
      prompt: 'What is your opinion of the modern family?',
      bullets: ['Then and now', 'Family changes', 'Your opinion'],
      visualHint: 'Source deck: What is your opinion of the modern family?',
      accent: '#7A9DAD',
      reply: () =>
        'Families can look quite different now compared with years ago. What is your opinion of the modern family?',
    },
    {
      id: 'childhood_getting_to_know_us',
      turns: 1,
      deckSlide: 23,
      title: 'Getting to Know Us',
      subtitle: 'A light question',
      prompt: 'A little more about you',
      bullets: ['Preferences', 'Stories', 'Shared conversation'],
      visualHint: 'Source deck: Getting to know us',
      accent: '#00AEEF',
      reply: () =>
        'Let us do a little getting-to-know-us question. What is something from childhood that still makes you smile when you think about it?',
    },
    {
      id: 'childhood_spin_question',
      turns: 1,
      deckSlide: 24,
      title: 'Question Wheel',
      subtitle: 'One more light prompt',
      prompt: 'Pick a question together',
      bullets: ['Memories', 'Preferences', 'Stories'],
      visualHint: 'Source deck: Spin wheel activity',
      accent: '#A8C5A0',
      reply: () =>
        'If we were spinning this question wheel together, I would choose a gentle one: what was one of your favourite things to do as a child?',
    },
    {
      id: 'childhood_summary',
      turns: 1,
      deckSlide: 25,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Summarise today', 'Theme song', 'Favourite moment'],
      visualHint: 'Source deck: Finally',
      accent: '#F4C8B0',
      reply: () =>
        'Finally, let us look back over what we have done today. What is one thing from our conversation that you would like to remember?',
    },
    {
      id: 'childhood_closing',
      turns: 1,
      deckSlide: 26,
      title: 'See You Then',
      subtitle: 'Next session: Physical Games',
      prompt: 'See you then',
      bullets: ['Thank you', 'Next session', 'Physical Games'],
      visualHint: 'Source deck: See you then',
      accent: '#7A9DAD',
      reply: ({ name }) =>
        `Thank you, ${name}. I have really enjoyed hearing about your childhood today. Our next session will be Physical Games. Take good care, and I will look forward to seeing you next time.`,
    },
  ],
};

export const getScript = (scriptId = 'cst_intro_reminiscence') =>
  scripts[scriptId] || scripts.cst_intro_reminiscence;

export const getScriptStep = (scriptId, stepIndex = 0) => {
  const script = getScript(scriptId);
  const boundedIndex = Math.min(Math.max(stepIndex, 0), script.length - 1);
  return {
    step: { slideFolder: scriptSlideFolders[scriptId] || 'session1', ...script[boundedIndex] },
    boundedIndex,
    isFinalStep: boundedIndex === script.length - 1,
    totalSteps: script.length,
  };
};

export const renderScriptReply = (step, context = {}) => {
  if (!step?.reply) return '';
  return typeof step.reply === 'function' ? step.reply(context) : String(step.reply);
};

export const renderScriptFollowUp = (step, followUpIndex, context = {}) => {
  const followUp = step?.followUps?.[followUpIndex];
  if (!followUp) return '';
  return typeof followUp === 'function' ? followUp(context) : String(followUp);
};
