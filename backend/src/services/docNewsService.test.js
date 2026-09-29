import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDocArticle, extractDocImage, fetchDocArticleByUrl, parseDocFeed } from './docNewsService.js';

test('DOC feed accepts only recent official release links', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  const entry = (title, published, url) =>
    `<entry><title>${title}</title><summary type="html">Volunteers &amp; neighbours planted trees.</summary><published>${published}</published><link href="${url}" /></entry>`;
  const articles = parseDocFeed(`<feed>${[
    entry('Native planting', '2026-09-23T00:00:00+12:00', 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/planting/'),
    entry('Too old', '2026-08-01T00:00:00+12:00', 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/old/'),
    entry('External', '2026-09-23T00:00:00+12:00', 'https://example.test/story'),
  ].join('')}</feed>`, now);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].description, 'Volunteers & neighbours planted trees.');
});

test('DOC article extraction keeps body text and excludes third-party releases', () => {
  const body = 'Volunteers planted native trees. '.repeat(12);
  const html = `<main><doc-content-box><div class="pagedoc"><p>Date:&nbsp;23 September 2026</p><p>${body}</p><p>For media enquiries: email DOC</p></div></doc-content-box></main>`;
  assert.equal(extractDocArticle(html), body.trim());
  assert.equal(extractDocArticle(html.replace('23 September 2026', '23 September 2026 Source: Office of the Minister')), '');
});

test('article lookup fetches only the original DOC release', async () => {
  const originalFetch = globalThis.fetch;
  const url = 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/example/';
  const body = 'The population reached 325 birds. '.repeat(10);
  globalThis.fetch = async (requested, options) => {
    assert.equal(options.redirect, 'error');
    return { ok: true, url: requested, headers: { get: () => null },
      body: new Response(`<doc-content-box><div class="pagedoc">${body}</div></doc-content-box>`).body };
  };
  try {
    assert.match(await fetchDocArticleByUrl(url), /325 birds/);
    assert.equal(await fetchDocArticleByUrl('https://example.test/story'), '');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DOC article lookup cancels a stream as soon as its byte limit is exceeded', async () => {
  const originalFetch = globalThis.fetch;
  const url = 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/example/';
  let cancelled = false;
  globalThis.fetch = async (_requested, options) => {
    assert.equal(options.redirect, 'error');
    return { ok: true, url, headers: { get: () => null }, body: { getReader: () => ({
      read: async () => ({ done: false, value: new TextEncoder().encode('é'.repeat(500_001)) }),
      cancel: async () => { cancelled = true; },
      releaseLock: () => {},
    }) } };
  };
  try {
    await assert.rejects(fetchDocArticleByUrl(url), /DOC response too large/);
    assert.equal(cancelled, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses a hero image only when the page credits it to DOC', () => {
  const hero = (credit, src = '/thumbs/hero/contentassets/planting.jpg') =>
    `<section class="doc-main-layout__hero"><doc-image-caption caption="People planting trees"><div class="hide-content"><span>Image: </span>Stephanie Mercer | ${credit}</div></doc-image-caption><img class="hero__image" src="${src}" /></section>`;
  assert.deepEqual(extractDocImage(hero('<a href="/footer-links/copyright/">DOC</a>')), {
    imageUrl: 'https://www.doc.govt.nz/thumbs/hero/contentassets/planting.jpg',
    imageCredit: 'Stephanie Mercer / DOC',
    imageAlt: 'People planting trees',
  });
  assert.equal(extractDocImage(hero('© Photographer')), null);
  assert.equal(extractDocImage(hero('<a href="/footer-links/copyright/">DOC</a>', 'https://example.test/image.jpg')), null);
});
