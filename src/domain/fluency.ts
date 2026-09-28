import type { AtomClass } from './atoms'

// The time targets of the 180 single-rod moves, by technique class, scaled
// to the learner's calibration. A round's time target is built from them,
// one move at a time (problemTargetMs). The per-move records and schedule
// that once used them went with 基礎の練習 (spec (roll) §2).
export const CLASS_TARGET_MS: Record<AtomClass, number> = {
  direct: 900,
  five: 1200,
  ten: 1400,
  both: 1800,
}

// The promotion gate is "median latency under target", and the target is
// derived from the learner's own rolling median. Without a margin above that
// median the gate reduces to "beat your own median" — a coin flip per attempt,
// which makes a FADE_PROMOTE_STREAK run a ~1-in-100 event and the fade ladder
// effectively unclimbable. 1.2 is deliberately modest: latency is measured
// submit-to-submit, so it carries a near-constant input cost (reading, typing,
// tapping) that does not shrink as the arithmetic does, and a looser margin
// would let an atom clear the whole ladder in a couple of days.
export const TARGET_MARGIN = 1.2

// Scale has a floor but no ceiling: capping it would pin a slow learner's
// target *below* their own median and freeze them at F0 forever, which is the
// opposite of calibrating to the learner. Runaway values are caught by the
// absolute clamp on the resulting target instead.
const MIN_SCALE = 0.6
export const MIN_TARGET_MS = 400
export const MAX_TARGET_MS = 8_000

// Spec §12: these are first estimates. They need calibration against real
// usage data before they can be trusted as anything more.

export function latencyTargetMs(cls: AtomClass, calibrationMs: number): number {
  const scale = Math.max(MIN_SCALE, calibrationMs / CLASS_TARGET_MS.direct)
  const target = CLASS_TARGET_MS[cls] * scale * TARGET_MARGIN
  return Math.min(MAX_TARGET_MS, Math.max(MIN_TARGET_MS, target))
}
