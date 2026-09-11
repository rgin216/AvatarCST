export function classifyPictureAnswer(content = '') {
  const answer = content.toLowerCase().replace(/[’']/g, '');
  if (/\b(not sure|unsure|dont know|do not know|cant tell|cannot tell|no idea)\b/.test(answer)) return 'unsure';
  const ai = /\b(ai|a\.i\.?|artificial|generated|fake)\b/.test(answer);
  const real = /\b(real|genuine|actual|human)\b/.test(answer);
  if (/\bnot (?:a )?real\b/.test(answer)) return 'ai';
  if (/\bnot (?:ai|fake|generated|artificial)\b/.test(answer)) return 'real';
  return ai === real ? 'unsure' : ai ? 'ai' : 'real';
}

export function pictureRevealReply({ answer, previousAnswer = '', recentMessages = [], random = Math.random }) {
  const guess = classifyPictureAnswer(previousAnswer);
  const label = answer === 'real' ? 'a real person' : 'AI generated';
  const options = guess === 'unsure' ? [
    `This picture is actually ${label}. These can be tricky to tell apart.`,
    `This one is ${label}. It is quite all right to be unsure.`,
    `Here is the answer: this picture is ${label}. There is no pressure to guess.`,
  ] : guess === answer ? [
    `You got it — this picture is ${label}.`,
    `That is right. This one is ${label}.`,
    `Well spotted. This picture is ${label}.`,
  ] : [
    `A reasonable guess. This picture is actually ${label}.`,
    `This one can be misleading — it is actually ${label}.`,
    `It can be hard to tell. This picture is actually ${label}.`,
  ];
  const recent = recentMessages.filter((message) => message.role === 'assistant').slice(-8).map((message) => message.content || '');
  const available = options.filter((option) => !recent.some((text) => text.includes(option.split(/[.!—]/)[0].trim())));
  const pool = available.length ? available : options;
  const reply = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return guess !== 'unsure' && guess !== answer
    ? reply + ' AI technology can now create very lifelike faces, so it can easily fool our eyes. Even real photographs can look artificial; appearance alone is not a reliable way to tell.'
    : reply;
}
