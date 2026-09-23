import { expectedValue, moveStates, startValue, type Atom } from './atoms'
import { answerOf, problemStates, rodsFor, type Problem } from './problem'
import type { Soroban } from './soroban'

// Spec (multi-digit ＋ −) §4: what one question puts on the soroban, whether
// it is a single move or a whole problem. The words that go with it (the
// prompt, the correction) are the i18n catalogues' business.
export type Exercise = {
  rods: number
  start: number
  expected: number
  // The soroban at the start, then after each step, for the replay.
  states: Soroban[]
}

export function exerciseForAtom(atom: Atom): Exercise {
  return { rods: 2, start: startValue(atom), expected: expectedValue(atom), states: moveStates(atom) }
}

export function exerciseForProblem(problem: Problem): Exercise {
  return {
    rods: rodsFor(problem.digits),
    start: problem.a,
    expected: answerOf(problem),
    states: problemStates(problem),
  }
}
