import { shouldShowInputTutorial } from './inputTutorial.js';

export const preparationStorageKey = sessionId => `avatarcst.preparation.${sessionId}`;

// Things to have ready (such as a pen and paper) are shown once, at the same
// point as the input practice: before a fresh session's first slide.
export function shouldShowPreparation(session, acknowledged) {
  return Boolean(session?.preparation) && shouldShowInputTutorial(session, acknowledged);
}
