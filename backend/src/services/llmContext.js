import { AsyncLocalStorage } from 'node:async_hooks';
const storage = new AsyncLocalStorage();
// Separate from the evaluation store so every request can report scripted fallbacks, not only evaluated sessions.
const fallbackCounters = new AsyncLocalStorage();
const nextRequestTimes = new Map();
export const withSessionLlm = (facilitator, calls, operation, policy = {}) => storage.run({ facilitator, calls, policy }, operation);
export const getSessionLlm = () => storage.getStore();
export const trackLlmFallbacks = (counter, operation) => fallbackCounters.run(counter, operation);
export const recordLlmFallback = reason => {
  const counter = fallbackCounters.getStore();
  if (counter) counter.count += 1;
  storage.getStore()?.calls.push({ kind: 'fallback', reason });
};
export async function paceSessionRequest(context) {
  const interval = context?.policy?.minimumIntervalMs || 0;
  if (!interval) return;
  const key = context.facilitator.provider + ':' + context.facilitator.model;
  const now = Date.now();
  const due = Math.max(now, nextRequestTimes.get(key) || 0);
  nextRequestTimes.set(key, due + interval);
  if (due > now) await new Promise(resolve => setTimeout(resolve, due - now));
}
