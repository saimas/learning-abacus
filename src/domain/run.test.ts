import { practiceId, problemKey, type PracticeKind, type Problem } from './problem'
import { answerRun, nextProblem, quitRun, RUN_LIVES, RUN_NO_REPEAT, startRun, type RunAnswer } from './run'

// 47 + 85: base 46 at the default calibration (score.test.ts).
const sum: Problem = { op: 'add', digits: 2, a: 47, b: 85 }

// A slow right answer at F0 unless told otherwise: the base alone while the
// combo is under 5.
function answer(overrides: Partial<RunAnswer> = {}): RunAnswer {
  return { problem: sum, level: 0, calibrationMs: 900, answerMs: 60_000, correct: true, assisted: false, ...overrides }
}

function play(answers: RunAnswer[]) {
  return answers.reduce(answerRun, startRun(0))
}

// A small seeded generator (mulberry32), as problem.test.ts uses.
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('startRun', () => {
  it('starts with three lives and nothing scored, at the level given', () => {
    expect(RUN_LIVES).toBe(3)
    expect(startRun(2)).toEqual({
      lives: 3,
      combo: 0,
      score: 0,
      lastPoints: 0,
      right: 0,
      answered: 0,
      longestCombo: 0,
      highestLevel: 2,
      ended: false,
    })
  })
})

describe('answerRun', () => {
  it('scores each right answer and builds the combo', () => {
    const state = play([answer(), answer(), answer()])
    expect(state).toMatchObject({ combo: 3, score: 138, lastPoints: 46, right: 3, answered: 3 })
  })

  it('scores an answer by the combo counting it', () => {
    // The fifth in a row is ×1.5: 46 × 1.5.
    expect(play([answer(), answer(), answer(), answer(), answer()]).lastPoints).toBe(69)
  })

  it('takes a life and the combo for a miss, and scores it nothing', () => {
    const state = play([answer(), answer(), answer({ correct: false })])
    expect(state).toMatchObject({ lives: 2, combo: 0, lastPoints: 0, score: 92, longestCombo: 2, right: 2, answered: 3 })
    expect(state.ended).toBe(false)
  })

  it('ends on the third miss, wherever it comes', () => {
    const state = play([
      answer({ correct: false }),
      answer(),
      answer({ correct: false }),
      answer(),
      answer({ correct: false }),
    ])
    expect(state).toMatchObject({ lives: 0, ended: true })
  })

  it('takes no answer once ended', () => {
    const ended = play([answer({ correct: false }), answer({ correct: false }), answer({ correct: false })])
    expect(answerRun(ended, answer())).toBe(ended)
  })

  // Spec (runs) §2: right with help costs nothing, earns nothing and leaves
  // the combo as it was.
  it('keeps the combo and scores nothing for a right answer with help', () => {
    expect(play([answer(), answer(), answer({ assisted: true })])).toMatchObject({
      combo: 2,
      lastPoints: 0,
      score: 92,
      lives: 3,
      right: 3,
    })
  })

  it('takes a life for a wrong answer with help', () => {
    expect(play([answer(), answer({ correct: false, assisted: true })])).toMatchObject({ lives: 2, combo: 0 })
  })

  it('remembers the longest combo and the highest level shown', () => {
    const state = play([
      answer(),
      answer(),
      answer(),
      answer({ correct: false }),
      answer({ level: 1 }),
      answer({ level: 1, correct: false }),
    ])
    expect(state.longestCombo).toBe(3)
    expect(state.highestLevel).toBe(1)
  })
})

describe('quitRun', () => {
  it('ends the run where it stands, its points kept', () => {
    expect(quitRun(play([answer()]))).toMatchObject({ ended: true, score: 46, lives: 3 })
  })
})

describe('nextProblem', () => {
  // The smallest pools: 1けた − has 36 pairs, 1けた × and ÷ 64.
  const kinds: PracticeKind[] = [
    { op: 'sub', digits: 1 },
    { op: 'add', digits: 1 },
    { op: 'mul', digits: 1 },
    { op: 'div', digits: 1 },
    { op: 'mitori', digits: 1 },
  ]

  it.each(kinds.map((kind) => [practiceId(kind), kind] as const))(
    'never repeats one of the last 10 shown (%s)',
    (_id, kind) => {
      const random = seeded(42)
      const shown: Problem[] = []
      for (let i = 0; i < 300; i++) shown.push(nextProblem(kind, shown, random))
      shown.forEach((problem, i) => {
        const before = shown.slice(Math.max(0, i - RUN_NO_REPEAT), i).map(problemKey)
        expect(before).not.toContain(problemKey(problem))
      })
    },
  )

  it('draws a problem of the kind', () => {
    expect(nextProblem({ op: 'mul', digits: 2 }, [], seeded(7))).toMatchObject({ op: 'mul', digits: 2 })
  })
})
