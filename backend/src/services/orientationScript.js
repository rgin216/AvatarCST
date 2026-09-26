import { sensoryQuestion, neighbourhoodQuestion, grewUpQuestion } from './orientationContext.js';
import { adaptiveConversation } from './cstScriptHelpers.js';

// Reuse the established 15-slide opening and closing controls. Preserve getters
// (notably the live NZ year) when cloning the shared steps.
export function createOrientationScript(shared) {
  const clone = (source, overrides = {}) => {
    const step = Object.defineProperties({}, Object.getOwnPropertyDescriptors(source));
    step.id = source.id.replace('faces_scenes_', 'orientation_');
    if (step.nextStepId) step.nextStepId = step.nextStepId.replace('faces_scenes_', 'orientation_');
    if (step.seasonBranches) step.seasonBranches = Object.fromEntries(Object.entries(step.seasonBranches).map(([season, id]) => [season, id.replace('faces_scenes_', 'orientation_')]));
    Object.assign(step, overrides);
    step.visualHint = `Source deck: NZ11. Orientation, slide ${step.deckSlide}`;
    return step;
  };
  const opening = shared.slice(0, shared.findIndex((step) => step.id === 'faces_scenes_theme_intro') + 1).map((step) => clone(step));
  Object.assign(opening[0], {
    subtitle: 'Session 11: Orientation', bullets: ['Session 11', 'Orientation'],
    reply: ({ name }) => `Welcome back, ${name}. Today is Session 11: Orientation. We will explore familiar places, landmarks, and memories together. Take your time.`,
  });
  Object.assign(opening.at(-1), {
    title: 'Orientation', subtitle: 'Places and finding our way', prompt: 'Orientation',
    bullets: ['Familiar places', 'Landmarks', 'Memories'],
    reply: () => 'Today we will explore places and the things that help us find our way. We will try a few gentle landmark questions and share memories of places we know.',
  });
  const discussion = (suffix, deckSlide, title, prompt, guidance, extra = {}) => ({
    id: `orientation_${suffix}`, deckSlide, title, subtitle: 'Places and memories', prompt,
    bullets: [], turns: 1, acceptAnyAnswer: true, accent: '#4472C4',
    visualHint: `Source deck: NZ11. Orientation, slide ${deckSlide}`,
    guidance, reply: () => prompt, ...extra,
  });
  const landmark = (slide, number, question, options, answerIndex, aliases = []) => {
    const answer = options[answerIndex];
    return discussion(`landmark_${slide}_${number}`, slide, 'Geography & Landmarks', question,
      `Accept an option letter or place name. The answer is ${answer}. Give gentle feedback and move on after one attempt, including uncertainty.`, {
        inactivityTimeoutMs: 180000,
        trivia: { choices: options, answer, aliases: [answer, ...aliases] },
        interaction: { type: 'choiceQuestion', question, progress: `Question ${number} of 5`, options },
        reply: () => `${number === 1 ? (slide === 17 ? 'Let us move on to some general geography trivia. These are just for fun, so take your time. ' : 'Now, let us move on to some general landmark trivia. ') : ''}${question} ${options.map((option, index) => `${'ABCD'[index]}, ${option}`).join('; ')}. You can choose from the list, say the letter or place, or say I am not sure.`,
      });
  };
  const focused = (suffix, slide, title, question, progress) => discussion(suffix, slide, title, question,
    'Ask only this question and wait. Accept a short answer, an approximation, no memory, or a wish to pass. Do not grade personal memories or add another question; the next scripted step supplies it. Keep acknowledgement brief.', {
      interaction: { type: 'focusedQuestion', question, progress }, inactivityTimeoutMs: 120000,
      contextualQuestion: (context) => suffix.startsWith('sensory_')
        ? sensoryQuestion(suffix.slice(8), context)
        : suffix.startsWith('neighbour_') ? neighbourhoodQuestion(suffix.slice(10), question, context) : question,
      reply: (context) => suffix.startsWith('sensory_')
        ? sensoryQuestion(suffix.slice(8), context)
        : suffix.startsWith('neighbour_') ? neighbourhoodQuestion(suffix.slice(10), question, context) : question,
    });
  const reminiscence = adaptiveConversation('Invite at most one related memory if they seem interested. Do not assume they travelled, lived in New Zealand, or remember exact details. Respect uncertainty and wishes to move on.');
  return [
    ...opening,
    discussion('orienteering', 16, 'Orienteering', 'Orienteering is an activity where people use a map and compass to find their way. Have you ever used a map or compass, or do you prefer familiar landmarks?', 'Acknowledge any way of navigating, including asking someone for help.', { adaptiveFollowUp: reminiscence }),
    landmark(17, 1, 'What is the large lake in the middle of the North Island called?', ['Lake Wānaka', 'Lake Taupō', 'Lake Rotorua'], 1, ['Taupo']),
    landmark(17, 2, 'Which city is home to the Sky Tower?', ['Wellington', 'Auckland / Tāmaki Makaurau', 'Hamilton'], 1, ['Auckland', 'Tamaki Makaurau']),
    landmark(17, 3, 'Which place is known for its geysers and hot pools?', ['Rotorua', 'Napier', 'Dunedin'], 0),
    landmark(17, 4, 'Which region includes Cape Reinga in the Far North?', ['Canterbury', 'Southland', 'Northland'], 2),
    landmark(17, 5, 'Which mountain looks like Mount Fuji and has appeared in a film?', ['Mount Cook / Aoraki', 'Mount Taranaki / Mount Egmont', 'Mount Ruapehu'], 1, ['Taranaki', 'Egmont']),
    landmark(18, 1, 'Which North Island city is famous for its Art Deco buildings?', ['Napier', 'Hamilton', 'Whangārei'], 0),
    landmark(18, 2, 'Which city is known as the City of Sails?', ['Christchurch', 'Wellington', 'Auckland / Tāmaki Makaurau'], 2, ['Auckland', 'Tamaki Makaurau']),
    landmark(18, 3, 'Which caves are famous for their glowworms?', ['Waitomo Caves', 'Lake Taupō', 'Cape Reinga'], 0, ['Waitomo']),
    // The source combines hot pools and Pancake Rocks. Use the unambiguous clue.
    landmark(18, 4, 'Which place is famous for the Pancake Rocks?', ['Hanmer Springs', 'Rotorua', 'Punakaiki'], 2),
    landmark(18, 5, 'Which town is known for its giant carrot statue?', ['Ōhakune', 'Napier', 'Taupō'], 0, ['Ohakune']),
    focused('favourite_place', 19, 'Your favourite place', 'Imagine somewhere you feel comfortable. It might be your garden, a beach, or a place from long ago. Which place comes to mind?', 'Choose a place'),
    ...['see', 'smell', 'hear', 'taste', 'touch'].map((sense, index) => focused(`sensory_${sense}`, 19, 'Your favourite place',
      `In the place you are imagining, what are one or two things you can ${sense}? It is fine if nothing comes to mind.`, `${index + 1} of 5 senses`)),
    focused('neighbour_colour', 20, 'Your neighbourhood', 'Now picture the street outside your home, or a street you remember. What colour is the house or building next door?', 'Question 1 of 6'),
    focused('neighbour_block', 20, 'Your neighbourhood', 'About how many houses or buildings are on that block? A rough guess is fine.', 'Question 2 of 6'),
    focused('neighbour_corner', 20, 'Your neighbourhood', 'About how many houses or buildings are between that home and the corner?', 'Question 3 of 6'),
    focused('neighbour_lines', 20, 'Your neighbourhood', 'Are the telephone lines overhead or below ground, or are you not sure?', 'Question 4 of 6'),
    focused('neighbour_footpaths', 20, 'Your neighbourhood', 'Are there footpaths on both sides of the street? If so, are they mostly smooth or cracked?', 'Question 5 of 6'),
    focused('neighbour_flowers', 20, 'Your neighbourhood', 'What flowers or plants do you remember along that street?', 'Question 6 of 6'),
    discussion('grew_up', 21, 'Where did you grow up?', 'These maps show the world and New Zealand. Where did you grow up?', 'If a childhood place is recalled, ask whether it is correct. Accept corrections and uncertainty; never insist the memory is right. Otherwise accept any place without assuming a New Zealand childhood.', { reply: grewUpQuestion, contextualQuestion: grewUpQuestion, adaptiveFollowUp: reminiscence }),
    discussion('australia', 22, 'Holiday places', 'This is a map of Australia. Is there somewhere there you enjoyed visiting, or would like to visit? You can also tell me about a holiday closer to home.', 'Do not assume a visit to Australia. A local outing or no travel is equally welcome.', { adaptiveFollowUp: reminiscence }),
    discussion('pacific', 23, 'The Pacific', 'This map shows islands in the Pacific. Is there an island or place on it that you recognise?', 'The map includes Fiji, Samoa, Tonga, the Cook Islands, Papua New Guinea, and other Pacific places. Accept any recognisable place or personal connection.', { adaptiveFollowUp: reminiscence }),
    discussion('europe', 24, 'Europe and nearby places', 'Here is a map of Europe and nearby places. Is there a country you recognise or feel a connection with?', 'Accept any visible country or a connection through family, travel, or stories. Do not require travel experience.', { adaptiveFollowUp: reminiscence }),
    clone(shared.find((step) => step.id === 'faces_scenes_spin_question'), { deckSlide: 25 }),
    clone(shared.find((step) => step.id === 'faces_scenes_summary_song'), {
      deckSlide: 26,
      followUps: [({ sessionSummary }) => `Let us look back over today. ${sessionSummary || 'We explored landmarks, imagined familiar places, and looked at maps together.'} What is one part you would like to remember?`],
    }),
    clone(shared.find((step) => step.id === 'faces_scenes_closing'), {
      deckSlide: 27, subtitle: 'Session 12: Using Money', bullets: ['Thank you', 'Using Money'],
      reply: ({ name }) => `Thank you for joining me today, ${name}. Next time our theme is Using Money. Ka kite anō, and I look forward to seeing you again.`,
    }),
  ];
}
