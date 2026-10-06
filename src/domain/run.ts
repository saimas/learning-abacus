import type { FadeLevel } from './fade'
import { generateProblems, problemKey, type PracticeKind, type Problem } from './problem'
import { answerPoints } from './score'

// Spec (runs) §2: a run is one kind's problems, one after another, until the
// third miss. The level is not kept here: it is the kind's record's, read
// for each new problem.
export const RUN_LIVES = 3
// No problem comes back within this many (1けた − has only 36).
export const RUN_NO_REPEAT = 10

export type RunState = {
  lives: number
  // Right answers without help in a row, in this run.
  combo: number
  score: number
  // What the latest answer earned, for the float over its 〇.
  lastPoints: number
  // Right answers, with help or not.
  right: number
  answered: number
  longestCombo: number
  // The highest level a problem was answered at.
  highestLevel: FadeLevel
  ended: boolean
}

export function startRun(level: FadeLevel): RunState {
  return {
    lives: RUN_LIVES,
    combo: 0,
    score: 0,
    lastPoints: 0,
    right: 0,
    answered: 0,
    longestCombo: 0,
    highestLevel: level,
    ended: false,
  }
}

// One answer to the problem on show: `level` is the level it was shown at,
// `answerMs` how long it took (for points only, spec (runs) §3).
export type RunAnswer = {
  problem: Problem
  level: FadeLevel
  calibrationMs: number
  answerMs: number
  correct: boolean
  assisted: boolean
}

export function answerRun(state: RunState, answer: RunAnswer): RunState {
  if (state.ended) return state
  const counted = {
    ...state,
    answered: state.answered + 1,
    highestLevel: Math.max(state.highestLevel, answer.level) as FadeLevel,
    lastPoints: 0,
  }
  if (!answer.correct) {
    // A miss, with help or not, costs a life and the combo.
    const lives = state.lives - 1
    return { ...counted, lives, combo: 0, ended: lives === 0 }
  }
  // Spec (core rounds) §5: right with help is not evidence the learner can
  // do it alone, so it neither builds the combo nor scores; it costs nothing.
  if (answer.assisted) return { ...counted, right: state.right + 1 }
  const combo = state.combo + 1
  const points = answerPoints({
    problem: answer.problem,
    calibrationMs: answer.calibrationMs,
    level: answer.level,
    combo,
    answerMs: answer.answerMs,
  })
  return {
    ...counted,
    right: state.right + 1,
    combo,
    longestCombo: Math.max(state.longestCombo, combo),
    score: state.score + points,
    lastPoints: points,
  }
}

// ✕ confirmed: the run ends where it stands, its points kept.
export function quitRun(state: RunState): RunState {
  return { ...state, ended: true }
}

// The run's next problem, never one of the last RUN_NO_REPEAT shown.
export function nextProblem(kind: PracticeKind, shown: readonly Problem[], random: () => number): Problem {
  const recent = new Set(shown.slice(-RUN_NO_REPEAT).map(problemKey))
  // A bound, not an expectation: every pool is several times RUN_NO_REPEAT,
  // so this only stops a broken `random` from spinning forever.
  for (let tries = 0; tries < 1_000; tries++) {
    const [problem] = generateProblems(kind, 1, random)
    if (problem !== undefined && !recent.has(problemKey(problem))) return problem
  }
  throw new Error(`no fresh ${kind.op}:${kind.digits} problem`)
}
