import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EvaluationCounter } from '../models/Evaluation.js';
import { assertProviderCredentials } from '../services/llmProviders.js';

const roster = JSON.parse(readFileSync(new URL('../../evaluation/models.json', import.meta.url), 'utf8'));
export const liveEvaluationEnabled = () => process.env.LLM_EVALUATION_ENABLED === 'true';
export const getLiveModels = () => roster.map(m => ({ ...m }));
export function chooseFacilitator(models, selection, sequence = 1) {
  const selected = selection === 'rotate' ? models[(sequence - 1) % models.length] : models.find(m => m.id === selection);
  if (!selected) throw Object.assign(new Error('Unknown evaluation facilitator'), { status: 400 });
  return selected;
}
export async function createEvaluationAssignment(userId, selection) {
  if (!selection || selection === 'off') return undefined;
  if (!liveEvaluationEnabled()) throw Object.assign(new Error('Live LLM evaluation is disabled on the server'), { status: 403 });
  const models = getLiveModels();
  if (!userId) throw Object.assign(new Error('A user is required for evaluation'), { status: 400 });
  chooseFacilitator(models, selection);
  try { assertProviderCredentials(models); } catch (error) { error.status = 503; throw error; }
  let sequence = 1;
  if (selection === 'rotate') {
    const rosterHash = createHash('sha256').update(JSON.stringify(models)).digest('hex').slice(0, 12);
    const id = String(userId) + ':' + rosterHash;
    let counter;
    try {
      counter = await EvaluationCounter.findOneAndUpdate({ _id: id }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      counter = await EvaluationCounter.findOneAndUpdate({ _id: id }, { $inc: { value: 1 } }, { returnDocument: 'after' });
    }
    sequence = counter.value;
  }
  const facilitator = chooseFacilitator(models, selection, sequence);
  return { version: 1, selection, sequence, facilitator, critics: models.filter(m => m.id !== facilitator.id) };
}
