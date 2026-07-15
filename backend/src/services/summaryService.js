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

export const generateSummary = async (messages, pipelineMode) => {
  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Patient' : 'Aria'}: ${m.content}`)
    .join('\n');

  if (!transcript.trim()) return FALLBACK;

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
      emotionalTone: parsed.emotionalTone || null,
      engagementLevel: parsed.engagementLevel || null,
      sessionScore: parsed.sessionScore || null,
    };
  } catch {
    return FALLBACK;
  }
};
