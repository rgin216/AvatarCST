// Shared translated lookups for session-summary enum values so that the
// End page and the Caregiver page render one consistent label per value.
const TONE_KEYS = ["positive", "mixed", "neutral", "low"];
const LEVEL_KEYS = ["high", "medium", "low"];

export const toneLabel = (t, value) =>
  TONE_KEYS.includes(value) ? t(`summary.tone.${value}`) : "—";

// engagementLevel and sessionScore share the same high/medium/low scale.
export const levelLabel = (t, value) =>
  LEVEL_KEYS.includes(value) ? t(`summary.level.${value}`) : "—";
