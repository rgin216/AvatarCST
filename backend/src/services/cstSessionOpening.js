import {
  getCurrentNzYear,
  orientationRevealReply,
  seatedExerciseInteraction,
  spotifySongInteraction,
} from './cstScriptHelpers.js';

// Sessions 3 (Physical Games), 4 (Sounds), 6 (Current Affairs), and future topic
// sessions all open with the same run of slides: welcome, theme song, check-in,
// day/month/year/season orientation (with a reveal of only the real current NZ
// season - never all four), weather, an optional "current affairs" slide, a seated
// exercise, and a theme-intro transition. buildStandardSessionOpening() generates
// that whole run from one config object per session, instead of each session
// hand-copying and hand-numbering ~14-15 step objects.
//
// Fields that are already byte-identical across every existing session (day/month/
// year/weather prompts, the season question, accent colors) are hardcoded here.
// Fields that genuinely vary in wording per session (welcome, theme song, exercise
// intro, current-affairs framing, theme intro) are passed in explicitly by the
// caller - this builder never invents or rewrites spoken copy.

const ACCENTS = {
  welcome: '#00AEEF',
  themeSong: '#F47C20',
  checkIn: '#F47C20',
  day: '#7A9DAD',
  month: '#00AEEF',
  year: '#F4C8B0',
  yearReveal: '#4472C4',
  seasonQuestion: '#A8C5A0',
  weather: '#7A9DAD',
  currentAffairsSlide: '#00AEEF',
  exercise: '#4472C4',
  themeIntro: '#F47C20',
};

const SEASON_ORDER = ['winter', 'summer', 'autumn', 'spring'];

// Single source of truth for the four season-reveal slides. Previously copy-pasted
// as 4 near-identical step objects per session (12 total across Sessions 3/4/6).
export const SEASON_INFO = {
  winter: {
    title: 'Winter',
    bullets: ['Cool weather', 'Shorter days'],
    accent: '#7A9DAD',
    staticReply: 'That is winter, with cooler weather and shorter days.',
    revealDetail: 'Winter brings cooler weather and shorter days.',
  },
  summer: {
    title: 'Summer',
    bullets: ['Warm weather', 'Longer days'],
    accent: '#F47C20',
    staticReply: 'That is summer, with warmer weather and longer days.',
    revealDetail: 'Summer brings warmer weather and longer days.',
  },
  autumn: {
    title: 'Autumn',
    bullets: ['Changing leaves', 'Cooler days'],
    accent: '#F4C8B0',
    staticReply: 'That is autumn, when the leaves change and the days begin to cool.',
    revealDetail: 'In autumn, the leaves change and the days begin to cool.',
  },
  spring: {
    title: 'Spring',
    bullets: ['New growth', 'Warmer days'],
    accent: '#A8C5A0',
    staticReply: 'That is spring, with new growth and warmer days returning.',
    revealDetail: 'Spring brings new growth and warmer days returning.',
  },
};

/**
 * @param {object} config
 * @param {string} config.prefix - step id prefix, e.g. 'physical_games'
 * @param {string} config.deckLabel - source deck label, e.g. 'NZ03. Physical Games'
 * @param {number} [config.deckSlideStart=1] - first deckSlide number for this block
 * @param {{title: string, sessionNumber: number, sessionTitle: string, reply: Function}} config.welcome
 * @param {{title: string, subtitle: string, bullets: string[], reply: Function, interaction?: object}} config.themeSong
 * @param {{adaptiveFollowUp?: object}} [config.checkIn]
 * @param {boolean} [config.includeYearReveal=false] - Session 6 shows the year again as its own reveal slide
 * @param {{detail?: string}} [config.yearReveal]
 * @param {'static'|'dynamic'} [config.seasonReplyStyle='static'] - 'dynamic' acknowledges whether the patient's answer was right (used by Session 6)
 * @param {{adaptiveFollowUp?: object}} [config.weather]
 * @param {{subtitle: string, reply: Function}|null} [config.currentAffairsSlide] - omit (null) for the Current Affairs session itself
 * @param {{reply: Function, interaction?: object}} config.exercise
 * @param {{sessionTitle: string, bullets: string[]}} config.themeIntro
 * @returns {object[]} ordered step objects, ready to spread into a script array
 */
export const buildStandardSessionOpening = ({
  prefix,
  deckLabel,
  deckSlideStart = 1,
  welcome,
  themeSong,
  checkIn = {},
  includeYearReveal = false,
  yearReveal = {},
  seasonReplyStyle = 'static',
  weather = {},
  currentAffairsSlide = null,
  exercise,
  themeIntro,
}) => {
  let deckSlide = deckSlideStart;
  const nextDeckSlide = () => deckSlide++;
  const visualHint = (slide) => `Source deck: ${deckLabel}, slide ${slide}`;

  const steps = [];

  steps.push({
    id: `${prefix}_welcome`,
    turns: 1,
    acceptAnyAnswer: true,
    deckSlide: nextDeckSlide(),
    title: welcome.title,
    subtitle: `Session ${welcome.sessionNumber}: ${welcome.sessionTitle}`,
    prompt: 'Welcome back',
    bullets: [`Session ${welcome.sessionNumber}`, welcome.sessionTitle],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.welcome,
    reply: welcome.reply,
  });

  steps.push({
    id: `${prefix}_opening_song`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: themeSong.title,
    subtitle: themeSong.subtitle,
    prompt: 'Listen to your theme song',
    bullets: themeSong.bullets,
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.themeSong,
    interaction: themeSong.interaction || spotifySongInteraction(),
    recordAnswer: false,
    reply: themeSong.reply,
  });

  steps.push({
    id: `${prefix}_check_in`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'Check-in',
    subtitle: 'How are you doing today?',
    prompt: 'How are you doing today?',
    bullets: ['Take your time', 'Share as much as you like'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.checkIn,
    // There is no wrong answer here - accept whatever the patient says (matches
    // the acceptAnyAnswer + adaptiveFollowUp pattern used throughout Sessions 1/2)
    // instead of leaving advancement solely to the LLM's adequacy judgement, which
    // can flakily reject short-but-valid answers like "great" and loop the slide.
    acceptAnyAnswer: true,
    ...(checkIn.adaptiveFollowUp ? { adaptiveFollowUp: checkIn.adaptiveFollowUp } : {}),
    reply: () => 'Before we begin, how are you doing today?',
  });

  steps.push({
    id: `${prefix}_orientation_day`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'What day of the week is it?',
    subtitle: 'Getting our bearings',
    prompt: 'What day of the week is it?',
    bullets: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.day,
    reply: () => 'Let us get our bearings together. Do you happen to know what day of the week it is?',
  });

  steps.push({
    id: `${prefix}_orientation_month`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'What month are we enjoying?',
    subtitle: 'Getting our bearings',
    prompt: 'What month are we enjoying?',
    bullets: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.month,
    reply: () => 'And what month are we enjoying at the moment?',
  });

  steps.push({
    id: `${prefix}_orientation_year`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'What year is it?',
    subtitle: 'Getting our bearings',
    prompt: 'What year is it?',
    bullets: ['Year', 'Calendar', 'No pressure'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.year,
    reply: () => 'And do you happen to know what year it is?',
  });

  if (includeYearReveal) {
    const detail = yearReveal.detail || 'We can keep that date in view as we continue.';
    steps.push({
      id: `${prefix}_orientation_year_reveal`,
      turns: 1,
      deckSlide: nextDeckSlide(),
      get title() { return getCurrentNzYear(); },
      subtitle: 'The year we are enjoying',
      get prompt() { return getCurrentNzYear(); },
      get bullets() { return [getCurrentNzYear()]; },
      visualHint: visualHint(deckSlide - 1),
      accent: ACCENTS.yearReveal,
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      recordAnswer: false,
      reply: (context) => {
        const year = context.orientationExpectedAnswer || getCurrentNzYear();
        return orientationRevealReply({ answer: year, detail, context });
      },
    });
  }

  steps.push({
    id: `${prefix}_orientation_season`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'Which season are we enjoying?',
    subtitle: 'Getting our bearings',
    prompt: 'Which season are we enjoying?',
    bullets: ['Winter', 'Summer', 'Autumn', 'Spring'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.seasonQuestion,
    // Routed by the *actual* current NZ season (sessionOrchestratorService's
    // getRoutedNextStepIndex), not by the patient's answer - only the real
    // season's reveal slide below is ever shown.
    seasonBranches: Object.fromEntries(
      SEASON_ORDER.map((season) => [season, `${prefix}_season_${season}`])
    ),
    reply: () => 'Which season are we enjoying here in New Zealand?',
  });

  SEASON_ORDER.forEach((season) => {
    const info = SEASON_INFO[season];
    steps.push({
      id: `${prefix}_season_${season}`,
      turns: 1,
      deckSlide: nextDeckSlide(),
      title: info.title,
      subtitle: 'The season we are enjoying',
      prompt: info.title,
      bullets: info.bullets,
      visualHint: visualHint(deckSlide - 1),
      accent: info.accent,
      interaction: { type: 'autoAdvance' },
      isAnswerReveal: true,
      nextStepId: `${prefix}_weather`,
      recordAnswer: false,
      reply: seasonReplyStyle === 'dynamic'
        ? (context) => orientationRevealReply({ answer: season, detail: info.revealDetail, context })
        : () => info.staticReply,
    });
  });

  steps.push({
    id: `${prefix}_weather`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'The Weather Is...',
    subtitle: 'Outside today',
    prompt: 'What is the weather like?',
    bullets: ['Sunny', 'Cloudy', 'Windy', 'Rainy', 'Stormy', 'Hot or cold'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.weather,
    acceptAnyAnswer: true,
    ...(weather.adaptiveFollowUp ? { adaptiveFollowUp: weather.adaptiveFollowUp } : {}),
    reply: () => 'What is the weather like out your window today?',
  });

  if (currentAffairsSlide) {
    steps.push({
      id: `${prefix}_current_affairs`,
      turns: 1,
      deckSlide: nextDeckSlide(),
      title: 'Current Affairs',
      subtitle: currentAffairsSlide.subtitle,
      prompt: 'What do you think about that story?',
      bullets: ['New Zealand', 'Positive news', 'Ask for more'],
      visualHint: visualHint(deckSlide - 1),
      accent: ACCENTS.currentAffairsSlide,
      interaction: { type: 'positiveNews' },
      acceptAnyAnswer: true,
      reply: currentAffairsSlide.reply,
    });
  }

  steps.push({
    id: `${prefix}_exercise`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: 'Exercises',
    subtitle: 'Gentle follow along',
    prompt: 'Try a short seated exercise',
    bullets: ['Sit safely', 'Only do what feels comfortable', 'Press Done when finished'],
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.exercise,
    interaction: exercise.interaction || { ...seatedExerciseInteraction },
    recordAnswer: false,
    reply: exercise.reply,
  });

  steps.push({
    id: `${prefix}_theme_intro`,
    turns: 1,
    deckSlide: nextDeckSlide(),
    title: themeIntro.sessionTitle,
    subtitle: 'Our theme for today',
    prompt: themeIntro.sessionTitle,
    bullets: themeIntro.bullets,
    visualHint: visualHint(deckSlide - 1),
    accent: ACCENTS.themeIntro,
    interaction: { type: 'autoAdvance' },
    recordAnswer: false,
    reply: () => `Now it is time to move to our theme for today: ${themeIntro.sessionTitle}.`,
  });

  return steps;
};
