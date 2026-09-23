import { answerModeForFade, MAX_FADE, nextFadeLevel, type FadeLevel } from './fade'
import type { PracticeId } from './problem'

// Spec (multi-digit ＋ −) §5: one record per practice kind. Problems are
// generated fresh every time, so what gets better is "2-digit addition", not
// any one sum. There is no Leitner box or due date: those schedule material,
// and this practice is chosen, not scheduled.
export type PracticeRecord = {
  fade: FadeLevel
  consecutiveCorrect: number
  consecutiveWrong: number
  lastPractisedAt: number
}

// `pace` is the answer's latency over its problem's time target, so answers
// to problems of different difficulty compare; below 1 is fast enough. It is
// null for an untimed answer, one made on the beads. `assisted` marks an
// answer given after 手順を見る (spec (core rounds) §5): the learner had the
// steps in front of them, so it is not evidence of fluency and must not move
// the record's fade either way.
export type PracticeAttempt = { id: PracticeId; correct: boolean; pace: number | null; assisted: boolean }

export function newPracticeRecord(now: number): PracticeRecord {
  return { fade: 0, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: now }
}

// The same ladder as a single move's (fluency.applyAttempt): five fast
// correct answers in a row promote one level, two misses demote one, and an
// untimed bead answer counts on accuracy alone only while the record's own
// level is still a bead level.
export function applyPracticeAttempt(
  record: PracticeRecord,
  correct: boolean,
  pace: number | null,
  now: number,
): PracticeRecord {
  const waived = pace === null && answerModeForFade(record.fade) === 'beads'
  const fastEnough = correct && (waived || (pace !== null && pace < 1))
  const consecutiveCorrect = fastEnough ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const fade = nextFadeLevel(record.fade, consecutiveCorrect, consecutiveWrong)
  // A fade change makes the practice a different exercise, so its streaks restart.
  const fadeChanged = fade !== record.fade
  return {
    fade,
    consecutiveCorrect: fadeChanged ? 0 : consecutiveCorrect,
    consecutiveWrong: fadeChanged ? 0 : consecutiveWrong,
    lastPractisedAt: now,
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// For a record read back from storage.
export function isPracticeRecord(value: unknown): value is PracticeRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isCount(record.fade) &&
    record.fade <= MAX_FADE &&
    isCount(record.consecutiveCorrect) &&
    isCount(record.consecutiveWrong) &&
    typeof record.lastPractisedAt === 'number' &&
    Number.isFinite(record.lastPractisedAt)
  )
}
