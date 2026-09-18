export const tutorialStorageKey = sessionId => `avatarcst.input-practice.${sessionId}`;
export function shouldShowInputTutorial(session, completed) {
  return Boolean(session) && !completed && ['pending', 'active'].includes(session.status)
    && !(session.scriptStepIndex > 0 || session.scriptStepTurnIndex > 0);
}
