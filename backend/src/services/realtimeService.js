import { buildCstRealtimeInstructions } from './promptService.js';

export const createRealtimeSessionConfig = ({ user, memoryEntries, slide, recentMessages }) => ({
  session: {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
    instructions: buildCstRealtimeInstructions({ user, memoryEntries, slide, recentMessages }),
    audio: {
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || 'marin',
      },
    },
  },
});

export const mintRealtimeClientSecret = async (context) => {
  if (!process.env.OPENAI_API_KEY) {
    const err = new Error('OPENAI_API_KEY is required to create a realtime session');
    err.status = 503;
    throw err;
  }

  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createRealtimeSessionConfig(context)),
  });

  if (!response.ok) {
    const detail = await response.text();
    const err = new Error(`Failed to create realtime session: ${detail}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
};
