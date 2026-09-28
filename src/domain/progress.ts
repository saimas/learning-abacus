import { applyPracticeAttempt, newPracticeRecord, type PracticeRecord } from './practice'
import type { PracticeId } from './problem'

export const SCHEMA_VERSION = 1
export const DEFAULT_CALIBRATION_MS = 900

export type Progress = {
  schemaVersion: number
  daysPracticed: number
  lastSessionDay: string | null
  // Measured by 基礎の練習 until it was removed (spec (roll) §2); kept as
  // stored, it still sets a round's time targets.
  calibrationMs: number
  tutorialDone: boolean
  // Multi-digit practice, one record per kind (spec: multi-digit ＋ − §5).
  // Added without a schema bump.
  practices: Partial<Record<PracticeId, PracticeRecord>>
  // Whether the learner has seen how 両落とし multiplication works (spec:
  // multiplication §4). Added without a schema bump.
  multiplyIntroDone: boolean
  // Whether the learner has seen how 商除法 division works (spec: division
  // §3), apart from the × walkthrough since each is shown before its own
  // operation's first round. Added without a schema bump.
  divideIntroDone: boolean
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    daysPracticed: 0,
    lastSessionDay: null,
    calibrationMs: DEFAULT_CALIBRATION_MS,
    tutorialDone: false,
    practices: {},
    multiplyIntroDone: false,
    divideIntroDone: false,
  }
}

export function dayKey(now: number): string {
  const d = new Date(now)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function markDayPracticed(progress: Progress, day: string): Progress {
  if (progress.lastSessionDay === day) return progress
  return { ...progress, daysPracticed: progress.daysPracticed + 1, lastSessionDay: day }
}

// An answer updates only its own kind's record, and leaves the calibration
// as stored.
export function recordPracticeAttempt(
  progress: Progress,
  id: PracticeId,
  correct: boolean,
  pace: number | null,
  now: number,
): Progress {
  const existing = progress.practices[id] ?? newPracticeRecord(now)
  return {
    ...progress,
    practices: { ...progress.practices, [id]: applyPracticeAttempt(existing, correct, pace, now) },
  }
}
