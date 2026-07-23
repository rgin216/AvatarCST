import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyLipSyncFrame,
  getRhubarbMorphStateAtTime,
  rhubarbCueToMorphState,
  rhubarbJsonToTimeline,
} from "./lipSync.js";

test("empty frame keeps the avatar at rest", () => {
  assert.deepEqual(createEmptyLipSyncFrame(), {
    visemes: { viseme_sil: 1 },
    jawOpen: 0,
    speechEnergy: 0,
    active: false,
  });
});

test("Rhubarb cues map to the expected morph targets", () => {
  const closed = rhubarbCueToMorphState({ value: "A" });
  const rounded = rhubarbCueToMorphState({ value: "F" });

  assert.equal(closed.visemes.viseme_PP, 0.62);
  assert.equal(rounded.visemes.viseme_U, 0.55);
});

test("Rhubarb JSON is normalized into a timeline", () => {
  const timeline = rhubarbJsonToTimeline({
    metadata: { duration: 2 },
    mouthCues: [
      { start: 0, end: 0.4, value: "X" },
      { start: 0.4, end: 1, value: "D" },
      { start: 1, end: 2, value: "X" },
    ],
  });

  assert.equal(timeline.source, "rhubarb");
  assert.equal(timeline.duration, 2);
  assert.equal(timeline.cues.length, 3);
});

test("timeline lookup returns the active Rhubarb mouth shape", () => {
  const timeline = rhubarbJsonToTimeline({
    metadata: { duration: 1 },
    mouthCues: [{ start: 0, end: 1, value: "D" }],
  });
  const frame = getRhubarbMorphStateAtTime(timeline, 0.5);

  assert.equal(frame.source, "rhubarb");
  assert.equal(frame.active, true);
  assert.ok(frame.visemes.viseme_aa > 0);
});
