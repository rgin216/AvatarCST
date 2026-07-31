import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSuitablePositiveArticle,
  selectPositiveArticle,
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

test('keeps safe article detail for grounded elaboration and removes truncation markers', () => {
  const selected = selectPositiveArticle([
    article({
      content: 'The sanctuary recorded its highest number of returning birds this year. [+124 chars]',
    }),
  ]);

  assert.equal(
    selected.content,
    'The sanctuary recorded its highest number of returning birds this year.'
  );
});

test('rejects an article when additional content contains a blocked topic', () => {
  assert.equal(
    isSuitablePositiveArticle(article({
      content: 'The celebration followed a fatal crash.',
    })),
    false
  );
});
