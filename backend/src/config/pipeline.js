// Controls which audio processing pipeline is used end-to-end.
//
//   'free'     → mic audio → Groq Whisper (STT) → Groq LLaMA (LLM) → edge-tts (TTS) → Rhubarb
//   'realtime' → mic audio → OpenAI Realtime mini (STT + LLM + TTS in one WebRTC session) → Rhubarb
//
// Switch by setting PIPELINE_MODE= in your .env file, or change the default below for quick dev testing.
export const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'free';
