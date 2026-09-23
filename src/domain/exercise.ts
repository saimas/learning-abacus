import { expectedValue, moveStates, startValue, type Atom } from './atoms'
import { answerOf, problemStates, problemSteps, rodsFor, startOf, type Problem } from './problem'
import { changedBeads, type PlacedBead, type Soroban } from './soroban'

// Spec (multi-digit ＋ −) §4: what one question puts on the soroban, whether
// it is a single move or a whole problem. The words that go with it (the
// prompt, the correction) are the i18n catalogues' business.
export type Exercise = {
  rods: number
  start: number
  expected: number
  // The soroban at the start, then after each step, for the replay.
  states: Soroban[]
  // Where each operation begins in `states`, ascending from 0: a column of a
  // ＋ − problem, a 九九 of a × problem, or the whole of a single move. The
  // stepping soroban colours one operation's beads at a time.
  groupStarts: number[]
}

export function exerciseForAtom(atom: Atom): Exercise {
  return {
    rods: 2,
    start: startValue(atom),
    expected: expectedValue(atom),
    states: moveStates(atom),
    // A single move is one operation, however many bead steps it takes.
    groupStarts: [0],
  }
}

export function exerciseForProblem(problem: Problem): Exercise {
  // A column that adds 0 (or a 九九 of 0) moves no bead, so there is nothing
  // of it to colour, and its start would be the next group's start again.
  const groupStarts: number[] = []
  let at = 0
  for (const group of problemSteps(problem)) {
    if (group.steps.length > 0) groupStarts.push(at)
    at += group.steps.length
  }
  return {
    rods: rodsFor(problem),
    start: startOf(problem),
    expected: answerOf(problem),
    states: problemStates(problem),
    groupStarts,
  }
}

// `group` is every bead the current operation has moved so far, `latest`
// the beads of the step on show, which are also in `group`.
export type StepColouring = { group: PlacedBead[]; latest: PlacedBead[] }

// The owner (2026-09-23), stepping through a 3×3 problem: when the beads move
// several times for one number, as for 81 with a carry, it is hard to see
// which moves belong to which operation. So while stepping, the beads the
// current operation has moved so far are coloured, the latest step's the
// deepest. `index` is the stepper's: state `index` is on show, after
// `index` steps, so the step just taken is `index − 1`, and the operation is
// the one that step belongs to. Nothing is coloured at the start (0) or when
// not stepping (null). A bead that moved and moved back within the
// operation stays coloured, since it took part. A pure function of `index`,
// so stepping back colours exactly as stepping forward did.
export function stepColouring(states: Soroban[], groupStarts: number[], index: number | null): StepColouring {
  if (index === null || index <= 0) return { group: [], latest: [] }
  let start = 0
  for (const groupStart of groupStarts) {
    if (groupStart <= index - 1) start = groupStart
  }
  const group: PlacedBead[] = []
  const seen = new Set<string>()
  for (let k = start; k < index; k++) {
    for (const placed of stepChanges(states, k)) {
      const key = beadKey(placed)
      if (seen.has(key)) continue
      seen.add(key)
      group.push(placed)
    }
  }
  return { group: group.sort(beadOrder), latest: stepChanges(states, index - 1) }
}

// The beads step `k` moves: from state k to state k + 1.
function stepChanges(states: Soroban[], k: number): PlacedBead[] {
  const before = states[k]
  const after = states[k + 1]
  return before === undefined || after === undefined ? [] : changedBeads(before, after)
}

function beadKey({ rod, bead }: PlacedBead): string {
  return bead.kind === 'heaven' ? `${rod}:heaven` : `${rod}:earth:${bead.index}`
}

// As changedBeads lists them: rod by rod from the left, the heaven bead
// before the earth beads, earth beads from the beam out.
function beadOrder(a: PlacedBead, b: PlacedBead): number {
  const place = (bead: PlacedBead['bead']) => (bead.kind === 'heaven' ? -1 : bead.index)
  return a.rod - b.rod || place(a.bead) - place(b.bead)
}
