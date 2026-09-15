import { pairConnection } from './categorizingObjectsData.js';

const unsure = text => /\b(?:not sure|don'?t know|cannot think|can'?t think|no ideas?|nothing)\b/i.test(text);
const finished = text => /^(?:(?:i am|i'm|im)\s+)?(?:done|finished|skip|next|move on|that'?s all(?: i can think of)?|that is all|no more)[.!\s]*$/i.test(text);
const fail = () => { const error = new Error('Invalid object activity selection'); error.status = 400; throw error; };
const list = values => values.join(', ');
const normalizeChoice = text => text.trim().replace(/[’]/g, "'").replace(/^(?:(?:let'?s|let us|i(?:'d like to| would like to)?)\s+(?:go with|choose|chose|pick|picked|do|try|have)|how about|(?:the|my) category is)\s+/i, '').replace(/[.!?]+$/, '').trim();
const finishSuffix = /(?:^|[,;.!]\s*|\s+)(?:(?:and\s+)?that'?s all(?: i can (?:name|think of))?|that is all(?: i can (?:name|think of))?|i(?: am|'m) done|no more)[.!\s]*$/i;

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
    if (unsure(content) || done) return result('That is quite all right. There is no pressure to find both.', true);
    const fallback = /pillow/i.test(content) && step.id.endsWith('soft_bitter')
      ? 'Ah yes, a pillow can feel soft and plush when you rest your head on it.'
      : `You brought to mind ${content.trim().replace(/[.!?]+$/, '').slice(0, 240)}.`;
    return { ...result(fallback, true), acknowledgement: { kind: 'senses', answer: content.slice(0, 1500), question: step.reply() } };
  }
  if (step.activityKind === 'odd') {
    if (done) return result(state.odd?.checked ? '' : 'The non-food items are the balloon, cooking pot, trophy, mug, frying pan, and glasses.', true, 'Finished the non-food activity.');
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
    const reply = result(event ? `${praise}. The ${labels[0].toLowerCase()} and ${labels[1].toLowerCase()} go together because ${reason}. Choose another pair, or press Done.` : `Yes, I see the connection you are making: ${reason.replace(/[.!?]+$/, '')}. Choose another pair, or press Done.`, false, event ? 'I paired ' + labels.join(' and ') + '.' : content);
    return event ? reply : { ...reply, acknowledgement: { kind: 'pair', objects: labels, answer: reason } };
  }
  if (step.activityKind === 'category') {
    state.category = done || unsure(content) ? 'animals' : normalizeChoice(content).slice(0, 100);
    state.words = [];
    return result(done || unsure(content) ? 'That is all right.' : '', true);
  }
  if (step.activityKind === 'letter') {
    const choice = normalizeChoice(content).replace(/^(?:the )?letter\s+/i, '').replace(/,?\s+please$/i, '').trim();
    const letter = choice.match(/^([a-z])$/i)?.[1];
    const spoken = { ay:'A', bee:'B', be:'B', see:'C', sea:'C', dee:'D', ee:'E', eff:'F', gee:'G', aitch:'H', eye:'I', jay:'J', kay:'K', el:'L', em:'M', en:'N', oh:'O', pee:'P', cue:'Q', are:'R', ess:'S', tea:'T', tee:'T', you:'U', vee:'V', 'double u':'W', ex:'X', why:'Y', zed:'Z', zee:'Z' };
    state.letterTries = (state.letterTries || 0) + 1;
    state.letter = letter?.toUpperCase() || spoken[choice.toLowerCase()];
    if (!state.letter && !done && !unsure(content) && state.letterTries < 3) return result('Choose just one letter, such as A, B, or C. It is also fine to say you are not sure.');
    state.letter ||= 'A';
    return result('', true);
  }
  if (step.activityKind === 'words') {
    state.words ||= [];
    const finishedWithWords = finishSuffix.test(content);
    const contribution = done ? '' : content.replace(finishSuffix, '').replace(/^(?:i can think of|i thought of|how about|maybe)\s+/i, '');
    if (!contribution.trim() || unsure(content)) return result(state.words.length ? `You came up with ${list(state.words.slice(0, 4))}. There was no number you needed to reach.` : 'That is quite all right. Sometimes words do not come easily. There is no test or score; thank you for giving it a go.', true);
    const words = contribution.split(/[,;\n]|\band\b/i).map(word => word.trim()).filter(Boolean).slice(0, 30);
    const namesCategory = /\b(?:celebrit|names?|people|actors?|singers?|sportspeople)/i.test(state.category || '');
    const matching = words.filter(word => (namesCategory ? word.split(/\s+/) : [word]).some(part => part[0]?.toUpperCase() === state.letter));
    state.words = [...new Set([...state.words, ...matching])].slice(0, 100);
    return result(matching.length ? `${list(matching.slice(0, 5))} — ${namesCategory ? 'those names give us' : 'you found words beginning with'} ${state.letter}.${finishedWithWords ? ' Nicely done; there was no target to reach.' : ' You can share more, or say done whenever you like.'}` : `That is all right. We were thinking of ${state.category} starting with ${state.letter}.${finishedWithWords ? ' There was no target to reach.' : ' Take your time, or say done to move on.'}`, finishedWithWords);
  }
  return null;
}
