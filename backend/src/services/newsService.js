const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2/top-headlines';
const NEWS_API_EVERYTHING_URL =
  process.env.NEWS_API_EVERYTHING_URL || 'https://newsapi.org/v2/everything';
const DEFAULT_CACHE_MINUTES = 30;
const REQUEST_TIMEOUT_MS = 6_000;
const RECENT_NEWS_DAYS = 7;
const DEFAULT_NZ_NEWS_DOMAINS = [
  'rnz.co.nz',
  'nzherald.co.nz',
  'stuff.co.nz',
  '1news.co.nz',
  'newsroom.co.nz',
  'odt.co.nz',
  'thespinoff.co.nz',
].join(',');

const POSITIVE_PATTERNS = [
  /\bachiev(?:e|es|ed|ement|ements)\b/i,
  /\baward(?:s|ed)?\b/i,
  /\bboost(?:s|ed|ing)?\b/i,
  /\bbreakthrough\b/i,
  /\bcelebrat(?:e|es|ed|ing|ion)\b/i,
  /\bchampion(?:s|ship)?\b/i,
  /\bcommunity\b/i,
  /\bconservation\b/i,
  /\bcreat(?:e|es|ed|ing)\b/i,
  /\bdiscover(?:y|ies|ed)\b/i,
  /\bfunding\b/i,
  /\bgrowth\b/i,
  /\bhonou?r(?:s|ed)?\b/i,
  /\bimprov(?:e|es|ed|ement|ements|ing)\b/i,
  /\binspir(?:e|es|ed|ing)\b/i,
  /\blaunch(?:es|ed)?\b/i,
  /\bmilestone\b/i,
  /\bopen(?:s|ed|ing)\b/i,
  /\brare\b/i,
  /\brecord\b/i,
  /\brecover(?:s|ed|y|ies|ing)\b/i,
  /\brecognis(?:e|es|ed|ing)\b/i,
  /\breopen(?:s|ed|ing)?\b/i,
  /\brestor(?:e|es|ed|ation|ing)\b/i,
  /\breturn(?:s|ed|ing)?\b/i,
  /\breunit(?:e|es|ed|ing)\b/i,
  /\bsuccess(?:ful|fully)?\b/i,
  /\bsupport(?:s|ed|ing)?\b/i,
  /\bthriv(?:e|es|ed|ing)\b/i,
  /\bvolunteer(?:s|ed|ing)?\b/i,
  /\bwelcom(?:e|es|ed|ing)\b/i,
  /\bwin(?:s|ning)?\b/i,
  /\bvictor(?:y|ies|ious)\b/i,
];

const BLOCKED_PATTERNS = [
  /\babuse\b/i,
  /\barrest(?:s|ed)?\b/i,
  /\bassault(?:s|ed)?\b/i,
  /\battack(?:s|ed)?\b/i,
  /\bblaze\b/i,
  /\bbomb(?:s|ed|ing)?\b/i,
  /\bcancer\b/i,
  /\bcharg(?:e|es|ed)\b/i,
  /\bclosure(?:s)?\b/i,
  /\bconflict\b/i,
  /\bcourt\b/i,
  /\bcrash(?:es|ed)?\b/i,
  /\bcrime(?:s)?\b/i,
  /\bcrisis\b/i,
  /\bcyclone\b/i,
  /\bdead\b/i,
  /\bdeath(?:s)?\b/i,
  /\bdefeat(?:s|ed)?\b/i,
  /\bdie(?:s|d)?\b/i,
  /\bdisaster\b/i,
  /\bdisease\b/i,
  /\bdrought\b/i,
  /\bearthquake\b/i,
  /\bemergency\b/i,
  /\belection\b/i,
  /\bevacuat(?:e|es|ed|ion)\b/i,
  /\bexplosion\b/i,
  /\bfatal(?:ity|ities)?\b/i,
  /\bfire\b/i,
  /\bflood(?:s|ed|ing)?\b/i,
  /\bfraud\b/i,
  /\bfuneral\b/i,
  /\bgovernment\b/i,
  /\bgrief\b/i,
  /\bhomeless(?:ness)?\b/i,
  /\bhospitalis(?:e|es|ed|ation)\b/i,
  /\binjur(?:y|ies|ed)\b/i,
  /\binvasion\b/i,
  /\bkidnap(?:s|ped|ping)?\b/i,
  /\bkill(?:s|ed|ing)?\b/i,
  /\blandslide(?:s)?\b/i,
  /\blayoff(?:s)?\b/i,
  /\blose(?:s)?\b/i,
  /\bloss(?:es)?\b/i,
  /\bminister\b/i,
  /\bmissing\b/i,
  /\bmourn(?:s|ed|ing)?\b/i,
  /\bmurder(?:s|ed)?\b/i,
  /\boutbreak\b/i,
  /\bparliament\b/i,
  /\bpolitic(?:s|al|ian|ians)\b/i,
  /\bpoverty\b/i,
  /\bprison\b/i,
  /\bprotest(?:s|ed|ing)?\b/i,
  /\brape\b/i,
  /\brecession\b/i,
  /\breject(?:s|ed|ing)?\b/i,
  /\bremov(?:e|es|ed|ing)\b/i,
  /\bscam(?:s|med)?\b/i,
  /\bself[- ]harm\b/i,
  /\bshoot(?:s|ing|ings)?\b/i,
  /\bstorm(?:s)?\b/i,
  /\bstrike(?:s)?\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bthunderstorm(?:s)?\b/i,
  /\bthreat(?:s|ened)?\b/i,
  /\btraged(?:y|ies)\b/i,
  /\btrial\b/i,
  /\bvictim(?:s)?\b/i,
  /\bviolen(?:ce|t)\b/i,
  /\bwar\b/i,
  /\bwarning(?:s)?\b/i,
];

let cachedNews = null;
let cacheExpiresAt = 0;

const getCacheMilliseconds = () => {
  const configuredMinutes = Number.parseInt(process.env.NZ_NEWS_CACHE_MINUTES || '', 10);
  const minutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_CACHE_MINUTES;
  return minutes * 60 * 1000;
};

const cleanText = (value = '', maxLength = 240) =>
  String(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+[^-]{2,60}$/, '')
    .trim()
    .slice(0, maxLength);

const safeHttpUrl = (value = '') => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const safePublishedAt = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const countMatches = (patterns, text) =>
  patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);

export const scorePositiveArticle = (article = {}) => {
  const title = cleanText(article.title, 180);
  const description = cleanText(article.description, 300);
  if (!title || title === '[Removed]') return Number.NEGATIVE_INFINITY;

  const combinedText = `${title} ${description}`;
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    return Number.NEGATIVE_INFINITY;
  }

  return countMatches(POSITIVE_PATTERNS, title) * 3
    + countMatches(POSITIVE_PATTERNS, description);
};

export const isSuitablePositiveArticle = (article = {}) =>
  scorePositiveArticle(article) >= 3 && Boolean(safeHttpUrl(article.url));

const normalizeArticle = (article) => ({
  title: cleanText(article.title, 180),
  description: cleanText(article.description, 260),
  url: safeHttpUrl(article.url),
  imageUrl: safeHttpUrl(article.urlToImage),
  source: cleanText(article.source?.name || 'New Zealand news', 80),
  publishedAt: safePublishedAt(article.publishedAt),
});

export const selectPositiveArticle = (articles = []) =>
  articles
    .filter(isSuitablePositiveArticle)
    .sort((left, right) => {
      const scoreDifference = scorePositiveArticle(right) - scorePositiveArticle(left);
      if (scoreDifference !== 0) return scoreDifference;
      return new Date(right.publishedAt || 0) - new Date(left.publishedAt || 0);
    })
    .map(normalizeArticle)[0] || null;

const unavailableResult = (reason) => ({
  status: 'unavailable',
  article: null,
  reason,
  message: 'No clearly positive New Zealand story is available right now.',
});

const fetchArticles = async ({ endpoint, params, apiKey, signal }) => {
  const requestUrl = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => requestUrl.searchParams.set(key, value));

  const response = await fetch(requestUrl, {
    headers: { 'X-Api-Key': apiKey },
    signal,
  });
  if (!response.ok) throw new Error(`News API request failed with ${response.status}`);

  const payload = await response.json();
  if (payload.status !== 'ok') {
    throw new Error(`News API request failed: ${payload.code || 'unknown error'}`);
  }
  return Array.isArray(payload.articles) ? payload.articles : [];
};

export const getPositiveNzNews = async () => {
  const now = Date.now();
  if (cachedNews && cacheExpiresAt > now) return cachedNews;

  const apiKey = process.env.NEWS_API_KEY?.trim();
  if (!apiKey) return unavailableResult('not-configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const topHeadlines = await fetchArticles({
      endpoint: NEWS_API_URL,
      params: { country: 'nz', pageSize: '100' },
      apiKey,
      signal: controller.signal,
    });
    let article = selectPositiveArticle(topHeadlines);
    let sourceScope = 'nz-top-headlines';

    if (!article) {
      const configuredDomains = process.env.NZ_NEWS_DOMAINS?.trim();
      const recentFrom = new Date(now - RECENT_NEWS_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const localPublisherArticles = await fetchArticles({
        endpoint: NEWS_API_EVERYTHING_URL,
        params: {
          domains: configuredDomains || DEFAULT_NZ_NEWS_DOMAINS,
          from: recentFrom,
          language: 'en',
          sortBy: 'publishedAt',
          pageSize: '100',
        },
        apiKey,
        signal: controller.signal,
      });
      article = selectPositiveArticle(localPublisherArticles);
      sourceScope = 'nz-publishers';
    }

    cachedNews = article
      ? {
          status: 'available',
          article,
          fetchedAt: new Date().toISOString(),
          filter: 'strict-positive',
          sourceScope,
        }
      : unavailableResult('no-suitable-headline');
    cacheExpiresAt = now + getCacheMilliseconds();
    return cachedNews;
  } catch (error) {
    console.warn('[news] Positive NZ headline unavailable:', error.message);
    return unavailableResult('request-failed');
  } finally {
    clearTimeout(timeout);
  }
};
