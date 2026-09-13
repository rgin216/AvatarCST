import { pairConnection } from './categorizingObjectsData.js';

const unsure = text => /\b(?:not sure|don'?t know|cannot think|can'?t think|no ideas?|nothing)\b/i.test(text);
const finished = text => /^(?:(?:i am|i'm|im)\s+)?(?:done|finished|skip|next|move on|that'?s all(?: i can think of)?|that is all|no more)[.!\s]*$/i.test(text);
const fail = () => { const error = new Error('Invalid object activity selection'); error.status = 400; throw error; };
const list = values => values.join(', ');

// Activity state is owned by the server; clients send only selections or a reason.
export function evaluateCategorizingTurn({ step, content = '', stored = {} }) {
  if (!step.activityKind) {
    if (content.startsWith('[[objects:')) fail();
    return null;
  }
  if (!content.trim()) return null;
  const state = structuredClone(stored);
  const result = (response, complete = false, transcript = content, prompt = '') => ({
    answered: true, response, complete, transcript, state, prompt,
  });
  let event = null;
  if (content.startsWith('[[objects:')) {
    if (content.length > 5000 || !content.endsWith(']]')) fail();
    try { event = JSON.parse(content.slice(10, -2)); } catch { fail(); }
    if (!event || event.stepId !== step.id || !['check','pair','done'].includes(event.action)) fail();
    if (!['odd','pairs'].includes(step.activityKind)) fail();
  }
  const done = event?.action === 'done' || finished(content);
  const items = step.interaction?.items || [];
  const validIds = ids => Array.isArray(ids) && ids.every(id => typeof id === 'string' && items.some(item => item.id === id)) && new Set(ids).size === ids.length;
  if (step.activityKind === 'senses') {
    return result(unsure(content) || done ? 'That is quite all right. There is no pressure to find both.' : 'Thank you for sharing what came to mind.', true);
  }
  if (step.activityKind === 'odd') {
    if (done) return result('Thank you for exploring those pictures. The items that do not belong are the non-food items: the balloon, cooking pot, trophy, mug, frying pan, and glasses.', true, 'Finished the non-food activity.');
    if (event?.action !== 'check') return result('Circle the items you think do not belong, then press Check selections. You can also say done to move on.');
    if (!validIds(event.ids)) fail();
    const correct = items.filter(item => event.ids.includes(item.id) && item.groups.includes('non-food'));
    const wrong = items.filter(item => event.ids.includes(item.id) && !item.groups.includes('non-food'));
    const missed = items.filter(item => !event.ids.includes(item.id) && item.groups.includes('non-food'));
    state.odd = { selected: event.ids, correct: correct.map(item => item.id), wrong: wrong.map(item => item.id), missed: missed.map(item => item.id), checked: true };
    const lines = [correct.length ? `Well spotted. You correctly circled ${list(correct.map(item => item.label.toLowerCase()))}.` : 'Thank you for giving it a go.'];
    if (wrong.length) lines.push(`${list(wrong.map(item => item.label))} ${wrong.length === 1 ? 'is food and belongs' : 'are foods and belong'} with the food group.`);
    if (missed.length) lines.push(`The other items to circle are ${list(missed.map(item => item.label.toLowerCase()))}.`);
    lines.push('The things that do not belong are non-food items. A pan or mug can be used with food, but is not food itself. Press Continue when you are ready.');
    return result(lines.join(' '), false, 'I circled: ' + (list(items.filter(item => event.ids.includes(item.id)).map(item => item.label)) || 'no items') + '.');
  }
  if (step.activityKind === 'pairs') {
    state.pairs ||= [];
    if (done || unsure(content)) {
      state.pendingPair = null;
      return result(state.pairs.length ? 'You found some different ways to connect everyday objects. Thank you for sharing your ideas.' : 'That is all right. These objects can be grouped in many ways, and there is no target to reach.', true, 'Finished the pairing activity.');
    }
    let ids;
    let reason;
    if (event) {
      if (event.action !== 'pair' || !validIds(event.ids) || event.ids.length !== 2) fail();
      ids = event.ids;
      reason = pairConnection(...ids.map(id => items.find(item => item.id === id)));
    } else if (state.pendingPair) {
      ids = state.pendingPair;
      if (content.length > 500 || !/[\p{L}\p{N}]/u.test(content)) return result('What connection did you notice? You can also say done.');
      reason = content.trim();
    } else return result('Choose two pictures to make a pair. You can say done at any time.');
    const labels = ids.map(id => items.find(item => item.id === id).label);
    if (state.pairs.some(pair => pair.ids.every(id => ids.includes(id)))) return result('You have already made that pair. Try a different connection, or press Done.', false, 'Selected the same pair again.');
    if (!reason) {
      state.pendingPair = ids;
      return result(`You chose ${labels[0].toLowerCase()} and ${labels[1].toLowerCase()}. What makes them go together for you? It might be their use, colour, or where you keep them.`, false, 'I paired ' + labels.join(' and ') + '.');
    }
    if (state.pairs.length >= 64) return result('You have explored plenty of connections. Let us move on.', true);
    state.pairs.push({ ids, reason, explained: !event });
    state.pendingPair = null;
    const praise = ['Well spotted', 'That works', 'You found a connection'][state.pairs.length % 3];
    return result(event ? `${praise}. The ${labels[0].toLowerCase()} and ${labels[1].toLowerCase()} go together because ${reason}. Choose another pair, or press Done.` : 'Thank you for explaining your connection. There can be more than one way to group things. Choose another pair, or press Done.', false, event ? 'I paired ' + labels.join(' and ') + '.' : content);
  }
  if (step.activityKind === 'category') {
    state.category = done || unsure(content) ? 'animals' : content.trim().replace(/^(?:let'?s (?:do|try)|i (?:choose|chose|pick|picked)|how about|the category is)\s+/i, '').slice(0, 100);
    state.words = [];
    return result(done || unsure(content) ? 'That is all right. We can try animals.' : 'Let us try that category.', true);
  }
  if (step.activityKind === 'letter') {
    const letter = content.trim().match(/^(?:(?:the )?letter\s+|i (?:choose|pick)\s+)?([a-z])[.!\s]*$/i)?.[1];
    const spoken = { ay:'A', bee:'B', be:'B', see:'C', sea:'C', dee:'D', ee:'E', eff:'F', gee:'G', aitch:'H', eye:'I', jay:'J', kay:'K', el:'L', em:'M', en:'N', oh:'O', pee:'P', cue:'Q', are:'R', ess:'S', tea:'T', tee:'T', you:'U', vee:'V', 'double u':'W', ex:'X', why:'Y', zed:'Z', zee:'Z' };
    state.letterTries = (state.letterTries || 0) + 1;
    state.letter = letter?.toUpperCase() || spoken[content.toLowerCase().trim()];
    if (!state.letter && !done && !unsure(content) && state.letterTries < 3) return result('Choose just one letter, such as A, B, or C. It is also fine to say you are not sure.');
    state.letter ||= 'A';
    return result(`We will use the letter ${state.letter}.`, true);
  }
  if (step.activityKind === 'words') {
    state.words ||= [];
    if (done || unsure(content)) return result(state.words.length ? 'Thank you for the words you shared. Every idea gave us something to think about, and there was no number you needed to reach.' : 'That is quite all right. Sometimes words do not come easily. There is no test or score; thank you for giving it a go.', true);
    const words = content.replace(/^(?:i can think of|i thought of|how about|maybe)\s+/i, '').split(/[,;\n]|\band\b/i).map(word => word.trim()).filter(Boolean).slice(0, 30);
    const matching = words.filter(word => word[0]?.toUpperCase() === state.letter);
    state.words = [...new Set([...state.words, ...matching])].slice(0, 100);
    return result(matching.length ? `You found ${matching.length === 1 ? 'a word' : 'some words'} starting with ${state.letter}. Keep thinking about ${state.category}. You can share more, or say done whenever you like.` : `Thank you for trying. We are thinking of ${state.category} starting with ${state.letter}. Take your time, or say done to move on.`);
  }
  return null;
}
