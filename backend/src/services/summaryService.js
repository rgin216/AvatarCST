import { generateResponse } from './llmService.js';
import { isOpenAIFastScriptedPipeline } from '../config/pipeline.js';

const SYSTEM_PROMPT = `You are a clinical assistant summarising a cognitive stimulation therapy (CST) session.
Given a conversation transcript between a patient and their AI facilitator Aria, return a JSON object with exactly these four keys:

- "keyTalkingPoints": array of 3 to 5 concise strings describing what the patient shared, remembered, or engaged with
- "emotionalTone": one of "positive", "mixed", "neutral", or "low" — reflecting the patient's overall mood across the conversation
- "engagementLevel": one of "high", "medium", or "low" — reflecting how actively and enthusiastically the patient participated
- "sessionScore": one of "high", "medium", or "low" — an overall quality indicator combining mood and engagement

Respond with ONLY a valid JSON object. No explanation, no markdown, no code blocks.
Example: {"keyTalkingPoints":["Recalled a seaside holiday from childhood."],"emotionalTone":"positive","engagementLevel":"high","sessionScore":"high"}`;

const FALLBACK = { keyTalkingPoints: [], emotionalTone: null, engagementLevel: null, sessionScore: null };

const VALID_TONE = new Set(['positive', 'mixed', 'neutral', 'low']);
const VALID_LEVEL = new Set(['high', 'medium', 'low']);

const MAX_TRANSCRIPT_CHARS = 12_000;

const boundTranscript = (transcript) => {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  const half = Math.floor(MAX_TRANSCRIPT_CHARS / 2);
  return transcript.slice(0, half) + '\n...[transcript truncated]...\n' + transcript.slice(-half);
};

export const generateSummary = async (messages, pipelineMode) => {
  const full = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Patient' : 'Aria'}: ${m.content}`)
    .join('\n');

  if (!full.trim()) return FALLBACK;

  const transcript = boundTranscript(full);
  const provider = isOpenAIFastScriptedPipeline(pipelineMode) ? 'openai' : 'groq';

  const llmMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Session transcript:\n\n${transcript}` },
  ];

  const raw = await generateResponse(llmMessages, { provider, maxTokens: 400, temperature: 0.3 });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return FALLBACK;
    const parsed = JSON.parse(match[0]);
    return {
      keyTalkingPoints: Array.isArray(parsed.keyTalkingPoints) ? parsed.keyTalkingPoints : [],
      emotionalTone: VALID_TONE.has(parsed.emotionalTone) ? parsed.emotionalTone : null,
      engagementLevel: VALID_LEVEL.has(parsed.engagementLevel) ? parsed.engagementLevel : null,
      sessionScore: VALID_LEVEL.has(parsed.sessionScore) ? parsed.sessionScore : null,
    };
  } catch {
    return FALLBACK;
  }
};
