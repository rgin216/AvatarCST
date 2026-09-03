const scriptSlideFolders = {
  cst_intro_reminiscence: 'session1',
  cst_childhood: 'session2',
  cst_current_affairs: 'session6',
};

const adaptiveConversation = (guidance) => ({
  enabled: true,
  guidance,
});

const adaptiveReminiscence = adaptiveConversation;

const seatedExerciseInteraction = {
  type: 'youtubeShort',
  videoId: 'xVdKRNiAmqI',
  videoUrl: 'https://www.youtube.com/shorts/xVdKRNiAmqI',
  completionPrompt: 'When you are finished, press Done, or say or type "done" to continue.',
};

const spotifySongInteraction = ({ summarizeOnComplete = false } = {}) => ({
  type: 'spotifySong',
  playbackSeconds: 60,
  ...(summarizeOnComplete ? { summarizeOnComplete: true } : {}),
});

const orientationRevealReply = ({ answer, detail, context = {} }) => {
  const normalizedAnswer = String(answer).toLowerCase();
  const suppliedAnswer = String(context.orientationAnswer || '').toLowerCase();

  if (context.orientationOutcome === 'correct') {
    return `Yes, ${answer} is right. ${detail}`;
  }
  if (
    context.orientationOutcome === 'incorrect' &&
    normalizedAnswer === 'spring' &&
    /\bwinter\b/.test(suppliedAnswer)
  ) {
    return `Winter was an understandable answer because the seasons have only just changed. It is spring now. ${detail}`;
  }
  if (context.orientationOutcome === 'incorrect') {
    return `That was a reasonable try. It is ${answer}. ${detail}`;
  }
  if (context.orientationOutcome === 'unsure') {
    return `No problem. It is ${answer}. ${detail}`;
  }

  return `It is ${answer}. ${detail}`;
};

const currentAffairsWheelOptions = [
  { label: 'Favourite Sport', question: 'What is a favourite sport you enjoy watching or playing?' },
  { label: 'Sports Team', question: 'Is there a sports team you especially like?' },
  { label: 'Your Career', question: 'What part of your working life do you remember most clearly?' },
  { label: 'Where You Grew Up', question: 'What do you remember about the place where you grew up?' },
  { label: 'Beach, Mountain or Lake', question: 'Would you choose the beach, the mountains, or a lake?' },
  { label: 'Birthplace', question: 'What do you remember about the place where you were born?' },
  { label: 'Morning or Night', question: 'Are you more of a morning person or a night person?' },
  { label: 'How You Relax', question: 'What do you like to do to relax?' },
  { label: 'Favourite Book', question: 'Do you have a favourite book, or one you remember enjoying?' },
  { label: 'Chocolate or Vanilla', question: 'Would you choose chocolate or vanilla?' },
  { label: 'First Car', question: 'Do you remember your first car, or a car you especially liked?' },
  { label: 'What Motivates You', question: 'What helps motivate you?' },
  { label: 'Best Place Visited', question: 'What is one of the best places you have visited?' },
  { label: 'Who You Admire', question: 'Who is someone you admire?' },
  { label: 'Favourite Movie', question: 'Do you have a favourite movie?' },
  { label: 'Favourite Food', question: 'What is one of your favourite foods?' },
  { label: 'Favourite Trip', question: 'Do you remember a favourite trip or holiday?' },
  { label: 'Favourite Music', question: 'What kind of music do you most enjoy?' },
  { label: 'Favourite TV Show', question: 'Do you have a favourite television show?' },
  { label: 'Favourite Season', question: 'Which season do you enjoy most, and why?' },
];

const scripts = {
  cst_intro_reminiscence: [
    {
      id: 'welcome_opening',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 1,
      title: 'AI-supported Individual Cognitive Stimulation Therapy',
      subtitle: 'Session 1: Introduction & Welcome',
      prompt: 'How are you feeling right now?',
      bullets: ['Introduction & Welcome', 'AI-supported CST', 'University of Auckland'],
      visualHint: 'Source deck: NZ01. Welcome, slide 1',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveConversation(
        'If they share a positive or neutral feeling with a little personal detail, invite one concrete detail about what shaped their day. Do not follow up if they seem tired, distressed, or ready to move on.'
      ),
      reply: ({ name }) =>
        `Hello ${name}, and welcome. I am Aria, and I will be guiding you through this AI-supported Cognitive Stimulation Therapy session. Today is our first session, so we will take it gently and get comfortable together. How are you feeling today? Is there anything you’d like to share about your day so far?`,
    },
    {
      id: 'facilitator_role',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 2,
      title: 'Your AI-supported CST Facilitator',
      subtitle: 'What I am here to do',
      prompt: 'Do you have a nickname or preferred name?',
      bullets: ['Keep each other company', 'Try interesting questions', 'Enjoy fun conversations'],
      visualHint: 'Source deck: NZ01. Welcome, slide 2',
      accent: '#F47C20',
      reply: ({ name }) =>
        `My role is to keep you company, try some interesting questions with you, and enjoy some fun conversation together. There are no tests here and no right or wrong answers. I know your name is ${name}, but do you have a nickname or another name you would prefer me to call you?`,
    },
    {
      id: 'introduce_yourself',
      turns: 3,
      acceptAnyAnswer: true,
      deckSlide: 3,
      title: 'Introduce Yourself',
      subtitle: 'Getting to know you',
      prompt: 'Where do you live?',
      bullets: ['Where you live', "Who's at home with you", 'Computer or tablet comfort'],
      visualHint: 'Source deck: NZ01. Welcome, slide 3',
      accent: '#F4C8B0',
      adaptiveFollowUp: adaptiveConversation(
        'After the computer or tablet question, explore one concrete detail about what has felt easy, useful, or difficult today, without turning it into technical support.'
      ),
      reply: () =>
        'Thank you. I would love to learn a little more about you. Where do you live?',
      followUps: [
        () => "And who is at home with you these days?",
        () => 'And how are you finding using your computer or tablet today?',
      ],
    },
    {
      id: 'what_is_cst',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 4,
      title: 'What is CST?',
      subtitle: 'Cognitive Stimulation Therapy',
      prompt: 'What do you think about that?',
      bullets: ['Established group CST evidence', 'Developed at University College London', 'AI-supported research prototype'],
      visualHint: 'Source deck: NZ01. Welcome, slide 4',
      accent: '#A8C5A0',
      adaptiveFollowUp: adaptiveConversation(
        'Explore one part of their reaction to CST, such as what sounds reassuring, interesting, uncertain, or worthwhile to them.'
      ),
      reply: () =>
        'Traditional group Cognitive Stimulation Therapy, or CST, has an established evidence base for people living with mild to moderate dementia. It was developed at University College London and is designed to stimulate the mind in a supportive environment. This AI-supported one-to-one format is a research prototype guided by CST principles, rather than a replacement for clinical care. What do you think about that?',
    },
    {
      id: 'cst_interests',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 5,
      title: 'What is CST?',
      subtitle: 'What you may be interested in',
      prompt: 'Which of those sounds most useful or enjoyable to you?',
      bullets: ['Improving memory and thinking', 'Being with others experiencing similar changes', 'Sharing thoughts and ideas', 'Having some fun'],
      visualHint: 'Source deck: NZ01. Welcome, slide 5',
      accent: '#F47C20',
      adaptiveFollowUp: adaptiveConversation(
        'Invite one reason why their chosen benefit or activity matters to them, without suggesting that this prototype is proven to deliver a clinical outcome.'
      ),
      reply: () =>
        'People come to CST for different reasons. You may be interested in improving memory and thinking, being with others who understand similar changes, sharing thoughts and ideas, or simply having some fun. Which of those sounds most useful or enjoyable to you?',
    },
    {
      id: 'cst_nutshell',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 6,
      title: 'CST in a Nutshell',
      subtitle: 'The spirit of our sessions',
      prompt: 'Which of those ideas do you like best?',
      bullets: ['Mental stimulation', 'Opinions rather than facts', 'New ideas and associations'],
      visualHint: 'Source deck: NZ01. Welcome, slide 6',
      accent: '#F47C20',
      adaptiveFollowUp: adaptiveConversation(
        'Invite one brief reason or example connected to the idea they chose, keeping the focus on their opinion rather than factual knowledge.'
      ),
      reply: () =>
        'In a nutshell, CST is about gentle mental stimulation, your opinions rather than facts, and exploring new ideas, thoughts, and associations. Which of those ideas do you like best?',
    },
    {
      id: 'session_themes',
      turns: 1,
      acceptAnyAnswer: true,
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
      acceptAnyAnswer: true,
      deckSlide: 8,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 2: Getting To Know You (Childhood)',
      prompt: 'What part would you like to remember?',
      bullets: ['Session 2', 'Getting To Know You', 'Childhood'],
      visualHint: 'Source deck: NZ01. Welcome, slide 8',
      accent: '#4472C4',
      reply: ({ sessionSummary }) =>
        `This has been a lovely first session. Thank you for your company and for sharing your thoughts. ${sessionSummary || 'Today, we got to know a little about you and introduced what CST will be like.'} Next time, our theme will be Getting To Know You, with a focus on childhood. Before we finish, what is one part of today that you would like to remember?`,
      completionReply: () =>
        'It was great sharing thoughts and ideas with you, and I am looking forward to our next session on Getting To Know You, focusing on childhood.',
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
        `Welcome back, ${name}. It is lovely to see you again. Today our theme is getting to know you, especially memories from childhood. When you are ready, say "I'm ready" to begin.`,
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
        'How are you doing today?',
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
          ? `Here is a positive story from New Zealand: ${currentAffairs.article.title}. You can ask me to tell you more, or tell me what you think about it.`
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
        ...seatedExerciseInteraction,
      },
      recordAnswer: false,
      reply: () =>
        'Next is a short seated exercise. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. If it does not, press play. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
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
      adaptiveFollowUp: adaptiveReminiscence(
        'After birthplace and where they grew up, invite one concrete place, sensory, community, or then-versus-now memory.'
      ),
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
      adaptiveFollowUp: adaptiveReminiscence(
        'If comfortable, invite one warm memory, characteristic, shared activity, or family tradition connected to a parent.'
      ),
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
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one shared activity, childhood memory, similarity, or difference involving their siblings without probing conflict.'
      ),
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
      adaptiveFollowUp: adaptiveReminiscence(
        'After school and favourite subject, invite one teacher, classroom memory, reason for the preference, or gentle then-versus-now comparison.'
      ),
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
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one task, feeling, person, lesson, or comparison with how similar work is done today.'
      ),
      reply: () =>
        'Thinking back to when you were young, what was your first job, or one of the first jobs or chores you remember doing?',
    },
    {
      id: 'childhood_modern_family',
      turns: 1,
      deckSlide: 16,
      title: 'Modern Family',
      subtitle: 'Your opinion',
      prompt: 'Have you seen the television show Modern Family, or have you only heard of it? If you have seen it, what did you think of it? If not, is there another television comedy you remember enjoying?',
      bullets: ['Television comedy', 'Characters and stories', 'Your opinion'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 16',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveReminiscence(
        'Distinguish viewers from people who have only heard of the show. Only ask viewers about its characters, stories, or humour. For non-viewers, acknowledge that gently and optionally invite another television comedy they remember enjoying.'
      ),
      reply: () =>
        'There is a television comedy called Modern Family. Have you seen it, or have you only heard of it? If you have seen it, what did you think? If not, is there another television comedy you remember enjoying?',
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
          { label: 'A proud moment', question: 'What is something you have done that made you feel proud?' },
          { label: 'Childhood games', question: 'What game did you especially enjoy playing as a child?' },
          { label: 'Beach, Mountain or Lake', question: 'Would you choose the beach, the mountains, or a lake?' },
          { label: 'Childhood treats', question: 'Was there a special treat you enjoyed as a child?' },
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
          { label: 'Favorite Celebration', question: 'What celebration or special occasion do you remember enjoying?' },
          { label: 'Favorite TV Show', question: 'Do you have a favourite TV show?' },
          { label: 'Childhood Toy', question: 'Was there a toy or treasured object you especially remember from childhood?' },
        ],
      },
      adaptiveFollowUp: adaptiveReminiscence(
        'Deepen the landed topic with one question about specifics, reasons, personal meaning, associated memories, or a past-versus-present comparison.'
      ),
      reply: () =>
        'Now we have a question wheel. Press spin the wheel, and I will ask the question it lands on.',
      followUps: [
        ({ wheelQuestion }) => wheelQuestion || 'What question did the wheel land on?',
      ],
    },
    {
      id: 'childhood_summary_song',
      turns: 2,
      deckSlide: 19,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Summarise today', 'Theme song'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 19',
      accent: '#F4C8B0',
      interaction: spotifySongInteraction({ summarizeOnComplete: true }),
      recordAnswer: false,
      reply: ({ themeSong }) =>
        themeSong?.status === 'available'
          ? `Before we look back over today, your song, ${themeSong.track.name} by ${themeSong.track.artistLabel}, is ready. It can play for up to one minute. When you have finished listening, press Done, or say or type done.`
          : 'Before we look back over today, I was not able to prepare the song this time. Press Done, or say or type done, when you are ready to continue.',
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'We shared a few moments from today together.'} What is one part of today that you would like to remember?`,
      ],
    },
    {
      id: 'childhood_closing',
      turns: 1,
      autoCompleteAfterNarration: true,
      deckSlide: 20,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 3: Physical Games',
      prompt: 'See you next time',
      bullets: ['Thank you', 'Next session', 'Physical Games'],
      visualHint: 'Source deck: NZ02. Getting to Know You (Childhood), slide 20',
      accent: '#4472C4',
      recordAnswer: false,
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will be Physical Games. Take good care, and I will look forward to seeing you next time.`,
    },
  ],
  cst_current_affairs: [
    {
      id: 'current_affairs_welcome',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 1,
      title: 'Virtual Cognitive Stimulation Therapy',
      subtitle: 'Session 6: Current Affairs',
      prompt: 'Welcome back',
      bullets: ['Session 6', 'Current Affairs'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 1',
      accent: '#00AEEF',
      reply: ({ name }) =>
        `Welcome back, ${name}. It is lovely to see you again. Today is our sixth session, and our theme is Current Affairs. We will look at how news reaches us and explore a few photographs together. There are no tests, and your ideas are what matter. When you are ready, say "I'm ready" to begin.`,
    },
    {
      id: 'current_affairs_opening_song',
      turns: 1,
      deckSlide: 2,
      title: 'Welcome Back',
      subtitle: 'Your theme song',
      prompt: 'Listen to your theme song',
      bullets: ['Welcome back', 'Theme song'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 2',
      accent: '#F47C20',
      interaction: spotifySongInteraction(),
      recordAnswer: false,
      reply: ({ themeSong }) =>
        themeSong?.status === 'available'
          ? `Let us begin with your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to one minute. When you have finished listening, press Done, or say or type done.`
          : 'I could not find a saved theme song this time. Press Done, or say or type done, when you are ready to continue.',
    },
    {
      id: 'current_affairs_check_in',
      turns: 1,
      deckSlide: 3,
      title: 'Check-in',
      subtitle: 'How are you doing today?',
      prompt: 'How are you doing today?',
      bullets: ['Take your time', 'Share as much as you like'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 3',
      accent: '#F47C20',
      adaptiveFollowUp: adaptiveConversation(
        'If they share a positive or neutral feeling with some personal detail, invite one concrete detail about what shaped their day. Do not follow up if they seem tired, distressed, or ready to continue.'
      ),
      reply: () => 'Before we begin, how are you doing today?',
    },
    {
      id: 'current_affairs_orientation_day',
      turns: 1,
      deckSlide: 4,
      title: 'What day of the week is it?',
      subtitle: 'Getting our bearings',
      prompt: 'What day of the week is it?',
      bullets: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 4',
      accent: '#7A9DAD',
      reply: () => 'Let us get our bearings together. Do you happen to know what day of the week it is?',
    },
    {
      id: 'current_affairs_orientation_month',
      turns: 1,
      deckSlide: 5,
      title: 'What month are we enjoying?',
      subtitle: 'Getting our bearings',
      prompt: 'What month are we enjoying?',
      bullets: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 5',
      accent: '#00AEEF',
      reply: () => 'And what month are we enjoying at the moment?',
    },
    {
      id: 'current_affairs_orientation_year',
      turns: 1,
      deckSlide: 6,
      title: 'What year is it?',
      subtitle: 'Getting our bearings',
      prompt: 'What year is it?',
      bullets: ['Year', 'Calendar', 'No pressure'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 6',
      accent: '#F4C8B0',
      reply: () => 'And do you happen to know what year it is?',
    },
    {
      id: 'current_affairs_orientation_year_reveal',
      turns: 1,
      deckSlide: 7,
      title: '2026',
      subtitle: 'The year we are enjoying',
      prompt: '2026',
      bullets: ['2026'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 7',
      accent: '#4472C4',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: (context) => orientationRevealReply({
        answer: '2026',
        detail: 'We can keep that date in view as we continue.',
        context,
      }),
    },
    {
      id: 'current_affairs_orientation_season',
      turns: 1,
      deckSlide: 8,
      title: 'Which season are we enjoying?',
      subtitle: 'Getting our bearings',
      prompt: 'Which season are we enjoying?',
      bullets: ['Winter', 'Summer', 'Autumn', 'Spring'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 8',
      accent: '#A8C5A0',
      seasonBranches: {
        winter: 'current_affairs_season_winter',
        summer: 'current_affairs_season_summer',
        autumn: 'current_affairs_season_autumn',
        spring: 'current_affairs_season_spring',
      },
      reply: () => 'Which season are we enjoying here in New Zealand?',
    },
    {
      id: 'current_affairs_season_winter',
      turns: 1,
      deckSlide: 9,
      title: 'Winter',
      subtitle: 'The season we are enjoying',
      prompt: 'Winter',
      bullets: ['Cool weather', 'Shorter days'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 9',
      accent: '#7A9DAD',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      nextStepId: 'current_affairs_weather',
      recordAnswer: false,
      reply: (context) => orientationRevealReply({
        answer: 'winter',
        detail: 'Winter brings cooler weather and shorter days.',
        context,
      }),
    },
    {
      id: 'current_affairs_season_summer',
      turns: 1,
      deckSlide: 10,
      title: 'Summer',
      subtitle: 'The season we are enjoying',
      prompt: 'Summer',
      bullets: ['Warm weather', 'Longer days'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 10',
      accent: '#F47C20',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      nextStepId: 'current_affairs_weather',
      recordAnswer: false,
      reply: (context) => orientationRevealReply({
        answer: 'summer',
        detail: 'Summer brings warmer weather and longer days.',
        context,
      }),
    },
    {
      id: 'current_affairs_season_autumn',
      turns: 1,
      deckSlide: 11,
      title: 'Autumn',
      subtitle: 'The season we are enjoying',
      prompt: 'Autumn',
      bullets: ['Changing leaves', 'Cooler days'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 11',
      accent: '#F4C8B0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      nextStepId: 'current_affairs_weather',
      recordAnswer: false,
      reply: (context) => orientationRevealReply({
        answer: 'autumn',
        detail: 'In autumn, the leaves change and the days begin to cool.',
        context,
      }),
    },
    {
      id: 'current_affairs_season_spring',
      turns: 1,
      deckSlide: 12,
      title: 'Spring',
      subtitle: 'The season we are enjoying',
      prompt: 'Spring',
      bullets: ['New growth', 'Warmer days'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 12',
      accent: '#A8C5A0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      nextStepId: 'current_affairs_weather',
      recordAnswer: false,
      reply: (context) => orientationRevealReply({
        answer: 'spring',
        detail: 'Spring brings new growth and warmer days returning.',
        context,
      }),
    },
    {
      id: 'current_affairs_weather',
      turns: 1,
      deckSlide: 13,
      title: 'The Weather Is...',
      subtitle: 'Outside today',
      prompt: 'What is the weather like?',
      bullets: ['Sunny', 'Cloudy', 'Windy', 'Rainy', 'Stormy', 'Hot or cold'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 13',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveConversation(
        'If they add a meaningful detail, invite one brief sensory observation or a gentle comparison with weather they remember, without turning it into a factual test.'
      ),
      reply: () => 'What is the weather like out your window today?',
    },
    {
      id: 'current_affairs_exercise',
      turns: 1,
      deckSlide: 14,
      title: 'Exercises',
      subtitle: 'Gentle follow along',
      prompt: 'Try a short seated exercise',
      bullets: ['Sit safely', 'Only do what feels comfortable', 'Press Done when finished'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 14',
      accent: '#4472C4',
      interaction: { ...seatedExerciseInteraction },
      recordAnswer: false,
      reply: () =>
        'Next is the same short seated exercise. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
    },
    {
      id: 'current_affairs_theme_intro',
      turns: 1,
      deckSlide: 15,
      title: 'Current Affairs',
      subtitle: 'Our theme for today',
      prompt: 'Current Affairs',
      bullets: ['News', 'Photographs', 'Your opinions'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 15',
      accent: '#F47C20',
      interaction: { type: 'autoAdvance' },
      recordAnswer: false,
      reply: () => 'Now it is time to move to our theme for today: Current Affairs.',
    },
    {
      id: 'current_affairs_news_sources',
      turns: 1,
      deckSlide: 16,
      title: 'How Do You Keep Up With the News?',
      subtitle: 'News then and now',
      prompt: 'How do you keep up with the news?',
      bullets: ['Newspapers', 'Radio', 'Television', 'Online'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 16',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveConversation(
        'Invite one reason they trust, enjoy, or prefer that news source, or one gentle comparison with how they followed news in earlier years.'
      ),
      reply: () =>
        'People can now follow the news in many ways, including newspapers, radio, television, and online. How do you usually keep up with the news?',
    },
    {
      id: 'current_affairs_moon_notice',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 17,
      title: 'What Do You Notice?',
      subtitle: 'A grainy historic image',
      prompt: 'What do you notice in this image?',
      bullets: ['Look closely', 'There is no wrong answer'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 17',
      accent: '#4472C4',
      imageGuidance: {
        confirmedDetails: ['grainy black-and-white image', 'astronauts', 'spacesuits', 'figures on the Moon'],
        clarification: 'Astronauts are visible, but Apollo 11 should not be named until the story step.',
      },
      reply: () =>
        'Take your time looking at this grainy black-and-white image. What do you notice?',
    },
    {
      id: 'current_affairs_moon_identify',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 17,
      title: 'What Do You Notice?',
      subtitle: 'Looking more closely',
      prompt: 'Can you make out what the photograph shows?',
      bullets: ['Shapes', 'People', 'Place'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 17',
      accent: '#4472C4',
      imageGuidance: {
        confirmedDetails: ['astronauts', 'spacesuits', 'figures on the lunar surface'],
        clarification: 'Confirm visible details without naming Apollo 11 before the scripted explanation.',
      },
      reply: () =>
        'The picture is not very clear, so there is no pressure to identify it. Can you make out what the photograph shows?',
    },
    {
      id: 'current_affairs_moon_story',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 17,
      title: 'Apollo 11',
      subtitle: 'The first Moon landing',
      prompt: 'What do you remember about the Moon landing?',
      bullets: ['Apollo 11', 'July 1969', 'Neil Armstrong and Buzz Aldrin'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 17',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveReminiscence(
        'If they remember the Moon landing, invite one detail about where they were, who they were with, how they heard the news, or how it felt. If they do not remember it, invite their opinion about the achievement instead.'
      ),
      reply: () =>
        'This is a television image from Apollo 11, the first crewed Moon landing in July 1969. Neil Armstrong and Buzz Aldrin walked on the Moon while Michael Collins remained in orbit, and people around the world followed the event through live broadcasts. Do you remember hearing about the Moon landing, or what do you think of that achievement?',
    },
    {
      id: 'current_affairs_news_then_and_now',
      turns: 2,
      acceptAnyAnswer: true,
      deckSlide: 18,
      title: 'How Is News Reported Differently Today?',
      subtitle: 'From newspapers and radio to television and online news',
      prompt: 'How did you follow the news in earlier years?',
      bullets: ['Newspapers', 'Radio', 'Television', 'Online'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 18',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveReminiscence(
        'After both scripted questions, invite one concrete memory or reason connected to their preferred news source, without judging whether one medium is better.'
      ),
      reply: () =>
        'Years ago, newspapers and radio were often the main ways people received the news. How did you usually follow the news in earlier years?',
      followUps: [
        () => 'Times have changed. Do you still read a newspaper, or do you now prefer radio, television, or another way of following the news?',
      ],
    },
    {
      id: 'current_affairs_positive_news',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 18,
      title: 'A Positive Story From Aotearoa Today',
      subtitle: 'A current headline from our news service',
      prompt: 'What do you think about this story?',
      bullets: ['A recent New Zealand story', 'Your thoughts', 'Ask for more if you wish'],
      visualHint: 'Live positive-news interlude after source deck slide 18',
      accent: '#A8C5A0',
      interaction: { type: 'positiveNews' },
      adaptiveFollowUp: adaptiveConversation(
        'Invite one reaction to the current story. If they ask for more, use only the vetted article details supplied by the news service; never invent missing facts.'
      ),
      reply: ({ currentAffairs }) =>
        currentAffairs?.status === 'available'
          ? `Here is a recent positive story from New Zealand: ${currentAffairs.article.title}. You can ask me to tell you more, or tell me what you think about it.`
          : 'I could not find a clearly positive New Zealand story just now. Have you heard anything pleasant or interesting lately?',
    },
    {
      id: 'current_affairs_doctors_notice',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 19,
      title: "What's Going On in This Picture?",
      subtitle: 'People gathered outside a hospital',
      prompt: 'What do you think is happening?',
      bullets: ['People', 'Signs', 'Hospital'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 19',
      accent: '#F47C20',
      imageGuidance: {
        confirmedDetails: ['people outside a hospital', 'doctors or hospital staff', 'signs', 'a protest or strike gathering'],
        clarification: 'Affirm hospital, staff, signs, protest, or strike observations without adding motives beyond the caption.',
      },
      reply: () =>
        'Here is another news photograph. What do you notice, and what do you think might be happening?',
    },
    {
      id: 'current_affairs_doctors_story',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 20,
      title: 'Wellington Doctors Take Strike Action',
      subtitle: 'Recruitment and patient care',
      prompt: 'What is your reaction to this story?',
      bullets: ['Hospital doctors', 'Staff recruitment', 'Patient care'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 20',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveConversation(
        'Explore their opinion about staffing, patient care, or peaceful public action. Do not debate politics, assume personal medical experiences, or press if they prefer to move on.'
      ),
      reply: () =>
        'The caption explains that these Wellington hospital doctors were defending nationwide strike action over recruitment, saying they were struggling to look after patients. What is your reaction to that story?',
    },
    {
      id: 'current_affairs_airport_notice',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 21,
      title: "What's Going On in This Picture?",
      subtitle: 'A group in matching uniforms',
      prompt: 'What do you think is happening?',
      bullets: ['Uniforms', 'Workplace', 'People'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 21',
      accent: '#A8C5A0',
      imageGuidance: {
        confirmedDetails: ['a group of people', 'matching orange uniforms', 'airport or passenger-service staff'],
        clarification: 'They are passenger-service staff rather than flight attendants.',
      },
      reply: () =>
        'What do you notice about the people in this photograph, and where do you think they might be?',
    },
    {
      id: 'current_affairs_airport_story',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 22,
      title: 'Fresh Faces for New Flights',
      subtitle: 'Hamilton Airport',
      prompt: 'What do you think about this development?',
      bullets: ['Hamilton Airport', 'New staff', 'International terminal'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 22',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one memory or opinion about flying, airports, travel, or seeing a place become better connected. Do not assume they have flown.'
      ),
      reply: () =>
        'The story introduces newly hired passenger-service staff at the blessing of Hamilton Airport’s refurbished international terminal, as the airport prepared for new flights. What do you think about that development?',
    },
    {
      id: 'current_affairs_ship_fire_notice',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 23,
      title: "What's Going On in This Picture?",
      subtitle: 'Firefighters at night',
      prompt: 'What do you notice in this image?',
      bullets: ['Firefighters', 'Water', 'A vessel'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 23',
      accent: '#F47C20',
      imageGuidance: {
        confirmedDetails: ['flames or fire', 'firefighters', 'water', 'a ship or vessel at night'],
        clarification: 'The burning object is a historic ship, not a crashed road vehicle.',
      },
      reply: () =>
        'This is a more serious photograph. What do you notice? It is also fine to move on if you would rather not discuss it.',
    },
    {
      id: 'current_affairs_ship_fire_story',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 24,
      title: 'Fire on the Historic Ship The Tui',
      subtitle: 'Paihia',
      prompt: 'What stands out to you about this story?',
      bullets: ['Historic ship', 'Firefighters', 'Investigation'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 24',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveConversation(
        'If they want to discuss it, focus on the work of the firefighters, the value of historic objects, or community reactions. Avoid graphic detail and do not speculate about the cause.'
      ),
      reply: () =>
        'The caption says firefighters were working to extinguish a blaze on the historic ship The Tui near the Waitangi Bridge in Paihia, and that an investigation was under way. What stands out to you about this story?',
    },
    {
      id: 'current_affairs_bridge_notice',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 25,
      title: 'What Do You Notice?',
      subtitle: 'Auckland Harbour Bridge',
      prompt: 'What do you notice in this photograph?',
      bullets: ['Bridge', 'Waitematā Harbour', 'Auckland'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 25',
      accent: '#4472C4',
      imageGuidance: {
        confirmedDetails: ['a large bridge', 'water and harbour surroundings', 'the Auckland Harbour Bridge over the Waitematā Harbour'],
        clarification: 'If the person is unsure whether it is in New Zealand or America, acknowledge the uncertainty without inventing what they imagined.',
      },
      reply: () =>
        'Take a look at this black-and-white photograph. What do you notice about the bridge and the area around it?',
    },
    {
      id: 'current_affairs_bridge_history',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 25,
      title: 'Auckland Harbour Bridge',
      subtitle: 'A link since 1959',
      prompt: 'Do you have a memory connected with the bridge?',
      bullets: ['Opened 30 May 1959', 'Four original lanes', 'Eight lanes after the clip-ons'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 25',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one memory of crossing the bridge, taking the ferry, visiting the North Shore, seeing Auckland change, or hearing about the bridge. Do not treat dates as a recall test.'
      ),
      reply: () =>
        'This is the Auckland Harbour Bridge across the Waitematā. It opened on 30 May 1959 with four traffic lanes, replacing the ferry as the main direct vehicle link to the North Shore. Traffic grew so quickly that two Japanese-built clip-on sections were added between 1966 and 1969, doubling it to eight lanes. Do you have any memories of crossing the bridge or seeing Auckland change around it?',
    },
    {
      id: 'current_affairs_bridge_future',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 25,
      title: 'Auckland Harbour Bridge',
      subtitle: 'Its current role and a possible second crossing',
      prompt: 'What do you think Auckland should do next?',
      bullets: ['About 170,000 vehicle crossings daily', 'Ongoing maintenance', 'Bridge and tunnel options'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 25',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveConversation(
        'Explore their opinion about maintaining the bridge, adding a tunnel or bridge, resilience, travel, or how Auckland has grown. Make clear that the final additional-crossing decision has not been made.'
      ),
      reply: () =>
        'Today the bridge remains an eight-lane part of State Highway 1, carrying about 170,000 vehicles each day while crews maintain the ageing structure. Auckland has discussed another harbour crossing for many years. In August 2026, the NZ Transport Agency board preferred a tunnel, but Cabinet had not selected a final option. A detailed business case is now examining the crossing options, funding, and delivery. What do you think Auckland should do next?',
    },
    {
      id: 'current_affairs_spin_question',
      turns: 2,
      deckSlide: 26,
      title: 'Question Wheel',
      subtitle: 'Spin',
      prompt: 'Spin the wheel',
      bullets: ['Preferences', 'Places', 'Memories', 'Everyday life'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 26',
      accent: '#A8C5A0',
      interaction: {
        type: 'questionWheel',
        options: currentAffairsWheelOptions,
      },
      adaptiveFollowUp: adaptiveReminiscence(
        'Deepen the landed topic with one question about a specific memory, preference, reason, person, place, or then-versus-now comparison.'
      ),
      reply: () =>
        'Now we have the question wheel again. Press spin the wheel, and I will ask the question it lands on.',
      followUps: [
        ({ wheelQuestion }) => wheelQuestion || 'What question did the wheel land on?',
      ],
    },
    {
      id: 'current_affairs_summary_song',
      turns: 2,
      deckSlide: 27,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Theme song', 'Summarise today'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 27',
      accent: '#F4C8B0',
      interaction: spotifySongInteraction({ summarizeOnComplete: true }),
      recordAnswer: false,
      reply: ({ themeSong }) =>
        themeSong?.status === 'available'
          ? `Before we look back over today, your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}, is ready to play again. When you have finished listening, press Done, or say or type done.`
          : 'Before we look back over today, I was not able to prepare the theme song this time. Press Done, or say or type done, when you are ready to continue.',
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'Today, you explored news, historic photographs, and how Auckland has changed.'} What is one part of today that you would like to remember?`,
      ],
    },
    {
      id: 'current_affairs_closing',
      turns: 1,
      autoCompleteAfterNarration: true,
      deckSlide: 28,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 7: Faces and Scenes',
      prompt: 'See you next time',
      bullets: ['Thank you', 'Next session', 'Faces and Scenes'],
      visualHint: 'Source deck: NZ06. Current Affairs, slide 28',
      accent: '#4472C4',
      recordAnswer: false,
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will explore Faces and Scenes. Thank you, ka kite anō, and I will look forward to seeing you next time.`,
    },
  ],
};

export const getScript = (scriptId = 'cst_intro_reminiscence') =>
  scripts[scriptId] || scripts.cst_intro_reminiscence;

export const getScriptStepIndex = (scriptId, stepId) =>
  getScript(scriptId).findIndex((step) => step.id === stepId);

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
