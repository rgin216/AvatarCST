import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNewsExcerpt, newsContext, answerNewsQuestion, isNewsOverviewRequest } from './newsConversationService.js';
const currentAffairs = { status: 'available', article: { title: 'Community garden opens', description: 'The garden opened in Auckland on Monday.', content: 'Volunteers built accessible garden beds.' } };
test('news context combines excerpts and removes only the unfinished trailing fragment', () => {
  assert.equal(cleanNewsExcerpt('Volunteers built garden beds. They also planted… [+124 chars]'), 'Volunteers built garden beds.');
  assert.equal(cleanNewsExcerpt('Volunteers built… [+124 chars]'), '');
  assert.equal(newsContext(currentAffairs.article), 'The garden opened in Auckland on Monday. Volunteers built accessible garden beds.');
});
test('specific questions can use verified details beyond the headline and excerpt', async () => {
  const story = { status: 'available', article: { ...currentAffairs.article,
    fullContent: 'The garden opened in Auckland on Monday. Volunteers built accessible garden beds. Local schools planted twelve fruit trees on Wednesday.' } };
  const result = await answerNewsQuestion({ currentAffairs: story, question: 'What did the schools plant?', generate: async (messages) => {
    assert.match(messages[0].content, /twelve fruit trees/);
    return JSON.stringify({ answer: 'They planted twelve fruit trees.', evidence: 'Local schools planted twelve fruit trees on Wednesday.' });
  } });
  assert.equal(result, 'They planted twelve fruit trees.');
});
test('a request for what happened uses the article and can fall back to grounded details', async () => {
  const story = { status: 'available', article: { title: 'Conservation Week dates announced',
    description: 'Conservation Week 2027 will run from 19 to 25 April.',
    fullContent: 'DOC invited teams to plan conservation activities together. Volunteers can plant trees or clean beaches.' } };
  assert.equal(isNewsOverviewRequest('tell me what happened'), true);
  assert.equal(isNewsOverviewRequest('tell me more about the bird and population'), true);
  assert.equal(isNewsOverviewRequest('Where did it happen?'), false);
  assert.match(newsContext(story.article), /19 to 25 April/);
  const answer = await answerNewsQuestion({ currentAffairs: story, question: 'tell me what happened',
    generate: async (messages) => {
      assert.match(messages[0].content, /brief account of what happened/);
      return JSON.stringify({ answer: 'DOC announced the dates for Conservation Week 2027 and invited teams to take part.',
        evidence: ['Conservation Week 2027 will run from 19 to 25 April.', 'DOC invited teams to plan conservation activities together.'] });
    } });
  assert.match(answer, /announced the dates/);
  const fallback = await answerNewsQuestion({ currentAffairs: story, question: 'tell me what happened',
    fallbackAnswer: 'Conservation Week 2027 will run from 19 to 25 April.',
    generate: async () => '{"answer":null,"evidence":[]}' });
  assert.match(fallback, /19 to 25 April/);
});
test('a saved DOC story can retrieve its article text for a follow-up', async () => {
  const story = { status: 'available', article: { title: 'Kākāpō population reaches new milestone',
    description: 'The kākāpō population reached a milestone.',
    url: 'https://www.doc.govt.nz/news/media-releases/2026-media-releases/kakapo-population-reaches-new-milestone/' } };
  const answer = await answerNewsQuestion({ currentAffairs: story,
    question: 'tell me more about the bird and population',
    fetchArticle: async (url) => {
      assert.equal(url, story.article.url);
      return 'The official population reached 325 birds. Ninety chicks joined the count after reaching independence.';
    },
    generate: async (messages) => {
      assert.match(messages[0].content, /325 birds/);
      return JSON.stringify({ answer: null, evidence: [] });
    } });
  assert.match(answer, /325 birds/);
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
