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
      title: 'AI-supported Individual Cognitive Stimulation Therapy',
      subtitle: 'Session 2: Getting to Know You (Childhood)',
      prompt: 'Welcome back',
      bullets: ['Session 2', 'Getting to Know You', 'Childhood'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 1',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Welcome back, ${name}. It is lovely to see you again. Today our theme is getting to know you, especially memories from childhood. When you are ready, we will begin with a quick check-in. Respond with "I'm ready" when you are ready to start.`,
    },
    {
      id: 'childhood_check_in',
      turns: 1,
      deckSlide: 2,
      title: 'Theme Song',
      subtitle: 'Check in',
      prompt: 'How are you doing today?',
      bullets: ['Theme song', 'Check in', 'How are you doing today?'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 2',
      accent: '#F47C20',
      reply: () =>
        'Before we get into our childhood theme, let us check in gently. How are you doing today?',
    },
    {
      id: 'theme_song_choice',
      turns: 1,
      deckSlide: 3,
      title: 'Theme Song',
      subtitle: 'A song to begin and end with',
      prompt: 'Is there a song you like to sing or play?',
      bullets: ['Favourite song', 'Beginning of session', 'End of session'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 3',
      accent: '#F47C20',
      reply: () =>
        'Is there a song you like to sing or play at the beginning and at the end of each session? If you know the artist too, please tell me their name.',
    },
    {
      id: 'childhood_orientation_day',
      turns: 1,
      deckSlide: 4,
      title: 'What day of the week is it?',
      subtitle: 'Getting our bearings',
      prompt: 'What day of the week is it?',
      bullets: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 4',
      accent: '#7A9DAD',
      reply: () =>
        'Let us get our bearings together. Do you happen to know what day of the week it is?',
    },
    {
      id: 'childhood_orientation_month',
      turns: 1,
      deckSlide: 5,
      title: 'What month are we enjoying?',
      subtitle: 'Getting our bearings',
      prompt: 'What month are we enjoying?',
      bullets: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 5',
      accent: '#00AEEF',
      reply: () =>
        'And what month are we enjoying at the moment?',
    },
    {
      id: 'childhood_orientation_year',
      turns: 1,
      deckSlide: 6,
      title: 'What year is it?',
      subtitle: 'Getting our bearings',
      prompt: 'What year is it?',
      bullets: ['Year', 'Calendar', 'No pressure'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 6',
      accent: '#F4C8B0',
      reply: () =>
        'And do you happen to know what year it is?',
    },
    {
      id: 'childhood_orientation_season',
      turns: 1,
      deckSlide: 7,
      title: 'Which season are we enjoying?',
      subtitle: 'Getting our bearings',
      prompt: 'Which season are we enjoying?',
      bullets: ['Spring', 'Summer', 'Autumn', 'Winter'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 7',
      accent: '#A8C5A0',
      reply: () =>
        'Which season are you enjoying where you are?',
    },
    {
      id: 'childhood_weather',
      turns: 1,
      deckSlide: 8,
      title: 'The Weather Is...',
      subtitle: 'Outside today',
      prompt: 'What is the weather like?',
      bullets: ['Sunny', 'Cloudy', 'Windy', 'Rainy', 'Stormy', 'Hot or cold'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 8',
      accent: '#7A9DAD',
      reply: () =>
        'What is the weather like out your window today?',
    },
    {
      id: 'childhood_current_affairs',
      turns: 1,
      deckSlide: 9,
      title: 'Current Affairs',
      subtitle: 'Big or small news',
      prompt: 'Have you heard anything interesting lately?',
      bullets: ['Local news', 'Weather', 'Sport', 'Something pleasant'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 9',
      accent: '#00AEEF',
      interaction: {
        type: 'positiveNews',
      },
      reply: ({ currentAffairs }) =>
        currentAffairs?.status === 'available'
          ? `Here is a positive story from New Zealand: ${currentAffairs.article.title}. What do you think about that?`
          : 'I could not find a clearly positive New Zealand story just now. Have you heard anything pleasant or interesting lately?',
    },
    {
      id: 'childhood_exercise_follow_along',
      turns: 1,
      deckSlide: 10,
      title: 'Exercises',
      subtitle: 'Gentle follow along',
      prompt: 'Would you like to try a short seated exercise?',
      bullets: ['Sit safely on a chair', 'Press play when ready', 'Only do what feels comfortable'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 10',
      accent: '#4472C4',
      interaction: {
        type: 'youtubeShort',
        videoId: 'xVdKRNiAmqI',
        videoUrl: 'https://www.youtube.com/shorts/xVdKRNiAmqI',
        completionPrompt: 'When you are finished, or if you would prefer to skip, say or type "done" to continue.',
      },
      reply: () =>
        'Next is a short seated exercise. Before starting, please make sure you are seated comfortably and safely on a sturdy chair. When you are ready, press the play button, and only do movements that feel comfortable for you. When you are finished, or if you would prefer to skip it, just say or type done to continue.',
    },
    {
      id: 'childhood_birthplace',
      turns: 2,
      deckSlide: 11,
      title: 'Your Childhood',
      subtitle: 'Where it began',
      prompt: 'Where were you born?',
      bullets: ['Where you were born', 'Where you grew up'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 11',
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
      deckSlide: 12,
      title: 'Your Childhood',
      subtitle: 'Family names',
      prompt: "What are your mother and father's names?",
      bullets: ['Mother', 'Father', 'Family memories'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 12',
      accent: '#7A9DAD',
      reply: () =>
        "What are your mother and father's names?",
    },
    {
      id: 'childhood_siblings',
      turns: 1,
      deckSlide: 13,
      title: 'Your Childhood',
      subtitle: 'Brothers and sisters',
      prompt: 'Do you have any brothers or sisters?',
      bullets: ['Brothers', 'Sisters', 'Names'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 13',
      accent: '#00AEEF',
      reply: () =>
        'Do you have any brothers or sisters? What are their names?',
    },
    {
      id: 'childhood_school',
      turns: 2,
      deckSlide: 14,
      title: 'Your Childhood',
      subtitle: 'School days',
      prompt: 'Where did you go to school?',
      bullets: ['School', 'Favourite subject', 'School memories'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 14',
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
      deckSlide: 15,
      title: 'Your Childhood',
      subtitle: 'First work',
      prompt: 'My first job was...',
      bullets: ['First job', 'First chores', 'Early responsibility'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 15',
      accent: '#F4C8B0',
      reply: () =>
        'Thinking back to when you were young, what was your first job, or one of the first jobs or chores you remember doing?',
    },
    {
      id: 'childhood_modern_family',
      turns: 1,
      deckSlide: 16,
      title: 'Modern Family',
      subtitle: 'Your opinion',
      prompt: 'What is your opinion of the modern family?',
      bullets: ['Then and now', 'Family changes', 'Your opinion'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 16',
      accent: '#7A9DAD',
      reply: () =>
        'Families can look quite different now compared with years ago. What is your opinion of the modern family?',
    },
    {
      id: 'childhood_about_aria',
      turns: 1,
      deckSlide: 17,
      title: 'Getting to Know Us',
      subtitle: 'About Aria',
      prompt: 'What would you like to know about me?',
      bullets: ['AI-supported CST', 'Research project', 'University of Auckland'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 17',
      accent: '#00AEEF',
      reply: () =>
        'This is a nice moment for you to get to know me too. I am Aria, an AI-supported CST facilitator being developed as part of a research project at the University of Auckland to explore how technology can support warm, individual CST conversations. What would you like to know about me?',
    },
    {
      id: 'childhood_spin_question',
      turns: 2,
      deckSlide: 18,
      title: 'Question Wheel',
      subtitle: 'Spin',
      prompt: 'Spin the wheel',
      bullets: ['Favourite things', 'Places', 'Memories', 'Family', 'School'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 18',
      accent: '#A8C5A0',
      interaction: {
        type: 'questionWheel',
        options: [
          { label: 'Favorite Sports Team', question: 'Do you have a favourite sports team, or a sport you enjoy watching?' },
          { label: 'Favorite Sport', question: 'What is a favourite sport you enjoy watching or playing?' },
          { label: 'Tell us about your career', question: 'Can you tell me a little about your career or the work you have done?' },
          { label: 'Where did you grow up?', question: 'Where did you grow up?' },
          { label: 'Beach, Mountain or Lake', question: 'Would you choose the beach, the mountains, or a lake?' },
          { label: 'Where were you born?', question: 'Where were you born?' },
          { label: 'Morning or Night?', question: 'Are you more of a morning person or a night person?' },
          { label: 'What do you do to relax?', question: 'What do you like to do to relax?' },
          { label: 'Favorite Book?', question: 'Do you have a favourite book, or a book you remember enjoying?' },
          { label: 'Chocolate or Vanilla?', question: 'Would you choose chocolate or vanilla?' },
          { label: 'First Car?', question: 'Do you remember your first car, or a car you especially liked?' },
          { label: 'What motivates you?', question: 'What helps motivate you?' },
          { label: 'Best place visited?', question: 'What is one of the best places you have visited?' },
          { label: 'Who do you admire?', question: 'Who is someone you admire?' },
          { label: 'Favorite Movie', question: 'Do you have a favourite movie?' },
          { label: 'Favorite Food', question: 'What is one of your favourite foods?' },
          { label: 'Favorite Trip', question: 'Do you remember a favourite trip or holiday?' },
          { label: 'Favorite Music', question: 'What kind of music do you especially enjoy?' },
          { label: 'Favorite TV Show', question: 'Do you have a favourite TV show?' },
          { label: 'Favorite Season', question: 'Which season is your favourite?' },
        ],
      },
      reply: () =>
        'Now we have a question wheel. Press spin the wheel, and I will ask the question it lands on.',
      followUps: [
        ({ wheelQuestion }) => wheelQuestion || 'What question did the wheel land on?',
      ],
    },
    {
      id: 'childhood_summary_song',
      turns: 1,
      deckSlide: 19,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Summarise today', 'Theme song'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 19',
      accent: '#F4C8B0',
      interaction: {
        type: 'spotifySong',
        playbackSeconds: 30,
      },
      reply: ({ sessionSummary, themeSong }) => {
        const musicPrompt = themeSong?.status === 'available'
          ? `Your song, ${themeSong.track.name} by ${themeSong.track.artistLabel}, is ready. Press play on the slide when you would like to hear it.`
          : 'I was not able to prepare the song this time, but we can still look back over our conversation.';
        return `Finally, let us look back over what we have done today. ${sessionSummary || 'We shared a few moments from today together.'} ${musicPrompt} What is one part of today that you would like to remember?`;
      },
    },
    {
      id: 'childhood_closing',
      turns: 1,
      deckSlide: 20,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 3: Physical Games',
      prompt: 'See you next time',
      bullets: ['Thank you', 'Next session', 'Physical Games'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 20',
      accent: '#4472C4',
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
