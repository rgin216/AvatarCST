import { getScriptStep } from '../services/cstScriptService.js';

export function nextReplayInput(session, scenario) {
  const { step } = getScriptStep(session.scriptId, session.scriptStepIndex || 0);
  if (session.interactionState?.adaptiveFollowUp?.stepId === step.id) return scenario.followUpAnswer;
  const answers = scenario.answers[step.id];
  if (!Array.isArray(answers) || !answers.length) throw new Error('No replay answer for step ' + step.id);
  const index = Math.max(0, (session.scriptStepTurnIndex || 1) - 1);
  return answers[Math.min(index, answers.length - 1)];
}
export async function replaySession({ sessionId, scenario, loadSession, respond, maxTurns = 50, onTurn = async () => {} }) {
  if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 200) throw new Error('maxTurns must be 1–200');
  const turns = [];
  let content = '';
  for (let index = 0; index < maxTurns; index++) {
    const turn = await respond({ sessionId, content });
    turns.push(turn);
    await onTurn(turn, index);
    if (turn.sessionCompleteAfterResponse) return { naturalCompletion: true, turns };
    content = nextReplayInput(await loadSession(sessionId), scenario);
  }
  return { naturalCompletion: false, stopReason: 'turn-limit', turns };
}
