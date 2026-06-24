// Default pipeline used when a session does not explicitly choose one.
//
//   free                  -> Groq Whisper -> Groq LLM -> streaming edge-tts -> audio energy lipsync
//   openai-fast-scripted -> OpenAI transcription -> OpenAI text model -> streaming OpenAI TTS -> audio energy lipsync
export const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'free';

export const SESSION_PIPELINE_MODES = ['free', 'openai-fast-scripted'];

export const DEFAULT_PIPELINE_MODE = SESSION_PIPELINE_MODES.includes(PIPELINE_MODE)
  ? PIPELINE_MODE
  : 'free';

export const getSessionPipelineMode = (mode) =>
  SESSION_PIPELINE_MODES.includes(mode) ? mode : DEFAULT_PIPELINE_MODE;

export const isOpenAIFastScriptedPipeline = (mode) => mode === 'openai-fast-scripted';

export const usesOpenAITextPipeline = (mode) => isOpenAIFastScriptedPipeline(mode);
