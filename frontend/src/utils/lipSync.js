export function createEmptyLipSyncFrame() {
  return {
    visemes: { viseme_sil: 1 },
    jawOpen: 0,
    speechEnergy: 0,
    active: false,
  };
}
