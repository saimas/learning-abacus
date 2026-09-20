import { ATOMS, classify, type Atom, type AtomClass } from './atoms'
import { isReflex, type AtomRecord } from './fluency'

export type StageIndex = 0 | 1 | 2 | 3 | 4
export type Stage = { index: StageIndex; name: string; classes: AtomClass[] }

export const UNLOCK_REFLEX_RATIO = 0.85
export const UNLOCK_MIN_FADE = 3

export const STAGES: readonly Stage[] = Object.freeze([
  { index: 0, name: 'Reading the soroban', classes: [] },
  { index: 1, name: 'Direct moves', classes: ['direct'] },
  { index: 2, name: "5's complements", classes: ['five'] },
  { index: 3, name: "10's complements", classes: ['ten'] },
  { index: 4, name: 'Combined complements', classes: ['both'] },
])

export function atomsForStage(index: StageIndex): Atom[] {
  const stage = STAGES[index]
  if (stage === undefined) return []
  return ATOMS.filter((atom) => stage.classes.includes(classify(atom)))
}

export function isStageUnlocked(
  records: Record<string, AtomRecord>,
  calibrationMs: number,
  index: StageIndex,
): boolean {
  if (index <= 1) return true
  const previous = atomsForStage((index - 1) as StageIndex)
  if (previous.length === 0) return true
  const mastered = previous.filter((atom) => {
    const record = records[atom.id]
    if (record === undefined) return false
    return record.fade >= UNLOCK_MIN_FADE && isReflex(record, classify(atom), calibrationMs)
  })
  return mastered.length / previous.length >= UNLOCK_REFLEX_RATIO
}

export function highestUnlockedStage(
  records: Record<string, AtomRecord>,
  calibrationMs: number,
): StageIndex {
  let highest: StageIndex = 1
  for (const index of [2, 3, 4] as const) {
    if (!isStageUnlocked(records, calibrationMs, index)) break
    highest = index
  }
  return highest
}
