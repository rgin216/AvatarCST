import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCha, cleanChatUtterance, normalizeWords, wordErrorRate, summarizeWer, bootstrapWer } from './wer.js';

const SAMPLE_CHA = [
  '@Begin',
  '@Participants:\tPAR Participant, INV Investigator',
  '@ID:\teng|Pitt|PAR|67;|female|ProbableAD||Participant|12||',
  '@ID:\teng|Pitt|INV|||||Investigator|||',
  '*INV:\ttell me everything you see going on in that picture . \u00150_2500\u0015',
  '*PAR:\t&-uh <the boy> [//] the boy is getting cookies',
  '\tout of the (.) jar . \u00152500_7100\u0015',
  '%mor:\tdet:art|the n|boy',
  '*PAR:\txxx . \u00157100_8000\u0015',
  '@End',
].join('\n');

test('parses speakers, continuation lines, media bullets and participant group', () => {
  const { ids, utterances } = parseCha(SAMPLE_CHA);
  assert.equal(ids.PAR.group, 'ProbableAD');
  assert.equal(ids.PAR.age, '67');
  assert.equal(utterances.length, 3);
  assert.deepEqual(utterances[1], {
    speaker: 'PAR',
    raw: '&-uh <the boy> [//] the boy is getting cookies out of the (.) jar .',
    startMs: 2500,
    endMs: 7100,
  });
});

test('clean mode drops fillers, pauses and unintelligible speech but keeps spoken retracings', () => {
  const raw = '&-uh <the boy> [//] the boy is getting cookies out of the (.) jar .';
  assert.equal(cleanChatUtterance(raw), 'the boy the boy is getting cookies out of the jar .');
  assert.equal(cleanChatUtterance('xxx .'), '.');
});

test('verbatim mode keeps fillers and retraced words as spoken', () => {
  const raw = '&-uh <the boy> [//] the boy is (be)cause &+fr falling [: fall] [* m] &=laughs .';
  assert.equal(cleanChatUtterance(raw, { mode: 'verbatim' }), 'uh the boy the boy is cause fr falling .');
  assert.equal(cleanChatUtterance(raw), 'the boy the boy is because falling .');
});

test('strips CHAT special-form markers, compounds, omissions and linkers', () => {
  assert.equal(cleanChatUtterance('+< she want 0to ice_cream@n:a ba:ll +...'), 'she want ice cream ball');
});

test('normalizes case, punctuation, numbers and fillers on both sides', () => {
  assert.deepEqual(normalizeWords('Um, the Boy\'s on 2 stools - well, 3!'), ['the', "boy's", 'on', 'two', 'stools', 'well', 'three']);
  assert.deepEqual(normalizeWords('Um yes', { dropFillers: false }), ['um', 'yes']);
  assert.deepEqual(normalizeWords('1985'), ['one', 'thousand', 'nine', 'hundred', 'eighty', 'five']);
});

test('treats contractions and casual spellings as equivalent', () => {
  assert.equal(wordErrorRate("there's a boy gonna get cookies outta the jar", 'there is a boy going to get cookies out of the jar').wer, 0);
  assert.equal(wordErrorRate("she can't reach, it's ok", 'she cannot reach it is okay').wer, 0);
  assert.equal(wordErrorRate("they're fine and I'll go", 'they are fine and I will go').wer, 0);
  // Possessive or ambiguous noun + 's is left alone.
  assert.deepEqual(normalizeWords("the boy's hand"), ['the', "boy's", 'hand']);
});

test('counts substitutions, deletions and insertions', () => {
  assert.deepEqual(wordErrorRate('the boy is getting cookies', 'the boy is getting cookies'),
    { referenceWords: 5, hypothesisWords: 5, substitutions: 0, deletions: 0, insertions: 0, errors: 0, wer: 0 });
  const result = wordErrorRate('the boy is getting cookies', 'a boy getting the cookies now');
  assert.equal(result.substitutions + result.deletions + result.insertions, result.errors);
  assert.equal(result.errors, 4);
  assert.equal(result.wer, 0.8);
  assert.equal(wordErrorRate('', '').wer, 0);
  assert.equal(wordErrorRate('', 'hallucinated').wer, 1);
});

test('bootstraps speaker-level confidence intervals reproducibly', () => {
  const speakers = [{ errors: 1, words: 10 }, { errors: 3, words: 10 }, { errors: 2, words: 10 }, { errors: 6, words: 10 }];
  const ci = bootstrapWer(speakers);
  assert.equal(ci.estimate, 0.3);
  assert.ok(ci.low >= 0.1 && ci.low < 0.3 && ci.high > 0.3 && ci.high <= 0.6);
  assert.deepEqual(bootstrapWer(speakers), ci);
  const paired = bootstrapWer(speakers.map(s => ({ ...s, errorsB: s.errors - 1, wordsB: s.words })));
  assert.ok(Math.abs(paired.estimate + 0.1) < 1e-9);
  assert.ok(Math.abs(paired.low + 0.1) < 1e-9 && Math.abs(paired.high + 0.1) < 1e-9);
});

test('summarizes corpus WER as total errors over total reference words', () => {
  const rows = [
    { status: 'ok', provider: 'groq', referenceWords: 10, errors: 1, substitutions: 1, deletions: 0, insertions: 0,
      verbatimReferenceWords: 12, verbatimErrors: 3, latencyMs: 300 },
    { status: 'ok', provider: 'groq', referenceWords: 2, errors: 2, substitutions: 0, deletions: 2, insertions: 0,
      verbatimReferenceWords: 2, verbatimErrors: 2, latencyMs: 100 },
    { status: 'error', provider: 'groq' },
  ];
  const [summary] = summarizeWer(rows, row => row.provider);
  assert.equal(summary.clips, 2);
  assert.equal(summary.wer, 3 / 12);
  assert.equal(summary.verbatimWer, 5 / 14);
  assert.equal(summary.medianLatencyMs, 100);
});
