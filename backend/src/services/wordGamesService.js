import { brainTeasers } from './wordGamesScript.js';

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export const matchesWordGameAnswer = (content, aliases) => {
  const answer = normalize(content);
  // A negated guess is not an assertion of the solution. "Don't horse around"
  // is itself a valid requested variant and must remain acceptable.
  if (/\b(?:isnt|is not|not the answer|anything but)\b/.test(answer)) return false;
  return aliases.some(alias => ` ${answer} `.includes(` ${normalize(alias)} `));
};

const praise = ['You worked that out beautifully!', 'Nicely spotted!', 'That is the saying!', 'You made the connection!', 'Exactly, well done!', 'A lovely bit of wordplay!', 'You found it!', 'That fits perfectly!', 'Good thinking!', 'Yes, you solved it!', 'A neat piece of puzzling!', 'You caught the clue!', 'That is just right!', 'Well figured out!'];
const gentle = ['That one can be tricky.', 'Thank you for having a go.', 'An interesting guess.', 'Let us unpack that one.', 'These layouts can be puzzling.', 'A good effort with this clue.', 'Here is what this picture is getting at.', 'This one takes a little imagination.', 'Thanks for trying that.', 'The arrangement hides a familiar phrase.', 'Let us discover this one together.', 'There is a little twist in this clue.', 'The intended phrase is a different one.', 'We have another saying to explore.'];
const unsure = ['No problem at all.', 'We can discover it together.', 'It is fine to be unsure.', 'There is no pressure to know every one.', 'Let me share this one with you.', 'Take it gently; this is just for fun.', 'This is a playful little puzzle.', 'We can enjoy the answer together.', 'Some of these are quite surprising.', 'Thank you for letting me know.', 'This one has a hidden phrase.', 'Let us have a look at the solution.', 'It is all right to pass.', 'Here is the saying behind this clue.'];

export function wordGameTriviaFeedback(step, answers) {
  const index = Number(step.id.split('_').at(-1)) - 18;
  const previous = answers.filter(item => /^word_games_teaser_\d+$/.test(item.stepId));
  const correct = item => {
    const entry = brainTeasers[Number(item.stepId.split('_').at(-1)) - 18];
    return entry && !/\b(don'?t know|not sure|unsure|can't remember|cannot remember|no idea)\b/i.test(item.answer) && matchesWordGameAnswer(item.answer, [entry[0], ...entry[1]]);
  };
  let streak = 0;
  for (const item of [...previous].reverse()) { if (!correct(item)) break; streak++; }
  const total = previous.filter(correct).length + 1;
  const bonus = streak >= 1 ? ` That makes ${streak + 1} in a row — excellent work!` : total >= 5 && total / (previous.length + 1) >= 0.7 ? ' You have solved so many of these — lovely work!' : '';
  return {
    correctResponse: `${praise[index]} ${step.trivia.answer}.${bonus}`,
    incorrectResponse: `${gentle[index]} The saying is ${step.trivia.answer}.`,
    unsureResponse: `${unsure[index]} It is ${step.trivia.answer}.`,
  };
}

export function hasCompletedPronunciation(step, content) {
  if (step.interaction?.type !== 'pronunciation') return true;
  const match = /^\[\[pronunciation-complete:([a-z,-]+)\]\]$/.exec(content || '');
  if (!match) return false;
  const ids = new Set(match[1].split(','));
  return ids.size === step.interaction.clips.length && step.interaction.clips.every(clip => ids.has(clip.id));
}
