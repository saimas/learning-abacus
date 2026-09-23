import { atomId, classify } from './atoms'
import { latencyTargetMs } from './fluency'
import {
  answerOf,
  applyPlacedStep,
  columnOfStep,
  generateProblems,
  isPracticeId,
  parsePracticeId,
  PRACTICE_KINDS,
  practiceId,
  problemStates,
  problemSteps,
  problemTargetMs,
  rodsFor,
  TYPING_ALLOWANCE_MS,
  type Digits,
  type Operation,
  type Problem,
} from './problem'
import { readRod, readValue } from './soroban'

// A small seeded generator (mulberry32), so generation tests are repeatable.
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

function problem(op: Operation, a: number, b: number): Problem {
  return { op, digits: String(a).length as Digits, a, b }
}

// Every rod stays on the soroban at every step, and the last state reads the answer.
function expectReplaysTo(p: Problem) {
  const states = problemStates(p)
  for (const state of states) {
    expect(state.rods).toHaveLength(rodsFor(p.digits))
    for (const rod of state.rods) {
      expect(readRod(rod)).toBeGreaterThanOrEqual(0)
      expect(readRod(rod)).toBeLessThanOrEqual(9)
    }
  }
  const firstState = states[0]
  if (!firstState) throw new Error('first state is missing')
  expect(readValue(firstState)).toBe(p.a)
  const lastState = states[states.length - 1]
  if (!lastState) throw new Error('last state is missing')
  expect(readValue(lastState)).toBe(answerOf(p))
}

describe('practice ids', () => {
  it('names the six kinds', () => {
    expect(PRACTICE_KINDS.map(practiceId)).toEqual(['add:1', 'add:2', 'add:3', 'sub:1', 'sub:2', 'sub:3'])
  })

  it('parses only the ids it knows', () => {
    expect(parsePracticeId('sub:2')).toEqual({ op: 'sub', digits: 2 })
    expect(parsePracticeId('add:4')).toBeNull()
    expect(parsePracticeId(['add:1'])).toBeNull()
    expect(parsePracticeId(undefined)).toBeNull()
    expect(isPracticeId('add:3')).toBe(true)
    expect(isPracticeId('mul:1')).toBe(false)
  })
})

describe('answerOf and rodsFor', () => {
  it('adds or subtracts', () => {
    expect(answerOf(problem('add', 472, 385))).toBe(857)
    expect(answerOf(problem('sub', 472, 385))).toBe(87)
  })

  it('keeps one rod spare for the carry', () => {
    expect(rodsFor(1)).toBe(2)
    expect(rodsFor(3)).toBe(4)
  })
})

describe('generateProblems', () => {
  it.each(PRACTICE_KINDS)('gives 10 distinct problems of the right size for %o', (kind) => {
    const problems = generateProblems(kind, 10, seeded(7))
    expect(problems).toHaveLength(10)
    expect(new Set(problems.map((p) => `${p.a},${p.b}`)).size).toBe(10)
    for (const p of problems) {
      expect(p.op).toBe(kind.op)
      expect(p.digits).toBe(kind.digits)
      expect(String(p.a)).toHaveLength(kind.digits)
      expect(String(p.b)).toHaveLength(kind.digits)
      if (kind.op === 'sub') expect(p.a).toBeGreaterThan(p.b)
    }
  })

  it('is repeatable for the same seed', () => {
    const kind = { op: 'add', digits: 2 } as const
    expect(generateProblems(kind, 10, seeded(3))).toEqual(generateProblems(kind, 10, seeded(3)))
  })
})

describe('problemSteps', () => {
  it('works from the highest place down', () => {
    const columns = problemSteps(problem('add', 472, 385))
    expect(columns.map((c) => c.place)).toEqual([2, 1, 0])
    expect(columns.map((c) => c.atom?.id)).toEqual([atomId(4, 3, 'add'), atomId(7, 8, 'add'), atomId(2, 5, 'add')])
  })

  it('places a carry on the rod to the left', () => {
    // 7 + 8 on the tens rod (index 2 of 4) is +10 − 2: one bead on the hundreds rod, then −2.
    const tens = problemSteps(problem('add', 472, 385))[1]
    if (!tens) throw new Error('tens column is missing')
    expect(tens.steps).toEqual([
      { rodIndex: 1, delta: 1 },
      { rodIndex: 2, delta: -2 },
    ])
    expect(tens.cascades).toBe(false)
  })

  it('moves nothing for a 0 digit in b', () => {
    const columns = problemSteps(problem('add', 345, 102))
    const hundredsCol = columns[1]
    if (!hundredsCol) throw new Error('hundreds column is missing')
    expect(hundredsCol).toEqual({ place: 1, atom: null, steps: [], cascades: false })
  })

  it('cascades a carry into a 9: 46 + 54', () => {
    const p = problem('add', 46, 54)
    const ones = problemSteps(p)[1]
    if (!ones) throw new Error('ones column is missing')
    expect(ones.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('cascades a borrow from a 0: 400 − 101', () => {
    const p = problem('sub', 400, 101)
    const ones = problemSteps(p)[2]
    if (!ones) throw new Error('ones column is missing')
    expect(ones.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('reaches 1998 from 999 + 999', () => {
    expectReplaysTo(problem('add', 999, 999))
  })

  it('replays every 1- and 2-digit problem to its answer', () => {
    for (const digits of [1, 2] as const) {
      const low = 10 ** (digits - 1)
      const high = 10 ** digits - 1
      for (let a = low; a <= high; a++) {
        for (let b = low; b <= high; b++) {
          expectReplaysTo({ op: 'add', digits, a, b })
          if (a > b) expectReplaysTo({ op: 'sub', digits, a, b })
        }
      }
    }
  })

  it('replays a large sample of 3-digit problems to their answers', () => {
    for (const op of ['add', 'sub'] as const) {
      for (const p of generateProblems({ op, digits: 3 }, 500, seeded(11))) expectReplaysTo(p)
    }
  })
})

describe('applyPlacedStep', () => {
  it('refuses a step off the rod', () => {
    const [start] = problemStates(problem('add', 9, 1))
    if (!start) throw new Error('start state is missing')
    expect(() => applyPlacedStep(start, { rodIndex: 1, delta: 1 })).toThrow()
  })
})

describe('columnOfStep', () => {
  it('says which column a replayed step belongs to', () => {
    // 472 + 385: hundreds is 2 steps (4 + 3 = +5 − 2), tens is 2 (+10 − 2), ones is 1 (+5).
    const columns = problemSteps(problem('add', 472, 385))
    expect([0, 1, 2, 3, 4].map((i) => columnOfStep(columns, i))).toEqual([0, 0, 1, 1, 2])
    expect(columnOfStep(columns, 5)).toBeUndefined()
  })
})

describe('problemTargetMs', () => {
  it("adds each column move's target and a typing allowance per answer digit", () => {
    const p = problem('add', 472, 385)
    const moves = problemSteps(p).reduce(
      (sum, c) => (c.atom === null ? sum : sum + latencyTargetMs(classify(c.atom), 900)),
      0,
    )
    expect(problemTargetMs(p, 900)).toBe(moves + 3 * TYPING_ALLOWANCE_MS)
  })
})
