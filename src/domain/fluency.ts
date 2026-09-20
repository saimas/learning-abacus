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
export const LATENCY_WINDOW = 5

const MINUTE = 60_000
const BOX_INTERVAL_MS = [0, 10 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE, 3 * 24 * 60 * MINUTE, 7 * 24 * 60 * MINUTE]

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

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
  const raw = calibrationMs / CLASS_TARGET_MS.direct
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
  return CLASS_TARGET_MS[cls] * scale
}

export function isReflex(record: AtomRecord, cls: AtomClass, calibrationMs: number): boolean {
  if (record.box < REFLEX_MIN_BOX) return false
  if (record.recentLatencyMs.length < LATENCY_WINDOW) return false
  const median = medianLatencyMs(record)
  if (median === null) return false
  return median < latencyTargetMs(cls, calibrationMs)
}

export function applyAttempt(
  record: AtomRecord,
  _cls: AtomClass,
  correct: boolean,
  latencyMs: number,
  now: number,
): AtomRecord {
  const box = correct ? Math.min(LEITNER_MAX_BOX, record.box + 1) : 1
  const consecutiveCorrect = correct ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const recentLatencyMs = [...record.recentLatencyMs, latencyMs].slice(-LATENCY_WINDOW)
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
