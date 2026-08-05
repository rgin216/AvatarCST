import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createOpenAiSpeechPlan,
  SESSION_ONE_OPENING_QUESTION,
} from './speechPlanService.js';
import { concatenateWavFiles } from './ttsService.js';

const openingText =
  'Hello Ryan, and welcome. I am Aria, and I will be guiding you through this ' +
  'AI-supported Cognitive Stimulation Therapy session. Today is our first session, ' +
  `so we will take it gently and get comfortable together. ${SESSION_ONE_OPENING_QUESTION}`;

const openingTurn = {
  scriptId: 'cst_intro_reminiscence',
  scriptStep: { id: 'welcome_opening' },
  assistantText: openingText,
  speechSegments: [{ kind: 'scripted', text: openingText }],
};

test('replaces the Session 1 question with a verified alloy asset', () => {
  const plan = createOpenAiSpeechPlan({
    turn: openingTurn,
    voice: 'alloy',
    scriptedModel: 'tts-1',
  });

  assert.equal(plan.segments.length, 2);
  assert.equal(plan.segments[0].model, 'tts-1');
  assert.equal(plan.segments[0].voice, 'alloy');
  assert.doesNotMatch(plan.segments[0].text, /How are you feeling today/i);
  assert.equal(plan.segments[1].kind, 'verified-asset');
  assert.equal(plan.segments[1].text, SESSION_ONE_OPENING_QUESTION);
  assert.match(plan.segments[1].audioPath, /session1-feeling-today-alloy\.wav$/);
  assert.equal(fs.existsSync(plan.segments[1].audioPath), true);
  assert.deepEqual(plan.requiredPhrases, [SESSION_ONE_OPENING_QUESTION]);
});

test('uses a tts-1-compatible female voice consistently across mixed turns', () => {
  const plan = createOpenAiSpeechPlan({
    turn: {
      scriptId: 'cst_childhood',
      scriptStep: { id: 'orientation_day' },
      assistantText: 'That sounds good. What day is it?',
      speechSegments: [
        { kind: 'adaptive', text: 'That sounds good.' },
        { kind: 'scripted', text: 'What day is it?' },
      ],
    },
    voice: 'marin',
    adaptiveModel: 'gpt-4o-mini-tts',
    scriptedModel: 'tts-1',
  });

  assert.deepEqual(
    plan.segments.map(({ kind, model, voice }) => ({ kind, model, voice })),
    [
      { kind: 'adaptive', model: 'gpt-4o-mini-tts', voice: 'nova' },
      { kind: 'scripted', model: 'tts-1', voice: 'nova' },
    ]
  );
});

test('maps the unsupported marin opening voice to the verified nova asset', () => {
  const plan = createOpenAiSpeechPlan({ turn: openingTurn, voice: 'marin' });

  assert.equal(plan.segments[0].voice, 'nova');
  assert.match(plan.segments[1].audioPath, /session1-feeling-today-nova\.wav$/);
  assert.equal(fs.existsSync(plan.segments[1].audioPath), true);
});

test('concatenates verified WAV assets into one playable WAV', async () => {
  const alloyPlan = createOpenAiSpeechPlan({ turn: openingTurn, voice: 'alloy' });
  const novaPlan = createOpenAiSpeechPlan({ turn: openingTurn, voice: 'marin' });
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'avatarcst-speech-plan-'));
  const outputPath = path.join(tempDir, 'combined.wav');

  try {
    await concatenateWavFiles(
      [alloyPlan.segments[1].audioPath, novaPlan.segments[1].audioPath],
      outputPath
    );
    const output = await fs.promises.readFile(outputPath);
    assert.equal(output.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.ok(output.length > 100_000);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
});
