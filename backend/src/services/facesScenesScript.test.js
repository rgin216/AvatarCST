import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getScript, getScriptStep, renderScriptFollowUp } from './cstScriptService.js';
import { buildTopicSessionSummary, evaluateOrientationAnswer, shouldUseNextSlideResponseOnly } from './sessionOrchestratorService.js';

const script = getScript('cst_faces_scenes');
const find = (suffix) => script.find((step) => step.id === `faces_scenes_${suffix}`);

test('Session 7 shared opening preserves its deck layout and progression fixes', () => {
  const expected = { welcome: 1, opening_song: 2, check_in: 2, orientation_day: 3,
    orientation_month: 4, orientation_year: 5, orientation_year_reveal: 6,
    orientation_season: 7, season_winter: 8, season_summer: 9, season_autumn: 10,
    season_spring: 11, weather: 12, positive_news: 13, exercise: 14, theme_intro: 15 };
  for (const [suffix, slide] of Object.entries(expected)) {
    assert.equal(find(suffix).deckSlide, slide, suffix);
    assert.match(find(suffix).visualHint, new RegExp(`NZ07.*slide ${slide}$`));
  }
  assert.equal(find('check_in').acceptAnyAnswer, true);
  assert.equal(find('weather').acceptAnyAnswer, true);
  assert.equal(find('positive_news').interaction.type, 'positiveNews');
  assert.equal(find('positive_news').adaptiveFollowUp.enabled, true);
  assert.equal(find('exercise').interaction.orientation, 'landscape');
  assert.equal(find('theme_intro').interaction.type, 'autoAdvance');
  assert.equal(script[script.indexOf(find('theme_intro')) + 1].id, 'faces_scenes_match_nz');
  assert.doesNotMatch(find('orientation_year_reveal').reply({}), /keep that date in view/);
});

test('Session 7 covers the deck and all branch targets resolve within this session', () => {
  assert.deepEqual([...new Set(script.map((step) => step.deckSlide))].sort((a,b) => a-b), Array.from({ length:33 }, (_,i) => i+1));
  assert.equal(new Set(script.map((step) => step.id)).size, script.length);
  script.forEach((step, index) => {
    assert.equal(getScriptStep('cst_faces_scenes', index).step.slideFolder, 'session7');
    assert.ok(existsSync(new URL(`../../../frontend/public/slides/session7/slide-${String(step.deckSlide).padStart(2, '0')}.jpg`, import.meta.url)));
    [step.nextStepId, ...Object.values(step.seasonBranches || {})].filter(Boolean).forEach((target) => assert.ok(script.some((item) => item.id === target), target));
  });
});

test('Session 7 uses live NZ orientation and shared completion interactions', () => {
  const year = new Intl.DateTimeFormat('en-NZ', {year:'numeric', timeZone:'Pacific/Auckland'}).format(new Date());
  assert.equal(find('orientation_year_reveal').title, year);
  assert.equal(evaluateOrientationAnswer({step:find('orientation_year'), content:year, retryCount:0}).outcome, 'correct');
  assert.equal(find('opening_song').interaction.playbackSeconds, 60);
  assert.equal(find('summary_song').interaction.summarizeOnComplete, true);
  assert.equal(find('spin_question').interaction.type, 'questionWheel');
  assert.equal(find('closing').autoCompleteAfterNarration, true);
});

test('matching has one available name per clue, including the missing Michael Jones', () => {
  for (const suffix of ['match_nz', 'match_international']) {
    const {left, right} = find(suffix).interaction;
    assert.equal(left.length, right.length);
    assert.equal(new Set(right.map((item) => item.id)).size, right.length);
  }
  assert.ok(find('match_nz').interaction.right.some((item) => item.label === 'Michael Jones'));
});

test('three quiz guesses precede answer reveals and do not disclose the answer early', () => {
  for (const [slide, answer] of [[25,'real person'],[27,'real person'],[29,'AI generated']]) {
    const guess = find(`real_ai_${slide}`);
    const reveal = find(`real_ai_${slide}_reveal`);
    assert.equal(guess.interaction.type, 'realOrAi');
    assert.equal(reveal.deckSlide, slide+1);
    assert.equal(reveal.interaction.type, 'autoAdvance');
    assert.ok(reveal.reply().includes(answer));
    assert.equal(shouldUseNextSlideResponseOnly({shouldAdvance:true, nextStep:reveal}), true);
  }
});

test('Queen Street introduces trams only after observations and acknowledges prior mentions', () => {
  const step=find('queen_street');
  assert.doesNotMatch(step.reply(), /tram/i);
  assert.match(renderScriptFollowUp(step,0,{previousAnswer:'There are trams'}), /You noticed the trams/);
  assert.match(renderScriptFollowUp(step,0,{previousAnswer:'The buildings changed'}), /had a tram system/);
});

test('fallback recap covers the actual Session 7 topics', () => {
  const summary = buildTopicSessionSummary([
    {stepId:'faces_scenes_match_nz', answer:'Hillary climbed Everest'},
    {stepId:'faces_scenes_celebrities_similar', answer:'They all go on stage'},
    {stepId:'faces_scenes_queen_street', answer:'There used to be trams'},
    {stepId:'faces_scenes_real_ai_25', answer:'Real person'},
  ]);
  assert.match(summary, /matching descriptions/);
  assert.match(summary, /comparing similarities/);
  assert.match(summary, /Queen Street/);
  assert.match(summary, /real-or-AI/);
});
