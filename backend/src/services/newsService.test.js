import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPositiveNzNews,
  isSuitablePositiveArticle,
  resetPositiveNewsCacheForTests,
  selectPositiveArticle,
  selectPositiveArticles,
} from './newsService.js';

const article = (overrides = {}) => ({
  title: 'Community celebrates native bird conservation milestone',
  description: 'Volunteers welcomed record numbers of birds back to the sanctuary.',
  url: 'https://example.test/story',
  source: { name: 'Example News' },
  publishedAt: '2026-07-30T08:00:00Z',
  ...overrides,
});

test('accepts a clearly positive story', () => {
  assert.equal(isSuitablePositiveArticle(article()), true);
});

test('rejects a story containing a sensitive topic even with positive language', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      title: 'Community celebrates fundraising milestone after fatal crash',
    })),
    false
  );
});

test('rejects adverse weather or rejection stories with incidental positive wording', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      title: 'Community event returns as thunderstorms approach',
    })),
    false
  );
  assert.equal(
    isSuitablePositiveArticle(article({
      title: 'Minister rejects support proposal',
    })),
    false
  );
});

test('rejects neutral headlines without a clear positive signal', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      title: 'Council publishes its annual transport report',
      description: 'The document covers road use during the past year.',
    })),
    false
  );
});

test('selects the strongest suitable story and returns display-safe fields', () => {
  const selected = selectPositiveArticle([
    article({
      title: 'School publishes annual report',
      description: 'The report is now available.',
    }),
    article(),
  ]);

  assert.equal(selected.title, 'Community celebrates native bird conservation milestone');
  assert.equal(selected.source, 'Example News');
});

test('keeps suitable stories in ranked order for sequential use', () => {
  const selected = selectPositiveArticles([
    article({
      title: 'Community celebrates school garden success',
      url: 'https://example.test/second-story',
      publishedAt: '2026-07-29T08:00:00Z',
    }),
    article(),
  ]);

  assert.equal(selected.length, 2);
  assert.equal(selected[0].url, 'https://example.test/story');
  assert.equal(selected[1].url, 'https://example.test/second-story');
});

test('discards article detail when NewsAPI reports that it was truncated', () => {
  const selected = selectPositiveArticle([
    article({
      content: 'The sanctuary recorded its highest number of returning birds this year. [+124 chars]',
    }),
  ]);

  assert.equal(selected.content, '');
});

const mockNewsResponse = (articles) => ({
  ok: true,
  json: async () => ({ status: 'ok', articles }),
});

test('reports when positive news is not configured without fetching', async (t) => {
  resetPositiveNewsCacheForTests();
  const previousApiKey = process.env.NEWS_API_KEY;
  delete process.env.NEWS_API_KEY;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => mockNewsResponse([]));

  try {
    const result = await getPositiveNzNews();
    assert.equal(result.reason, 'not-configured');
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    if (previousApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('reports failed NewsAPI requests', async (t) => {
  resetPositiveNewsCacheForTests();
  const previousApiKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = 'test-key';
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('network unavailable');
  });

  try {
    const result = await getPositiveNzNews();
    assert.equal(result.reason, 'request-failed');
  } finally {
    if (previousApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('falls back from NZ headlines to local publishers', async (t) => {
  resetPositiveNewsCacheForTests();
  const previousApiKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = 'test-key';
  let requestCount = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    requestCount += 1;
    return requestCount === 1
      ? mockNewsResponse([])
      : mockNewsResponse([article()]);
  });

  try {
    const result = await getPositiveNzNews();
    assert.equal(result.status, 'available');
    assert.equal(result.sourceScope, 'nz-publishers');
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.match(String(fetchMock.mock.calls[1].arguments[0]), /\/everything\?/);
    assert.match(String(fetchMock.mock.calls[1].arguments[0]), /domains=/);
  } finally {
    if (previousApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('shares an in-flight request and caches the successful news result', async (t) => {
  resetPositiveNewsCacheForTests();
  const previousApiKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = 'test-key';
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => mockNewsResponse([article()])
  );

  try {
    const [first, second] = await Promise.all([
      getPositiveNzNews(),
      getPositiveNzNews(),
    ]);
    const third = await getPositiveNzNews();
    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previousApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('selects the next unused cached story and reports when results are exhausted', async (t) => {
  resetPositiveNewsCacheForTests();
  const previousApiKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = 'test-key';
  const secondArticle = article({
    title: 'Community celebrates school garden success',
    url: 'https://example.test/second-story',
    publishedAt: '2026-07-29T08:00:00Z',
  });
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    async () => mockNewsResponse([article(), secondArticle])
  );

  try {
    const first = await getPositiveNzNews();
    const second = await getPositiveNzNews({ excludeTitles: [first.article.title] });
    const exhausted = await getPositiveNzNews({
      excludeTitles: [first.article.title, second.article.title],
    });

    assert.equal(first.article.url, 'https://example.test/story');
    assert.equal(second.article.url, 'https://example.test/second-story');
    assert.equal(exhausted.status, 'unavailable');
    assert.equal(exhausted.reason, 'no-new-headline');
    assert.match(exhausted.message, /no new positive New Zealand stories/i);
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    if (previousApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('rejects an article when additional content contains a blocked topic', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      content: 'The celebration followed a fatal crash.',
    })),
    false
  );
});

test('still checks truncated article content for blocked topics', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      content: 'The celebration followed a fatal crash. \u2026 [+124 chars]',
    })),
    false
  );
});
