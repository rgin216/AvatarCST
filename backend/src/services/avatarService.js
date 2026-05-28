const DEFAULT_VISEME_MAP = [
  { at: 0, mouth: 'rest' },
  { at: 120, mouth: 'AI' },
  { at: 260, mouth: 'E' },
  { at: 420, mouth: 'O' },
  { at: 620, mouth: 'rest' },
];

export const buildAvatarResponse = ({ text, audioUrl = null, visemes = null }) => ({
  placement: 'bottom-right',
  renderer: 'three-js',
  audio: {
    status: audioUrl ? 'ready' : 'pending_generation',
    url: audioUrl,
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
    voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
  },
  lipsync: {
    engine: 'rhubarb',
    status: audioUrl ? 'ready' : 'waiting_for_audio',
    visemes: visemes || DEFAULT_VISEME_MAP,
  },
  text,
});

export const streamAvatarResponse = async (text) => buildAvatarResponse({ text });
