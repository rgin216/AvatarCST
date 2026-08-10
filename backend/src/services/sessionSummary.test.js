import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTopicSessionSummary,
  generateSessionSummary,
  isSafeGeneratedSessionSummary,
} from './sessionOrchestratorService.js';

const exampleAnswers = [
  {
    stepId: 'theme_song_choice',
    title: 'Theme song',
    answer: "Yes, I'd like to play a song, I think its called Clementine by grentperez",
  },
  {
    stepId: 'childhood_modern_family',
    title: 'Modern Family',
    answer: 'never heard of it',
  },
  {
    stepId: 'childhood_spin_question',
    title: 'Question wheel',
    answer: 'It is unique and uses a lot of different blending and shading techniques.',
    adaptiveFollowUp: {
      question: 'What stands out about it?',
      answer: "The main character's framerate increases as he gets better at swinging.",
    },
  },
];

const themeSong = {
  status: 'available',
  track: { name: 'Clementine', artistLabel: 'grentperez' },
};

test('builds a topic-level fallback without copying conversational answers', () => {
  const summary = buildTopicSessionSummary(exampleAnswers, { themeSong });

  assert.equal(
    summary,
    'Today, you spent time choosing Clementine by grentperez as your theme song, exploring animation and visual storytelling, and reflecting on a topic from the question wheel.'
  );
  assert.doesNotMatch(summary, /I['’]d|never heard|framerate|blending and shading/i);
});

test('generates a concise paraphrased recap and omits low-value responses', async () => {
  let suppliedDiscussion;
  const summary = await generateSessionSummary({
    answers: exampleAnswers,
    themeSong,
    provider: 'openai',
    generate: async (messages) => {
      suppliedDiscussion = JSON.parse(messages.find((message) => message.role === 'user').content);
      return 'Today, you explored a favourite song and discussed animation techniques and changing character movement.';
    },
  });

  assert.equal(
    summary,
    'Today, you explored a favourite song and discussed animation techniques and changing character movement.'
  );
  assert.equal(suppliedDiscussion.discussion.length, 1);
  assert.equal(suppliedDiscussion.discussion[0].topic, 'Question wheel');
  assert.deepEqual(suppliedDiscussion.selectedThemeSong, {
    name: 'Clementine',
    artist: 'grentperez',
  });
});

test('rejects first-person or copied generated recaps', async () => {
  assert.equal(
    isSafeGeneratedSessionSummary(
      "Today, you chose Yes, I'd like to play a song, I think its called Clementine by grentperez.",
      exampleAnswers
    ),
    false
  );

  const summary = await generateSessionSummary({
    answers: exampleAnswers,
    themeSong,
    generate: async () =>
      'Today, you remembered how the main character framerate increases as he gets better at swinging.',
  });

  assert.equal(summary, buildTopicSessionSummary(exampleAnswers, { themeSong }));
});
