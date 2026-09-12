import { createFacesScenesScript } from './facesScenesScript.js';
﻿import {
  adaptiveConversation,
  adaptiveReminiscence,
  seatedExerciseInteraction,
  spotifySongInteraction,
} from './cstScriptHelpers.js';
import { buildStandardSessionOpening } from './cstSessionOpening.js';

const scriptSlideFolders = {
  cst_intro_reminiscence: 'session1',
  cst_childhood: 'session2',
  cst_physical_games: 'session3',
  cst_sounds: 'session4',
  cst_current_affairs: 'session6',
  cst_faces_scenes: 'session7',
};

const physicalGamesWheelOptions = [
  { label: 'Favorite Sport', question: 'What is a favourite sport you enjoy watching or playing?' },
  { label: 'Sports Team', question: 'Is there a sports team you especially like?' },
  { label: 'Sporting Memory', question: 'What sporting moment do you remember especially well?' },
  { label: 'School Games', question: 'What games or sports did you enjoy at school?' },
  { label: 'Walking', question: 'Is there a place where you especially enjoy going for a walk?' },
  { label: 'Swimming', question: 'Do you have any memories of swimming or being near the water?' },
  { label: 'Dancing', question: 'What kind of dancing or dance music do you enjoy?' },
  { label: 'Rugby', question: 'Do you enjoy rugby, or remember a rugby match that stood out?' },
  { label: 'Olympics', question: 'Which Olympic sport do you most enjoy watching?' },
  { label: 'Team Games', question: 'Do you prefer team games or individual activities?' },
  { label: 'Indoor Games', question: 'What indoor physical game or activity do you enjoy?' },
  { label: 'Outdoor Games', question: 'What outdoor game or activity do you enjoy?' },
  { label: 'Staying Active', question: 'What is your favourite way to stay active?' },
  { label: 'Sports on TV', question: 'What sport do you most enjoy watching on television?' },
  { label: 'A Proud Moment', question: 'Is there a physical activity or sporting moment that made you feel proud?' },
  { label: 'Summer Sport', question: 'What sport or activity do you associate with summer?' },
  { label: 'Winter Sport', question: 'What sport or activity do you associate with winter?' },
  { label: 'Exercise Music', question: 'Is there music that makes you want to move or dance?' },
  { label: 'Try Something New', question: 'Is there a physical activity you would like to try?' },
  { label: 'Then and Now', question: 'How have the games or activities you enjoy changed over the years?' },
];

const soundsWheelOptions = [
  { label: 'Favourite Music', question: 'What kind of music do you most enjoy listening to?' },
  { label: 'Favourite Song', question: 'Is there a song that means a lot to you?' },
  { label: 'A Concert', question: 'Have you ever been to a concert or live performance you remember well?' },
  { label: 'Dancing', question: 'What kind of dancing or dance music do you enjoy?' },
  { label: 'Radio', question: 'Did you listen to the radio much? What did you like to hear?' },
  { label: 'A Musician', question: 'Is there a singer or musician you have always admired?' },
  { label: 'Sounds of Home', question: 'What sounds remind you of the home you grew up in?' },
  { label: 'Sounds of Nature', question: 'Which sounds in nature do you find the most calming?' },
  { label: 'Singing', question: 'Did you ever sing, in a choir or just around the house?' },
  { label: 'An Instrument', question: 'Did you ever play a musical instrument, or wish you had?' },
  { label: 'Favourite Season', question: 'Which season do you enjoy the most, and why?' },
  { label: 'Where You Grew Up', question: 'What was the place where you grew up like?' },
  { label: 'A Favourite Trip', question: 'Is there a trip or holiday you look back on fondly?' },
  { label: 'Morning or Night', question: 'Are you more of a morning person or a night person?' },
  { label: 'Relaxing', question: 'What do you like to do to relax?' },
  { label: 'A Favourite Film', question: 'Is there a film you could watch again and again?' },
  { label: 'A Favourite Book', question: 'Is there a book that has stayed with you over the years?' },
  { label: 'Beach or Mountains', question: 'Do you prefer the beach, the mountains, or a lake?' },
  { label: 'Your Work', question: 'What kind of work did you do? What did you enjoy about it?' },
  { label: 'Someone You Admire', question: 'Is there someone you have always admired?' },
];

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
    ...buildStandardSessionOpening({
      prefix: 'current_affairs',
      deckLabel: 'NZ06. Current Affairs',
      welcome: {
        title: 'Virtual Cognitive Stimulation Therapy',
        sessionNumber: 6,
        sessionTitle: 'Current Affairs',
        reply: ({ name }) =>
          `Welcome back, ${name}. It is lovely to see you again. Today is our sixth session, and our theme is Current Affairs. We will look at how news reaches us and explore a few photographs together. There are no tests, and your ideas are what matter. When you are ready, say "I'm ready" to begin.`,
      },
      themeSong: {
        title: 'Welcome Back',
        subtitle: 'Your theme song',
        bullets: ['Welcome back', 'Theme song'],
        reply: ({ themeSong }) =>
          themeSong?.status === 'available'
            ? `Let us begin with your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to one minute. When you have finished listening, press Done, or say or type done.`
            : 'I could not find a saved theme song this time. Press Done, or say or type done, when you are ready to continue.',
      },
      checkIn: {
        adaptiveFollowUp: adaptiveConversation(
          'If they share a positive or neutral feeling with some personal detail, invite one concrete detail about what shaped their day. Do not follow up if they seem tired, distressed, or ready to continue.'
        ),
      },
      includeYearReveal: true,
      yearReveal: { detail: '' },
      seasonReplyStyle: 'dynamic',
      weather: {
        adaptiveFollowUp: adaptiveConversation(
          'If they add a meaningful detail, invite one brief sensory observation or a gentle comparison with weather they remember, without turning it into a factual test.'
        ),
      },
      currentAffairsSlide: null,
      exercise: {
        reply: () =>
          'Next is the same short seated exercise. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
      },
      themeIntro: {
        sessionTitle: 'Current Affairs',
        bullets: ['News', 'Photographs', 'Your opinions'],
      },
    }),
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
  cst_physical_games: [
    ...buildStandardSessionOpening({
      prefix: 'physical_games',
      deckLabel: 'NZ03. Physical Games',
      welcome: {
        title: 'AI-supported Individual Cognitive Stimulation Therapy',
        sessionNumber: 3,
        sessionTitle: 'Physical Games',
        reply: ({ name }) =>
          `Welcome back, ${name}. It is lovely to see you again. Today is our third session, and our theme will be Physical Games. When you are ready, say "I'm ready" to begin.`,
      },
      themeSong: {
        title: 'Theme Song',
        subtitle: 'Our song from Session 2',
        bullets: ['Theme song', 'Listen together'],
        reply: ({ themeSong }) =>
          themeSong?.status === 'available'
            ? `Let us begin with the theme song you chose last time, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to one minute. When you have finished listening, press Done, or say or type done.`
            : 'I could not find a saved theme song from last time. Press Done, or say or type done, when you are ready to continue.',
      },
      currentAffairsSlide: {
        subtitle: 'A different positive story',
        reply: ({ currentAffairs }) =>
          currentAffairs?.status === 'available'
            ? `Here is a different positive story from New Zealand: ${currentAffairs.article.title}. You can ask me to tell you more, or tell me what you think about it.`
            : 'I could not find a new positive New Zealand story just now. Have you heard anything pleasant or interesting lately?',
      },
      exercise: {
        reply: () =>
          'Next is the same short seated exercise. Please sit comfortably and safely on a sturdy chair. The video will start after I finish speaking. Only do what feels comfortable. When you are finished, press Done, or say or type done.',
      },
      themeIntro: {
        sessionTitle: 'Physical Games',
        bullets: ['Sports', 'Activities', 'Movement'],
      },
    }),
    {
      id: 'physical_games_favourite_sport',
      turns: 1,
      deckSlide: 16,
      title: 'Your Favourite Sport',
      subtitle: 'Playing and watching',
      prompt: 'What is your favourite sport?',
      bullets: ['Favourite sport', 'Sports you played'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 16',
      accent: '#A8C5A0',
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one gentle memory about playing, watching, a team, a person, or why the sport matters to them.'
      ),
      reply: () => 'What is your favourite sport? Did you play any sport yourself?',
    },
    {
      id: 'physical_games_non_competitive',
      turns: 1,
      deckSlide: 17,
      title: 'Physical Activities',
      subtitle: 'Without competition',
      prompt: 'Which non-competitive activity do you enjoy?',
      bullets: ['Walking', 'Gardening', 'Dancing', 'Swimming'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 17',
      accent: '#7A9DAD',
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite one detail about where, when, with whom, or how the activity feels.'
      ),
      reply: () => 'What physical activities do you enjoy that do not require competition?',
    },
    {
      id: 'physical_games_staying_active',
      turns: 1,
      deckSlide: 18,
      title: 'Staying Active',
      subtitle: 'Moving in ways you enjoy',
      prompt: 'What is your favourite way to stay active?',
      bullets: ['Gentle movement', 'Everyday activity'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 18',
      accent: '#00AEEF',
      adaptiveFollowUp: adaptiveReminiscence(
        'Invite a comfortable example, routine, setting, or reason they enjoy this way of staying active.'
      ),
      reply: () => 'What is your favourite way to stay active?',
    },
    {
      id: 'physical_games_action_preview',
      turns: 1,
      deckSlide: 19,
      title: '3-2-1 Action!',
      subtitle: 'Movement ideas',
      prompt: 'Movement ideas',
      bullets: ['Swimming', 'Rugby', 'Dancing', 'Basketball', 'Yoga', 'Weight lifting'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 19',
      accent: '#F4C8B0',
      interaction: {
        type: 'activityReveal',
        revealCount: 3,
        completionPrompt: 'Press “I have finished this action” when you are ready for the next card.',
        options: [
          {
            id: 'swimming',
            label: 'Swimming',
            gifUrl: '/activities/session3/swimming.gif',
            movementCue:
              'Stay seated and pretend you are swimming freestyle: reach one arm forward while the other sweeps gently back, then alternate your arms. Keep every movement within a comfortable range.',
          },
          {
            id: 'rugby',
            label: 'Rugby',
            gifUrl: '/activities/session3/rugby.gif',
            movementCue:
              'Stay seated and hold an imaginary rugby ball close to your chest with one arm. Gently extend your other arm forward with an open palm as though making a rugby fend, then bring it back.',
          },
          {
            id: 'dancing',
            label: 'Dancing',
            gifUrl: '/activities/session3/dancing.gif',
            movementCue:
              'Stay seated and try the upper-body part of the running man: bend both elbows and gently thrust both arms forward and back in rhythm. Keep your feet still and move only as much as feels comfortable.',
          },
          {
            id: 'basketball',
            label: 'Basketball',
            gifUrl: '/activities/session3/basketball.gif',
            movementCue:
              'Stay seated and imagine holding a basketball near your chest. Lift both hands upward as though dunking the ball, then lower them slowly. Do not reach higher than feels comfortable.',
          },
          {
            id: 'yoga',
            label: 'Yoga',
            gifUrl: '/activities/session3/yoga.gif',
            movementCue:
              'Stay seated, bring your palms together near your chest, then slowly lift your hands upward and open your arms out wide. Stop before any stretch feels uncomfortable.',
          },
          {
            id: 'weight-lifting',
            label: 'Weight Lifting',
            gifUrl: '/activities/session3/weight-lifting.gif',
            movementCue:
              'Stay seated and pretend you are holding very light dumbbells, with your hands near your shoulders. Gently press both hands upward and lower them slowly. Please do not use real weights for this activity.',
          },
        ],
      },
      recordAnswer: false,
      reply: () =>
        'Let us play 3-2-1 Action. Choose any three black activity cards, one at a time. When you reveal one, I will describe a gentle seated upper-body action for you to re-enact. Only move in ways that feel safe and comfortable. Select your first card when you are ready.',
    },
    {
      id: 'physical_games_scattergories',
      turns: 1,
      deckSlide: 20,
      title: 'Physical Games Scattergories',
      subtitle: 'Sports beginning with one letter',
      prompt: 'Which sports or physical games begin with your letter?',
      bullets: ['Find a pen and paper', 'Choose a letter', 'Make a list', 'Tell Aria your words'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 20',
      accent: '#F4C8B0',
      inactivityTimeoutMs: 4 * 60 * 1000,
      adaptiveFollowUp: adaptiveReminiscence(
        'If they listed one or more sports or physical games, ask whether they have ever played or done any of those activities. Otherwise, do not ask a follow-up.'
      ),
      reply: () =>
        'Do you have a pen and paper nearby? Choose a letter, or use the letter S if you would like a suggestion. Write down as many sports or physical games beginning with that letter as you can. When you are ready, tell me the words on your list. It is also fine to say, "I am not sure."',
    },
    {
      id: 'physical_games_olympic_intro',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 21,
      title: 'Olympic Trivia',
      subtitle: 'A gentle quiz',
      prompt: 'Are you ready for Olympic trivia?',
      bullets: ['Take your time', 'Guess if you like', 'It is okay to be unsure'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 21',
      accent: '#4472C4',
      reply: () =>
        'It is time for some Olympic trivia. These are just for fun, and it is completely alright to guess or say, "I am not sure." When you are ready, say ready.',
    },
    {
      id: 'physical_games_trivia_next_olympics',
      turns: 1,
      deckSlide: 22,
      title: 'Olympic Trivia',
      subtitle: 'The next Summer Olympics',
      prompt: 'When is the next Summer Olympics, and who is hosting it?',
      bullets: ['Year', 'Host city'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 22',
      accent: '#00AEEF',
      acceptAnyAnswer: true,
      reply: () => 'When is the next Summer Olympics, and who is hosting the next Summer Olympics?',
    },
    {
      id: 'physical_games_trivia_next_olympics_answer',
      turns: 1,
      deckSlide: 23,
      title: 'LA28',
      subtitle: 'Los Angeles 2028',
      prompt: 'Los Angeles 2028',
      bullets: ['Los Angeles', '2028 Summer Olympics'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 23',
      accent: '#F47C20',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () => 'The next Summer Olympics will be held in Los Angeles in 2028.',
    },
    {
      id: 'physical_games_trivia_uniform',
      turns: 1,
      deckSlide: 24,
      title: 'Olympic Trivia Question 1',
      subtitle: 'New Zealand sporting colour',
      prompt: "What colour has traditionally formed the base of New Zealand's Olympic sporting uniform?",
      bullets: ['New Zealand', 'Traditional sporting colour'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 24',
      accent: '#A8C5A0',
      acceptAnyAnswer: true,
      reply: () => "What colour has traditionally formed the base of New Zealand's Olympic sporting uniform?",
    },
    {
      id: 'physical_games_trivia_uniform_answer',
      turns: 1,
      deckSlide: 25,
      title: 'The Answer',
      subtitle: 'Black',
      prompt: 'Black',
      bullets: ['Black'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 25',
      accent: '#111111',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () => 'The answer is black.',
    },
    {
      id: 'physical_games_trivia_first_gold',
      turns: 1,
      deckSlide: 26,
      title: 'Olympic Trivia Question 2',
      subtitle: 'First individual gold',
      prompt: 'Who was the first New Zealander to win an individual Olympic gold medal?',
      bullets: ['New Zealand', 'Individual gold medal'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 26',
      accent: '#4472C4',
      acceptAnyAnswer: true,
      reply: () => 'Who was the first New Zealander to win an individual Olympic gold medal?',
    },
    {
      id: 'physical_games_trivia_first_gold_answer',
      turns: 1,
      deckSlide: 27,
      title: 'The Answer',
      subtitle: 'Ted Morgan',
      prompt: 'Ted Morgan',
      bullets: ['Welterweight boxing', 'Amsterdam 1928'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 27',
      accent: '#F4C8B0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () =>
        'The answer is Ted Morgan, who won welterweight boxing gold at the 1928 Amsterdam Olympics.',
    },
    {
      id: 'physical_games_trivia_runner',
      turns: 1,
      deckSlide: 28,
      title: 'Olympic Trivia Question 3',
      subtitle: 'A famous New Zealand runner',
      prompt: 'Who won Olympic gold in the 800 metres in 1960, then both the 800 and 1500 metres in 1964?',
      bullets: ['800 metres: 1960 and 1964', '1500 metres: 1964'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 28',
      accent: '#00AEEF',
      acceptAnyAnswer: true,
      reply: () =>
        'Which famous New Zealand athlete won Olympic gold in the 800 metres in 1960, then both the 800 and 1500 metres in 1964?',
    },
    {
      id: 'physical_games_trivia_runner_answer',
      turns: 1,
      deckSlide: 29,
      title: 'The Answer',
      subtitle: 'Peter Snell',
      prompt: 'Peter Snell',
      bullets: ['Peter Snell'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 29',
      accent: '#A8C5A0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () => 'The answer is Peter Snell.',
    },
    {
      id: 'physical_games_trivia_most_gold',
      turns: 1,
      deckSlide: 30,
      title: 'Olympic Trivia Question 4',
      subtitle: 'New Zealand gold medals',
      prompt: 'Through the Paris 2024 Olympic Games, in which sport has New Zealand won the most Olympic gold medals?',
      bullets: ['Through Paris 2024', 'New Zealand gold medals'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 30',
      accent: '#F47C20',
      acceptAnyAnswer: true,
      reply: () => 'Through the Paris 2024 Olympic Games, in which sport has New Zealand won the most Olympic gold medals?',
    },
    {
      id: 'physical_games_trivia_most_gold_answer',
      turns: 1,
      deckSlide: 31,
      title: 'The Answer',
      subtitle: 'Rowing',
      prompt: 'Rowing',
      bullets: ['Rowing'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 31',
      accent: '#7A9DAD',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () => 'The answer is rowing.',
    },
    {
      id: 'physical_games_trivia_carrington',
      turns: 1,
      deckSlide: 32,
      title: 'Olympic Trivia Question 5',
      subtitle: 'Lisa Carrington',
      prompt: 'How many gold medals did Lisa Carrington win at Tokyo 2020?',
      bullets: ['Lisa Carrington', 'Tokyo 2020'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 32',
      accent: '#4472C4',
      acceptAnyAnswer: true,
      reply: () =>
        'Lisa Carrington became New Zealand’s most decorated Olympian at Tokyo 2020. How many gold medals did she win at those Games alone?',
    },
    {
      id: 'physical_games_trivia_carrington_answer',
      turns: 1,
      deckSlide: 33,
      title: 'The Answer',
      subtitle: 'Three gold medals',
      prompt: 'Three',
      bullets: ['Three gold medals'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 33',
      accent: '#F4C8B0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () => 'The answer is three gold medals.',
    },
    {
      id: 'physical_games_spin_question',
      turns: 2,
      deckSlide: 34,
      title: 'Question Wheel',
      subtitle: 'Spin',
      prompt: 'Spin the wheel',
      bullets: ['Sports', 'Movement', 'Memories', 'Activities'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 34',
      accent: '#A8C5A0',
      interaction: {
        type: 'questionWheel',
        options: physicalGamesWheelOptions,
      },
      adaptiveFollowUp: adaptiveReminiscence(
        'Deepen the landed physical-games topic with one question about a memory, preference, reason, person, place, or then-versus-now comparison.'
      ),
      reply: () => 'Now we have the question wheel again. Press spin the wheel, and I will ask the question it lands on.',
      followUps: [
        ({ wheelQuestion }) => wheelQuestion || 'What question did the wheel land on?',
      ],
    },
    {
      id: 'physical_games_summary_song',
      turns: 2,
      deckSlide: 35,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Theme song', 'Summarise today'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 35',
      accent: '#F4C8B0',
      interaction: spotifySongInteraction({ summarizeOnComplete: true }),
      recordAnswer: false,
      reply: ({ themeSong }) =>
        themeSong?.status === 'available'
          ? `Before we look back over today, your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}, is ready to play again. When you have finished listening, press Done, or say or type done.`
          : 'Before we look back over today, I was not able to prepare the theme song this time. Press Done, or say or type done, when you are ready to continue.',
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'Today, you explored physical games and activities together.'} What is one part of today that you would like to remember?`,
      ],
    },
    {
      id: 'physical_games_closing',
      turns: 1,
      autoCompleteAfterNarration: true,
      deckSlide: 36,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 4: Sounds',
      prompt: 'See you next time',
      bullets: ['Thank you', 'Next session', 'Sounds'],
      visualHint: 'Source deck: NZ03. Physical Games, slide 36',
      accent: '#4472C4',
      recordAnswer: false,
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will explore Sounds. Take good care, and I will look forward to seeing you next time.`,
    },
  ],
  cst_sounds: [
    ...buildStandardSessionOpening({
      prefix: 'sounds',
      deckLabel: 'NZ04. Sounds',
      welcome: {
        title: 'AI-supported Individual Cognitive Stimulation Therapy',
        sessionNumber: 4,
        sessionTitle: 'Sounds',
        reply: ({ name }) =>
          `Welcome back, ${name}. It is lovely to see you again. Today is our fourth session, and our theme will be Sounds. When you are ready, say "I'm ready" to begin.`,
      },
      themeSong: {
        title: 'Theme Song',
        subtitle: 'Our song from an earlier session',
        bullets: ['Theme song', 'Listen together'],
        reply: ({ themeSong }) =>
          themeSong?.status === 'available'
            ? `Let us begin with the theme song you chose earlier, ${themeSong.track.name} by ${themeSong.track.artistLabel}. It can play for up to one minute. When you have finished listening, press Done, or say or type done.`
            : 'I could not find a saved theme song from an earlier session. Press Done, or say or type done, when you are ready to continue.',
      },
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
        sessionTitle: 'Sounds',
        bullets: ['Music', 'Instruments', 'Everyday sounds'],
      },
    }),
    {
      id: 'sounds_naming_instruments',
      turns: 1,
      deckSlide: 16,
      title: 'What Makes These Sounds?',
      subtitle: 'Listen and have a guess',
      prompt: 'What do you think makes each sound?',
      bullets: ['Three short clips', 'What could each one be?', 'It is fine to guess'],
      visualHint: 'Source deck: NZ04. Sounds, slide 16',
      accent: '#7A9DAD',
      // Advances only once all three sounds have an answer; re-prompts for the missing ones.
      namingSlots: { count: 3, labels: ['first', 'second', 'third'], noun: 'sound' },
      interaction: {
        type: 'audioClips',
        clips: [
          { id: 'sound-1', label: 'Sound 1', src: '/audio/session4/instrument-1.mp3' },
          { id: 'sound-2', label: 'Sound 2', src: '/audio/session4/instrument-2.mp3' },
          { id: 'sound-3', label: 'Sound 3', src: '/audio/session4/instrument-3.mp3' },
        ],
      },
      reply: () =>
        'On the slide are three short sounds. Have a listen to each one and tell me what you think is making it. It is completely fine to guess.',
    },
    {
      id: 'sounds_naming_instruments_answer',
      turns: 1,
      deckSlide: 17,
      title: 'The Sounds Were...',
      subtitle: 'What the clips had in common',
      prompt: 'They are all musical instruments',
      bullets: ['A trumpet', 'A bass guitar', 'An organ'],
      visualHint: 'Source deck: NZ04. Sounds, slide 17',
      accent: '#A8C5A0',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () =>
        'Those three sounds were a trumpet, a bass guitar, and an organ. What they have in common is that each one is a musical instrument.',
    },
    {
      id: 'sounds_trivia_1',
      turns: 1,
      deckSlide: 18,
      title: 'Can You Guess?',
      subtitle: 'How sound works',
      prompt: 'How is sound created, and how fast does it travel?',
      bullets: ['By heat, by our ears, or by vibrations', '435 km/hr, 300 km/second, or 1,200 km/hr'],
      visualHint: 'Source deck: NZ04. Sounds, slide 18',
      accent: '#00AEEF',
      acceptAnyAnswer: true,
      reply: () =>
        'It is time for some sound trivia. These are just for fun, and it is completely alright to guess or say, "I am not sure." First question: how is sound created? Is it by heat, by our ears, or by vibrations? And second: how fast does sound travel? Is it 435 kilometres per hour, 300 kilometres per second, or 1,200 kilometres per hour?',
    },
    {
      id: 'sounds_trivia_1_answer',
      turns: 1,
      deckSlide: 19,
      title: 'The Answers',
      subtitle: 'Vibrations, and about 1,200 km/hr',
      prompt: 'By vibrations; about 1,200 km/hr',
      bullets: ['Sound is created by vibrations', 'Sound travels through air at about 1,200 km/hr'],
      visualHint: 'Source deck: NZ04. Sounds, slide 19',
      accent: '#F47C20',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () =>
        'Sound is created by vibrations that travel as waves, and it moves through the air at about 1,200 kilometres per hour.',
    },
    {
      id: 'sounds_trivia_2',
      turns: 1,
      deckSlide: 20,
      title: 'Can You Guess?',
      subtitle: 'Echoes and silence',
      prompt: 'What is it called when sound bounces, and where can you not hear sound?',
      bullets: ['Echo, reflection, or vibration', 'Outside in open air, in space, or underwater'],
      visualHint: 'Source deck: NZ04. Sounds, slide 20',
      accent: '#A8C5A0',
      acceptAnyAnswer: true,
      reply: () =>
        'Next: what is it called when sound bounces off an object? Is it an echo, a reflection, or a vibration? And in which of these places could you not hear sound at all: outside in open air, in space, or underwater?',
    },
    {
      id: 'sounds_trivia_2_answer',
      turns: 1,
      deckSlide: 21,
      title: 'The Answers',
      subtitle: 'An echo, and space',
      prompt: 'An echo; in space',
      bullets: ['Sound bouncing off an object is an echo', 'You cannot hear sound in space'],
      visualHint: 'Source deck: NZ04. Sounds, slide 21',
      accent: '#4472C4',
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: () =>
        'When sound bounces off an object we call it an echo. And you could not hear sound in space, because a vacuum has no air for the sound waves to travel through.',
    },
    {
      id: 'sounds_name_that_tune_intro',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 22,
      title: 'Name That Tune',
      subtitle: 'Songs from different eras',
      prompt: 'Are you ready to name that tune?',
      bullets: ['1950s', '1960s', 'Motown 60s & 70s', 'Classical'],
      visualHint: 'Source deck: NZ04. Sounds, slide 22',
      accent: '#F4C8B0',
      reply: () =>
        'Now for a game called Name That Tune. I will play short clips from four different eras: the 1950s, the 1960s, Motown from the 1960s and 1970s, and some classical music. It is not a scored quiz, so please just guess or say, "I am not sure." Say ready when you would like to start.',
    },
    {
      id: 'sounds_name_that_tune_1950s',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 23,
      title: 'Name That Tune: 1950s',
      subtitle: 'Guess the song',
      prompt: 'Can you name this song or artist?',
      bullets: ['Have a listen', 'Any guess is welcome'],
      visualHint: 'Source deck: NZ04. Sounds, slide 23',
      accent: '#A8C5A0',
      // Canonical answer, revealed by the app after the participant's guess.
      tuneAnswer: 'Jailhouse Rock, by Elvis Presley',
      interaction: {
        type: 'audioClips',
        clips: [{ id: 'tune-1950s', label: 'Play the clip', src: '/audio/session4/tune-1950s.mp3' }],
      },
      reply: () =>
        'Here is the first clip, from the 1950s. Have a listen — can you name the song, or the artist who sang it?',
    },
    {
      id: 'sounds_name_that_tune_1960s',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 24,
      title: 'Name That Tune: 1960s',
      subtitle: 'Guess the song',
      prompt: 'Can you name this song or artist?',
      bullets: ['Have a listen', 'Any guess is welcome'],
      visualHint: 'Source deck: NZ04. Sounds, slide 24',
      accent: '#7A9DAD',
      tuneAnswer: 'Sympathy for the Devil, by The Rolling Stones',
      interaction: {
        type: 'audioClips',
        clips: [{ id: 'tune-1960s', label: 'Play the clip', src: '/audio/session4/tune-1960s.mp3' }],
      },
      reply: () =>
        'Now a clip from the 1960s. Have a listen — do you know the song or the artist?',
    },
    {
      id: 'sounds_name_that_tune_motown',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 25,
      title: 'Name That Tune: Motown',
      subtitle: 'The 1960s and 1970s',
      prompt: 'Can you name this song or artist?',
      bullets: ['Have a listen', 'Any guess is welcome'],
      visualHint: 'Source deck: NZ04. Sounds, slide 25',
      accent: '#F47C20',
      tuneAnswer: 'Superstition, by Stevie Wonder',
      interaction: {
        type: 'audioClips',
        clips: [{ id: 'tune-motown', label: 'Play the clip', src: '/audio/session4/tune-motown.mp3' }],
      },
      reply: () =>
        'Next up, a clip from Motown — the sound of the 1960s and 1970s. Have a listen — can you name the song or the artist?',
    },
    {
      id: 'sounds_name_that_tune_classical',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 26,
      title: 'Name That Tune: Classical',
      subtitle: 'Guess the piece',
      prompt: 'Can you name this piece or composer?',
      bullets: ['Have a listen', 'Any guess is welcome'],
      visualHint: 'Source deck: NZ04. Sounds, slide 26',
      accent: '#4472C4',
      tuneAnswer: 'Für Elise, by Beethoven',
      interaction: {
        type: 'audioClips',
        clips: [{ id: 'tune-classical', label: 'Play the clip', src: '/audio/session4/tune-classical.mp3' }],
      },
      reply: () =>
        'Last of all, a piece of classical music. Have a listen — can you name the piece, or the composer?',
    },
    {
      id: 'sounds_modern_music_opinion',
      turns: 1,
      acceptAnyAnswer: true,
      deckSlide: 27,
      title: 'Modern Music',
      subtitle: 'What do you think?',
      prompt: 'What is your opinion of this artist?',
      bullets: ['A more recent song', 'There is no right answer'],
      visualHint: 'Source deck: NZ04. Sounds, slide 27',
      accent: '#F4C8B0',
      interaction: {
        type: 'audioClips',
        clips: [{ id: 'tune-modern', label: 'Play the clip', src: '/audio/session4/tune-modern.mp3' }],
      },
      adaptiveFollowUp: adaptiveReminiscence(
        'Explore their opinion gently: what they like or dislike about it, or how it compares to music from their day.'
      ),
      reply: () =>
        'Here is a more recent song. I am not asking you to name it, just to tell me what you think of it. Have a listen — what is your opinion of this artist or song?',
    },
    {
      id: 'sounds_onomatopoeia',
      turns: 1,
      deckSlide: 28,
      title: 'Words That Are Sounds',
      subtitle: 'Onomatopoeia',
      prompt: 'Which sound words can you think of?',
      bullets: ['Words like boom or crash', 'Work through the alphabet from A', 'Tell Aria your words'],
      visualHint: 'Source deck: NZ04. Sounds, slide 28',
      accent: '#F4C8B0',
      inactivityTimeoutMs: 4 * 60 * 1000,
      adaptiveFollowUp: adaptiveReminiscence(
        'If they offered one or more sound words, you may ask once which one they like best or where they might hear it. Otherwise, do not ask a follow-up.'
      ),
      reply: () =>
        'Some words are sounds themselves, like boom, crash, or hiss. These are called onomatopoeia. Shall we build a list together, one letter at a time starting from A? What is a sound word beginning with A? It is also fine to say, "I am not sure."',
    },
    {
      id: 'sounds_spin_question',
      turns: 2,
      deckSlide: 29,
      title: 'Question Wheel',
      subtitle: 'Spin',
      prompt: 'Spin the wheel',
      bullets: ['Music', 'Memories', 'Places', 'Everyday life'],
      visualHint: 'Source deck: NZ04. Sounds, slide 29',
      accent: '#A8C5A0',
      interaction: {
        type: 'questionWheel',
        options: soundsWheelOptions,
      },
      adaptiveFollowUp: adaptiveReminiscence(
        'Deepen the landed topic with one question about a memory, preference, reason, person, place, or then-versus-now comparison.'
      ),
      reply: () => 'Now we have the question wheel. Press spin the wheel, and I will ask the question it lands on.',
      followUps: [
        ({ wheelQuestion }) => wheelQuestion || 'What question did the wheel land on?',
      ],
    },
    {
      id: 'sounds_summary_song',
      turns: 2,
      deckSlide: 30,
      title: 'Finally',
      subtitle: 'Looking back over today',
      prompt: 'What have we done today?',
      bullets: ['Theme song', 'Summarise today'],
      visualHint: 'Source deck: NZ04. Sounds, slide 30',
      accent: '#F4C8B0',
      interaction: spotifySongInteraction({ summarizeOnComplete: true }),
      recordAnswer: false,
      reply: ({ themeSong }) =>
        themeSong?.status === 'available'
          ? `Before we look back over today, your theme song, ${themeSong.track.name} by ${themeSong.track.artistLabel}, is ready to play again. When you have finished listening, press Done, or say or type done.`
          : 'Before we look back over today, I was not able to prepare the theme song this time. Press Done, or say or type done, when you are ready to continue.',
      followUps: [
        ({ sessionSummary }) =>
          `Now let us look back over what we have done today. ${sessionSummary || 'Today, you explored sounds, music, and instruments together.'} What is one part of today that you would like to remember?`,
      ],
    },
    {
      id: 'sounds_closing',
      turns: 1,
      autoCompleteAfterNarration: true,
      deckSlide: 31,
      title: 'The Theme of the Next Session',
      subtitle: 'Session 5: Food',
      prompt: 'See you next time',
      bullets: ['Thank you', 'Next session', 'Food'],
      visualHint: 'Source deck: NZ04. Sounds, slide 31',
      accent: '#4472C4',
      recordAnswer: false,
      reply: ({ name }) =>
        `That brings us to the end of today's session, ${name}. Our next session will explore Food. Take good care, and I will look forward to seeing you next time.`,
    },
  ],
};

scripts.cst_faces_scenes = createFacesScenesScript(scripts.cst_current_affairs);

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
