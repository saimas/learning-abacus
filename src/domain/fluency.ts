import type { AtomClass } from './atoms'
import { nextFadeLevel, type FadeLevel } from './fade'

export type AtomRecord = {
  atomId: string
  box: number
  fade: FadeLevel
  consecutiveCorrect: number
  consecutiveWrong: number
  recentLatencyMs: number[]
  dueAt: number
}

export const CLASS_TARGET_MS: Record<AtomClass, number> = {
  direct: 900,
  five: 1200,
  ten: 1400,
  both: 1800,
}

export const LEITNER_MAX_BOX = 5
export const REFLEX_MIN_BOX = 4
export const LATENCY_WINDOW = 3

const MINUTE = 60_000
const BOX_INTERVAL_MS = [0, 10 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE, 3 * 24 * 60 * MINUTE, 7 * 24 * 60 * MINUTE]

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

export function newRecord(atomId: string, now: number): AtomRecord {
  return {
    atomId,
    box: 1,
    fade: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    recentLatencyMs: [],
    dueAt: now,
  }
}

export function medianLatencyMs(record: AtomRecord): number | null {
  if (record.recentLatencyMs.length === 0) return null
  const sorted = [...record.recentLatencyMs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const lower = sorted[mid - 1]
  const upper = sorted[mid]
  if (lower === undefined || upper === undefined) return null
  return (lower + upper) / 2
}

export function latencyTargetMs(cls: AtomClass, calibrationMs: number): number {
  const scale = Math.max(MIN_SCALE, calibrationMs / CLASS_TARGET_MS.direct)
  const target = CLASS_TARGET_MS[cls] * scale * TARGET_MARGIN
  return Math.min(MAX_TARGET_MS, Math.max(MIN_TARGET_MS, target))
}

export function isReflex(record: AtomRecord, cls: AtomClass, calibrationMs: number): boolean {
  if (record.box < REFLEX_MIN_BOX) return false
  if (record.recentLatencyMs.length < LATENCY_WINDOW) return false
  const median = medianLatencyMs(record)
  if (median === null) return false
  return median < latencyTargetMs(cls, calibrationMs)
}

// `latencyMs` is null for an untimed attempt: one answered by moving the
// beads (F0–F2). Speed only becomes a mastery signal once the work is mental,
// so an untimed correct answer counts toward the promotion streak on accuracy
// alone, and its time never reaches the median or the calibration.
export function applyAttempt(
  record: AtomRecord,
  cls: AtomClass,
  correct: boolean,
  latencyMs: number | null,
  calibrationMs: number,
  now: number,
): AtomRecord {
  const box = correct ? Math.min(LEITNER_MAX_BOX, record.box + 1) : 1
  const fastEnough = correct && (latencyMs === null || latencyMs < latencyTargetMs(cls, calibrationMs))
  const consecutiveCorrect = fastEnough ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const recentLatencyMs =
    latencyMs === null
      ? record.recentLatencyMs
      : [...record.recentLatencyMs, latencyMs].slice(-LATENCY_WINDOW)
  const fade = nextFadeLevel(record.fade, consecutiveCorrect, consecutiveWrong)
  const fadeChanged = fade !== record.fade

  return {
    ...record,
    box,
    fade,
    // A fade change makes the atom a different exercise, so its streaks restart.
    consecutiveCorrect: fadeChanged ? 0 : consecutiveCorrect,
    consecutiveWrong: fadeChanged ? 0 : consecutiveWrong,
    recentLatencyMs: fadeChanged ? [] : recentLatencyMs,
    dueAt: now + (BOX_INTERVAL_MS[box] ?? 0),
  }
}
