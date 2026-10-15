// Default pipeline used when a session does not explicitly choose one.
//
//   free                 -> Groq Whisper -> Groq LLM -> edge-tts -> Rhubarb for avatars / energy for visualizer
//   openai-fast-scripted -> OpenAI transcription -> OpenAI text model -> OpenAI TTS -> Rhubarb for avatars / energy for visualizer
// STT_PROVIDER=groq|openai overrides only the transcription step (see getTranscriptionProviders).
export const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'openai-fast-scripted';

export const SESSION_PIPELINE_MODES = process.env.NODE_ENV === 'development'
  ? ['free', 'openai-fast-scripted']
  : ['openai-fast-scripted'];

export const DEFAULT_PIPELINE_MODE = SESSION_PIPELINE_MODES.includes(PIPELINE_MODE)
  ? PIPELINE_MODE
  : 'openai-fast-scripted';

export const getSessionPipelineMode = (mode) =>
  SESSION_PIPELINE_MODES.includes(mode) ? mode : DEFAULT_PIPELINE_MODE;

export const isOpenAIFastScriptedPipeline = (mode) =>
  process.env.NODE_ENV !== 'development' || mode === 'openai-fast-scripted';

export const usesOpenAITextPipeline = (mode) => isOpenAIFastScriptedPipeline(mode);

const STT_PROVIDERS = ['groq', 'openai'];

// STT_PROVIDER lets transcription use a different provider from the pipeline's LLM and TTS,
// e.g. Groq Whisper with OpenAI text and voice. When it overrides, the pipeline's own provider is the fallback.
export const getTranscriptionProviders = (mode) => {
  const pipelineProvider = usesOpenAITextPipeline(mode) ? 'openai' : 'groq';
  const override = process.env.STT_PROVIDER?.trim().toLowerCase();
  if (!STT_PROVIDERS.includes(override) || override === pipelineProvider) {
    return { provider: pipelineProvider, fallbackProvider: null };
  }
  return { provider: override, fallbackProvider: pipelineProvider };
};
