const passed = (answer = '') => /\b(?:pass|skip|not sure|don[’']?t know|do not know|nothing|can[’']?t think|cannot think)\b/i.test(answer);

export function orientationPracticeContext(state = {}, step, answer = '') {
  return {
    ...state,
    ...(step?.id === 'orientation_favourite_place' && answer
      ? { gardenExample: passed(answer) } : {}),
    ...(step?.id === 'orientation_neighbour_colour' && answer
      ? { streetExample: passed(answer) } : {}),
  };
}

export function sensoryQuestion(sense, context = {}) {
  if (!context.orientationPractice?.gardenExample) return `In the place you are imagining, what are one or two things you can ${sense}? It is fine if nothing comes to mind.`;
  const questions = {
    see: 'Let us imagine a quiet garden together. What might you see around you — perhaps flowers or trees?',
    smell: 'In our imaginary garden, what might you smell — perhaps flowers or freshly cut grass?',
    hear: 'Sitting in our imaginary garden, what sounds might you hear?',
    taste: 'Imagine having a little picnic in the garden. What would you enjoy tasting?',
    touch: 'In our imaginary garden, what might you touch — perhaps a leaf or a smooth wooden bench?',
  };
  return questions[sense];
}

export function neighbourhoodQuestion(suffix, original, context = {}) {
  if (!context.orientationPractice?.streetExample) return original;
  return {
    block: 'Let us imagine a quiet street with a few houses and gardens. About how many houses would you picture on that block?',
    corner: 'On our imaginary street, how many houses might there be between our front door and the corner?',
    lines: 'Would you picture overhead telephone lines on our imaginary street, or lines tucked underground?',
    footpaths: 'Would our imaginary street have footpaths on both sides? Would you imagine them smooth or cracked?',
    flowers: 'What flowers or plants would you like to see along our imaginary street?',
  }[suffix] || original;
}

const cleanPlace = (value = '') => {
  const place = value.trim().replace(/^(?:in|at|near)\s+/i, '').replace(/[.!?]+$/, '').trim();
  if (!place || place.length > 80 || place.split(/\s+/).length > 9 || passed(place)) return null;
  if (!/^[\p{L}\p{M} '\u2019,.-]+$/u.test(place) || /\b(?:ignore|instruction|prompt|system|say|tell|remember|yes|no|my|mother|father|she|he|did|was|think|maybe|i|we|you|moved|but)\b/i.test(place)) return null;
  return place;
};
export function extractChildhoodPlace(content = '', allowBare = false) {
  const match = content.trim().match(/^(?:i\s+)?grew up\s+(?:in|at|near)\s+([^.!?]+)[.!?]?$/i);
  return match ? cleanPlace(match[1]) : allowBare ? cleanPlace(content) : null;
}
export function childhoodPlaceFromMemory(entries = []) {
  const places = entries.filter(entry=>entry.status === 'approved')
    .map(entry=>extractChildhoodPlace(entry.content)).filter(Boolean);
  const distinct = [...new Map(places.map(place=>[place.toLowerCase(),place])).values()];
  return distinct.length === 1 ? distinct[0] : null;
}
export function childhoodPlaceFromMessages(messages = []) {
  const previous = new Map();
  let found = null;
  for (const message of messages) {
    const id = String(message.sessionId);
    const prompt = previous.get(id);
    if (message.role === 'user' && prompt?.role === 'assistant' && /\bwhere did you grow up\?\s*$/i.test(prompt.content)) {
      // Only a direct answer to this exact question qualifies; birthplace and
      // other people's childhoods must not silently become the user's history.
      found = extractChildhoodPlace(message.content, true) || null;
    }
    previous.set(id, message);
  }
  return found;
}
export const grewUpQuestion = ({ rememberedChildhoodPlace } = {}) => rememberedChildhoodPlace
  ? `You previously mentioned growing up in ${rememberedChildhoodPlace}. Have I remembered that correctly?`
  : 'These maps show the world and New Zealand. Where did you grow up?';
