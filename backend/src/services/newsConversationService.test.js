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


test('stored oversized descriptions are capped at a sentence boundary before generation', async () => {
  const sentence = 'The garden opened in Auckland on Monday. ';
  const large = sentence.repeat(1000);
  const article = { title: 'Community garden opens', description: large, content: large };
  const context = newsContext(article);
  assert.ok(context.length <= 600);
  assert.ok(context.endsWith('.'));
  assert.equal(newsContext({ description: 'x'.repeat(1000) }), '');
  let prompt;
  await answerNewsQuestion({ currentAffairs: { status: 'available', article }, question: 'When?', generate: async messages => {
    prompt = messages[0].content;
    return '{"answer":null,"evidence":""}';
  } });
  assert.ok(prompt.length < 2000);
  assert.ok(prompt.includes(context));
});

test('evidence must be wholly inside the headline or excerpt', async () => {
  for (const [evidence, accepted] of [
    ['garden opens The garden opened', false],
    ['Community garden opens', true],
    ['The garden opened in Auckland on Monday.', true],
  ]) {
    const result = await answerNewsQuestion({ currentAffairs, question: 'Tell me about it', generate: async () => JSON.stringify({ answer: 'A community garden opened.', evidence }) });
    if (accepted) assert.equal(result, 'A community garden opened.');
    else assert.match(result, /does not give that detail/);
  }
});
