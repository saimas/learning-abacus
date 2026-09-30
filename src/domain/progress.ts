import type { FadeLevel } from './fade'
import { applyPracticeAttempt, newPracticeRecord, type PracticeRecord } from './practice'
import type { PracticeId } from './problem'
import type { LessonId } from './lessons'

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
  // The やりかた lessons done (spec (howto tutorial) §4), for their ✓ and for
  // whether a × or ÷ round opens its lesson first. Added without a schema
  // bump; it takes over the two walkthrough flags that came before it (see
  // progressStore).
  lessonsSeen: LessonId[]
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    daysPracticed: 0,
    lastSessionDay: null,
    calibrationMs: DEFAULT_CALIBRATION_MS,
    tutorialDone: false,
    practices: {},
    lessonsSeen: [],
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
  playedAt: FadeLevel,
  now: number,
): Progress {
  const existing = progress.practices[id] ?? newPracticeRecord(now)
  return {
    ...progress,
    practices: { ...progress.practices, [id]: applyPracticeAttempt(existing, correct, pace, playedAt, now) },
  }
}

// Spec (howto tutorial) §4: a lesson is done once, however often it is
// finished or left.
export function markLessonSeen(progress: Progress, id: LessonId): Progress {
  if (progress.lessonsSeen.includes(id)) return progress
  return { ...progress, lessonsSeen: [...progress.lessonsSeen, id] }
}
