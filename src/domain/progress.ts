import { ATOMS, classify, type AtomClass } from './atoms'
import { highestUnlockedStage, type StageIndex } from './curriculum'
import { MAX_FADE } from './fade'
import {
  applyAttempt,
  isReflex,
  LATENCY_WINDOW,
  medianLatencyMs,
  newRecord,
  type AtomRecord,
} from './fluency'
import { applyPracticeAttempt, newPracticeRecord, type PracticeRecord } from './practice'
import type { PracticeId } from './problem'

export const SCHEMA_VERSION = 1
export const DEFAULT_CALIBRATION_MS = 900

export type Progress = {
  schemaVersion: number
  atoms: Record<string, AtomRecord>
  daysPracticed: number
  lastSessionDay: string | null
  calibrationMs: number
  tutorialDone: boolean
  // The highest stage ever reached. See currentStage for why this is stored
  // rather than derived fresh each time.
  highestStage: StageIndex
  // Multi-digit practice, one record per kind (spec: multi-digit ＋ − §5).
  // Added without a schema bump, like highestStage.
  practices: Partial<Record<PracticeId, PracticeRecord>>
  // Whether the learner has seen how 両落とし multiplication works (spec:
  // multiplication §4). Added without a schema bump, like highestStage.
  multiplyIntroDone: boolean
  // Whether the learner has seen how 商除法 division works (spec: division
  // §3), apart from the × walkthrough since each is shown before its own
  // operation's first round. Added without a schema bump, like highestStage.
  divideIntroDone: boolean
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    atoms: {},
    daysPracticed: 0,
    lastSessionDay: null,
    calibrationMs: DEFAULT_CALIBRATION_MS,
    tutorialDone: false,
    highestStage: 1,
    practices: {},
    multiplyIntroDone: false,
    divideIntroDone: false,
  }
}

function higherStage(a: StageIndex, b: StageIndex): StageIndex {
  return a >= b ? a : b
}

export function dayKey(now: number): string {
  const d = new Date(now)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  latencyMs: number | null,
  now: number,
): Progress {
  const existing = progress.atoms[atomId] ?? newRecord(atomId, now)
  const updated = applyAttempt(existing, classFor(atomId), correct, latencyMs, progress.calibrationMs, now)
  const atoms = { ...progress.atoms, [atomId]: updated }
  const calibrationMs = recalibrate(atoms, progress.calibrationMs)
  return {
    ...progress,
    atoms,
    calibrationMs,
    highestStage: higherStage(progress.highestStage, highestUnlockedStage(atoms, calibrationMs)),
  }
}

export function markDayPracticed(progress: Progress, day: string): Progress {
  if (progress.lastSessionDay === day) return progress
  return { ...progress, daysPracticed: progress.daysPracticed + 1, lastSessionDay: day }
}

// The unlock gate answers "is this learner ready to *start* new material", not
// "do they still qualify". It asks whether 85% of the previous stage is at
// Leitner box 4 or better right now, and box resets to 1 on any miss — so an
// ordinary bad day re-closes a gate that has already opened, and the learner
// watches new material appear and then vanish. Readiness is not revocable:
// spec §8 is explicit that consecutive-streak thinking punishes ordinary life
// and causes abandonment, and in Phase 1 visible progress is the only
// milestone system there is.
//
// The stored latch is raised by recordAttempt, but a document written before
// that field existed loads with the default, so the live gate still counts.
// Whichever is higher wins, and neither can lower the other.
export function currentStage(progress: Progress): StageIndex {
  return higherStage(progress.highestStage, highestUnlockedStage(progress.atoms, progress.calibrationMs))
}

// A multi-digit answer updates only its own kind's record. It does not
// credit or fault the single moves inside it: a wrong 3-digit sum should
// not punish five atoms (roadmap §7), and calibration stays a measure of
// single moves.
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

// Where one atom stands on the progress map: never tried, being learned, fast
// enough to be a reflex, or a reflex with the beads fully faded.
export type CellState = 'unseen' | 'learning' | 'reflex' | 'mental'

export function cellState(
  record: AtomRecord | undefined,
  cls: AtomClass,
  calibrationMs: number,
): CellState {
  if (record === undefined) return 'unseen'
  const fluent = isReflex(record, cls, calibrationMs)
  if (fluent && record.fade >= MAX_FADE) return 'mental'
  if (fluent) return 'reflex'
  return 'learning'
}

export function atomStates(progress: Progress): Record<string, CellState> {
  return Object.fromEntries(
    ATOMS.map((atom) => [
      atom.id,
      cellState(progress.atoms[atom.id], classify(atom), progress.calibrationMs),
    ]),
  )
}

export function mentalCount(states: Record<string, CellState>): number {
  return Object.values(states).filter((state) => state === 'mental').length
}
