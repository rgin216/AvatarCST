import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNewsExcerpt, newsContext, answerNewsQuestion } from './newsConversationService.js';
const currentAffairs = { status: 'available', article: { title: 'Community garden opens', description: 'The garden opened in Auckland on Monday.', content: 'Volunteers built accessible garden beds.' } };
test('news context combines excerpts and removes only the unfinished trailing fragment', () => {
  assert.equal(cleanNewsExcerpt('Volunteers built garden beds. They also planted… [+124 chars]'), 'Volunteers built garden beds.');
  assert.equal(cleanNewsExcerpt('Volunteers built… [+124 chars]'), '');
  assert.equal(newsContext(currentAffairs.article), 'The garden opened in Auckland on Monday. Volunteers built accessible garden beds.');
});
test('specific questions receive a grounded answer instead of the same generic excerpt', async () => {
  const result = await answerNewsQuestion({ currentAffairs, question: 'Where did it open?', generate: async (messages) => {
    assert.match(messages[0].content, /accessible garden beds/);
    assert.equal(messages.at(-1).content, 'Where did it open?');
    return JSON.stringify({ answer: 'It opened in Auckland.', evidence: 'The garden opened in Auckland on Monday.' });
  } });
  assert.equal(result, 'It opened in Auckland.');
});
test('missing detail, fabricated evidence and model failures do not invent article facts', async () => {
  for (const generate of [async () => '{"answer":null,"evidence":""}', async () => '{"answer":"It cost $5000.","evidence":"The budget was $5000."}', async () => { throw Error('offline'); }]) {
    assert.match(await answerNewsQuestion({ currentAffairs, question: 'How much did it cost?', generate }), /does not give that detail/);
  }
});
