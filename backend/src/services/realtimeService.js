import { buildCstRealtimeInstructions } from './promptService.js';

const REALTIME_SECRET_TIMEOUT_MS = Number(process.env.OPENAI_REALTIME_SECRET_TIMEOUT_MS || 10000);

export const createRealtimeSessionConfig = ({ session, user, memoryEntries, slide, nextSlide, recentMessages }) => ({
  session: {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini',
    instructions: buildCstRealtimeInstructions({
      user,
      memoryEntries,
      slide,
      nextSlide,
      recentMessages,
      scriptId: session?.scriptId,
      stepTurnIndex: session?.scriptStepTurnIndex || 0,
    }),
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REALTIME_SECRET_TIMEOUT_MS);
  let response;

  try {
    response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createRealtimeSessionConfig(context)),
      signal: controller.signal,
    });
  } catch (originalError) {
    const isTimeout = originalError?.name === 'AbortError';
    const err = new Error(
      isTimeout
        ? `Timed out creating realtime session after ${REALTIME_SECRET_TIMEOUT_MS}ms`
        : `Network failure creating realtime session${originalError?.status ? ` (${originalError.status})` : ''}`
    );
    err.status = isTimeout ? 504 : 502;
    err.cause = originalError;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    const err = new Error(`Failed to create realtime session: ${detail}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
};
