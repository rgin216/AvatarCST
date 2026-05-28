export const RHUBARB_SHAPE_MAP = {
  A: {
    morphs: { viseme_PP: 0.62, mouthClose: 0.22 },
    jawOpen: 0.01,
  },
  B: {
    morphs: { viseme_kk: 0.36, viseme_DD: 0.22, viseme_SS: 0.12 },
    jawOpen: 0.1,
  },
  C: {
    morphs: { viseme_E: 0.58, mouthOpen: 0.18 },
    jawOpen: 0.22,
  },
  D: {
    morphs: { viseme_aa: 0.68, mouthOpen: 0.28 },
    jawOpen: 0.36,
  },
  E: {
    morphs: { viseme_O: 0.58, mouthOpen: 0.16 },
    jawOpen: 0.22,
  },
  F: {
    morphs: { viseme_U: 0.55, mouthOpen: 0.08 },
    jawOpen: 0.14,
  },
  G: {
    morphs: { viseme_FF: 0.62, mouthClose: 0.1 },
    jawOpen: 0.08,
  },
  H: {
    morphs: { viseme_DD: 0.28, viseme_nn: 0.42, mouthOpen: 0.12 },
    jawOpen: 0.2,
  },
  X: {
    morphs: { viseme_sil: 1 },
    jawOpen: 0,
  },
};

const DEFAULT_MIN_RHUBARB_CUE_SECONDS = 0.12;

export function createEmptyLipSyncFrame() {
  return {
    visemes: { viseme_sil: 1 },
    jawOpen: 0,
    speechEnergy: 0,
    active: false,
  };
}

export function rhubarbCueToMorphState(cue) {
  const shape = RHUBARB_SHAPE_MAP[cue?.value] ?? RHUBARB_SHAPE_MAP.X;

  return {
    source: "rhubarb",
    rhubarbShape: cue?.value ?? "X",
    visemes: shape.morphs,
    jawOpen: shape.jawOpen,
    active: cue?.value !== "X",
  };
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function scaleState(state, intensity) {
  const scaledVisemes = {};

  Object.entries(state.visemes ?? {}).forEach(([targetName, value]) => {
    scaledVisemes[targetName] = value * intensity;
  });

  return {
    ...state,
    visemes: scaledVisemes,
    jawOpen: state.jawOpen * intensity,
  };
}

function blendStates(fromState, toState, amount) {
  const t = smoothstep(amount);
  const targetNames = new Set([
    ...Object.keys(fromState.visemes ?? {}),
    ...Object.keys(toState.visemes ?? {}),
  ]);
  const visemes = {};

  targetNames.forEach((targetName) => {
    const fromValue = fromState.visemes?.[targetName] ?? 0;
    const toValue = toState.visemes?.[targetName] ?? 0;
    visemes[targetName] = fromValue + (toValue - fromValue) * t;
  });

  return {
    ...toState,
    visemes,
    jawOpen: fromState.jawOpen + (toState.jawOpen - fromState.jawOpen) * t,
    active: fromState.active || toState.active,
  };
}

function mergeAdjacentCues(cues) {
  return cues.reduce((merged, cue) => {
    const previous = merged[merged.length - 1];

    if (previous && previous.value === cue.value) {
      previous.end = cue.end;
    } else {
      merged.push({ ...cue });
    }

    return merged;
  }, []);
}

function removeShortRhubarbCues(cues, minCueSeconds) {
  const stable = [...cues];

  for (let i = 0; i < stable.length; i += 1) {
    const cue = stable[i];
    const duration = cue.end - cue.start;
    const previous = stable[i - 1];
    const next = stable[i + 1];

    if (duration >= minCueSeconds || cue.value === "X") continue;

    if (previous && next && previous.value === next.value) {
      previous.end = next.end;
      stable.splice(i, 2);
      i = Math.max(-1, i - 2);
    } else if (previous && previous.value !== "X") {
      previous.end = cue.end;
      stable.splice(i, 1);
      i -= 1;
    } else if (next) {
      next.start = cue.start;
      stable.splice(i, 1);
      i -= 1;
    }
  }

  return mergeAdjacentCues(stable);
}

export function rhubarbJsonToTimeline(json, options = {}) {
  const cues = Array.isArray(json?.mouthCues) ? json.mouthCues : [];
  const minCueSeconds = options.minCueSeconds ?? DEFAULT_MIN_RHUBARB_CUE_SECONDS;
  const duration =
    Number(json?.metadata?.duration) ||
    cues.reduce((max, cue) => Math.max(max, Number(cue.end) || 0), 0);
  const normalizedCues = mergeAdjacentCues(
    cues.map((cue) => ({
      start: Number(cue.start) || 0,
      end: Number(cue.end) || 0,
      value: cue.value || "X",
    })),
  );

  return {
    source: "rhubarb",
    duration,
    cues: removeShortRhubarbCues(normalizedCues, minCueSeconds),
    rawCueCount: normalizedCues.length,
  };
}

export function getRhubarbMorphStateAtTime(timeline, time, options = {}) {
  const blendWindow = options.blendWindow ?? 0.09;
  const intensity = options.intensity ?? 1;
  const cues = timeline?.cues ?? [];

  if (cues.length === 0) return createEmptyLipSyncFrame();

  const cueIndex = Math.max(
    0,
    cues.findIndex((candidate) => time >= candidate.start && time < candidate.end),
  );
  const currentCue = cues[cueIndex] ?? cues[cues.length - 1];
  const previousCue = cues[Math.max(0, cueIndex - 1)];
  const nextCue = cues[Math.min(cues.length - 1, cueIndex + 1)];
  const cueDuration = Math.max(0.001, currentCue.end - currentCue.start);
  const effectiveBlendWindow = Math.min(blendWindow, cueDuration * 0.35);
  let state = rhubarbCueToMorphState(currentCue);

  if (previousCue && currentCue && time - currentCue.start < effectiveBlendWindow) {
    state = blendStates(
      rhubarbCueToMorphState(previousCue),
      state,
      (time - currentCue.start) / effectiveBlendWindow,
    );
  }

  if (nextCue && currentCue && currentCue.end - time < effectiveBlendWindow) {
    state = blendStates(
      state,
      rhubarbCueToMorphState(nextCue),
      1 - (currentCue.end - time) / effectiveBlendWindow,
    );
  }

  const scaled = scaleState(state, intensity);
  return {
    ...scaled,
    speechEnergy: scaled.active ? Math.min(1, scaled.jawOpen + 0.2) : 0,
  };
}
