import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPositiveNzNews,
  isSuitablePositiveArticle,
  resetPositiveNewsCacheForTests,
  selectPositiveArticle,
  selectPositiveArticles,
} from './newsService.js';

process.env.NZ_DOC_NEWS_ENABLED = 'false';

const article = (overrides = {}) => ({
  title: 'Community celebrates native bird conservation milestone',
  description: 'Volunteers welcomed record numbers of birds back to the sanctuary.',
  url: 'https://example.test/story',
  source: { name: 'Example News' },
  publishedAt: '2026-07-30T08:00:00Z',
  ...overrides,
});

const mockDocResponse = (url, text) => ({
  ok: true, url, headers: { get: () => null }, body: new Response(text).body,
});

test('uses DOC full text first and rotates into NewsAPI stories', async (t) => {
  resetPositiveNewsCacheForTests();
  process.env.NZ_DOC_NEWS_ENABLED = 'true';
  const previousNewsApiKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = 'newsapi-key';
  const published = new Date().toISOString();
  const docUrl = 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/native-tree-planting/';
  const feed = `<feed><entry><title>Community celebrates native tree planting</title><summary>Volunteers planted trees.</summary><published>${published}</published><link href="${docUrl}" /></entry></feed>`;
  const body = 'Volunteers planted native trees in the community garden. '.repeat(12);
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = String(url);
    if (target.includes('rss-feed-to-govtnz')) {
      assert.equal(options.redirect, 'error');
      return mockDocResponse(target, feed);
    }
    if (target === docUrl) return mockDocResponse(target,
      `<section class="doc-main-layout__hero"><doc-image-caption caption="Native trees"><div>Image: Jane Doe | <a href="/footer-links/copyright/">DOC</a></div></doc-image-caption><img class="hero__image" src="/thumbs/hero/planting.jpg" /></section><doc-content-box><div class="pagedoc"><p>Date: 28 September 2026</p><p>${body}</p></doc-content-box>`);
    return mockNewsResponse([article()]);
  });
  try {
    const first = await getPositiveNzNews();
    const second = await getPositiveNzNews({ excludeUrls: [first.article.url] });
    assert.equal(first.sourceScope, 'doc-releases');
    assert.match(first.article.fullContent, /community garden/);
    assert.equal(first.article.imageUrl, 'https://www.doc.govt.nz/thumbs/hero/planting.jpg');
    assert.equal(first.article.imageCredit, 'Jane Doe / DOC');
    assert.equal(second.sourceScope, 'nz-top-headlines');
    assert.notEqual(second.article.url, first.article.url);
    assert.equal(fetchMock.mock.callCount(), 3);
  } finally {
    process.env.NZ_DOC_NEWS_ENABLED = 'false';
    if (previousNewsApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousNewsApiKey;
    resetPositiveNewsCacheForTests();
  }
});

test('DOC news works without an API key', async (t) => {
  resetPositiveNewsCacheForTests();
  process.env.NZ_DOC_NEWS_ENABLED = 'true';
  const previousNewsApiKey = process.env.NEWS_API_KEY;
  delete process.env.NEWS_API_KEY;
  const docUrl = 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/community-garden/';
  const feed = `<feed><entry><title>Community celebrates native planting</title><summary>Volunteers planted trees.</summary><published>${new Date().toISOString()}</published><link href="${docUrl}" /></entry></feed>`;
  const body = 'Volunteers planted native trees in a local garden. '.repeat(12);
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url) => mockDocResponse(String(url),
    String(url) === docUrl
      ? `<doc-content-box><div class="pagedoc"><p>Date: 28 September 2026</p><p>${body}</p></doc-content-box>`
      : feed));
  try {
    const result = await getPositiveNzNews();
    assert.equal(result.status, 'available');
    assert.equal(result.sourceScope, 'doc-releases');
    assert.equal(result.article.fullContent, body.trim());
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    process.env.NZ_DOC_NEWS_ENABLED = 'false';
    if (previousNewsApiKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousNewsApiKey;
    resetPositiveNewsCacheForTests();
  }
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

test('retains complete sentences from truncated NewsAPI content', () => {
  const selected = selectPositiveArticle([
    article({
      content: 'The sanctuary recorded its highest number of returning birds this year. [+124 chars]',
    }),
  ]);

  assert.equal(selected.content, 'The sanctuary recorded its highest number of returning birds this year.');
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


test('normalization bounds a long description without cutting a sentence', () => {
  const selected = selectPositiveArticle([article({ description: 'Volunteers welcomed birds back. '.repeat(1000) })]);
  assert.ok(selected.description.length <= 600);
  assert.ok(selected.description.endsWith('.'));
});
