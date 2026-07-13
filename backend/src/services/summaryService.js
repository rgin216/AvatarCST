import { generateResponse } from './llmService.js';
import { isOpenAIFastScriptedPipeline } from '../config/pipeline.js';

const SYSTEM_PROMPT = `You are a clinical assistant helping summarise a cognitive stimulation therapy (CST) session.
Given a conversation transcript between a patient and their AI facilitator Aria, extract 3 to 5 key talking points a caregiver would find meaningful.
Focus on: personal memories the patient shared, topics they engaged with warmly, emotional moments, or notable things they mentioned.
Respond with ONLY a valid JSON array of concise strings. No explanation, no markdown, no code blocks.
Example: ["Patient recalled a holiday in Napier.", "Expressed fondness for gardening."]`;

export const generateSummary = async (messages, pipelineMode) => {
  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Patient' : 'Aria'}: ${m.content}`)
    .join('\n');

  if (!transcript.trim()) return [];

  const provider = isOpenAIFastScriptedPipeline(pipelineMode) ? 'openai' : 'groq';

  const llmMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Session transcript:\n\n${transcript}` },
  ];

  const raw = await generateResponse(llmMessages, { provider, maxTokens: 300, temperature: 0.3 });

  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
};
