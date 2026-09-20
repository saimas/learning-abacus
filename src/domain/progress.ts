import { classify } from './atoms'
import { highestUnlockedStage, type StageIndex } from './curriculum'
import {
  applyAttempt,
  LATENCY_WINDOW,
  medianLatencyMs,
  newRecord,
  type AtomRecord,
} from './fluency'

export const SCHEMA_VERSION = 1
export const DEFAULT_CALIBRATION_MS = 900

export type Progress = {
  schemaVersion: number
  atoms: Record<string, AtomRecord>
  daysPracticed: number
  lastSessionDay: string | null
  calibrationMs: number
  tutorialDone: boolean
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    atoms: {},
    daysPracticed: 0,
    lastSessionDay: null,
    calibrationMs: DEFAULT_CALIBRATION_MS,
    tutorialDone: false,
  }
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

function classFor(atomId: string): 'direct' | 'five' | 'ten' | 'both' {
  const match = /^(\d)([+-])(\d)$/.exec(atomId)
  if (match === null) throw new Error(`malformed atom id: ${atomId}`)
  const [, rod, sign, operand] = match
  return classify({
    id: atomId,
    rodValue: Number(rod),
    operand: Number(operand),
    direction: sign === '+' ? 'add' : 'sub',
  })
}

function recalibrate(atoms: Record<string, AtomRecord>, fallback: number): number {
  const medians: number[] = []
  for (const [atomId, record] of Object.entries(atoms)) {
    if (record.recentLatencyMs.length < LATENCY_WINDOW) continue
    if (classFor(atomId) !== 'direct') continue
    const median = medianLatencyMs(record)
    if (median !== null) medians.push(median)
  }
  if (medians.length === 0) return fallback
  medians.sort((a, b) => a - b)
  const mid = Math.floor(medians.length / 2)
  if (medians.length % 2 === 1) return medians[mid] ?? fallback
  const lower = medians[mid - 1]
  const upper = medians[mid]
  if (lower === undefined || upper === undefined) return fallback
  return (lower + upper) / 2
}

export function recordAttempt(
  progress: Progress,
  atomId: string,
  correct: boolean,
  latencyMs: number,
  now: number,
): Progress {
  const existing = progress.atoms[atomId] ?? newRecord(atomId, now)
  const updated = applyAttempt(existing, classFor(atomId), correct, latencyMs, progress.calibrationMs, now)
  const atoms = { ...progress.atoms, [atomId]: updated }
  return { ...progress, atoms, calibrationMs: recalibrate(atoms, progress.calibrationMs) }
}

export function markDayPracticed(progress: Progress, day: string): Progress {
  if (progress.lastSessionDay === day) return progress
  return { ...progress, daysPracticed: progress.daysPracticed + 1, lastSessionDay: day }
}

export function currentStage(progress: Progress): StageIndex {
  return highestUnlockedStage(progress.atoms, progress.calibrationMs)
}
