import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionSummary,
  toSecondPersonSummaryClause,
} from './sessionOrchestratorService.js';

test('converts first-person answers into clean second-person clauses', () => {
  assert.equal(
    toSecondPersonSummaryClause('I loved accounting because I was good at numbers.'),
    'you loved accounting because you were good at numbers'
  );
  assert.equal(
    toSecondPersonSummaryClause('I was a checkout operator at Woolworths.'),
    'you were a checkout operator at Woolworths'
  );
});

test('builds a natural summary without embedding first-person answers', () => {
  const summary = buildSessionSummary([
    {
      stepId: 'childhood_parents',
      answer: 'Their names were John and Mary.',
    },
    {
      stepId: 'childhood_siblings',
      answer: 'I have one sister.',
    },
    {
      stepId: 'childhood_school',
      answer: 'I loved accounting because I was good at numbers.',
    },
    {
      stepId: 'childhood_first_job',
      answer: 'I was a checkout operator at a supermarket called Woolworths.',
    },
    {
      stepId: 'childhood_modern_family',
      answer: 'I think families have become more flexible.',
    },
    {
      stepId: 'childhood_spin_question',
      answer: 'I studied as a software engineer and now work at Deloitte.',
    },
  ]);

  assert.equal(
    summary,
    "Today, you shared your parents' names, you talked about brothers or sisters, you loved accounting because you were good at numbers, you were a checkout operator at a supermarket called Woolworths, you think families have become more flexible, and you studied as a software engineer and now work at Deloitte."
  );
  assert.doesNotMatch(summary, /\byou (?:remembered|mentioned) I\b/i);
  assert.doesNotMatch(summary, /\.\./);
});
