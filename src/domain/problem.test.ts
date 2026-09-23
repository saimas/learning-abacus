import { atomId, classify } from './atoms'
import { latencyTargetMs } from './fluency'
import {
  answerOf,
  applyPlacedStep,
  generateProblems,
  groupOfStep,
  isPracticeId,
  MULTIPLY_RECALL_MS,
  OPERATION_SYMBOL,
  parsePracticeId,
  PRACTICE_KINDS,
  practiceId,
  problemStates,
  problemSteps,
  problemTargetMs,
  rodsFor,
  startOf,
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
    expect(state.rods).toHaveLength(rodsFor(p))
    for (const rod of state.rods) {
      expect(readRod(rod)).toBeGreaterThanOrEqual(0)
      expect(readRod(rod)).toBeLessThanOrEqual(9)
    }
  }
  const firstState = states[0]
  if (!firstState) throw new Error('first state is missing')
  expect(readValue(firstState)).toBe(startOf(p))
  const lastState = states[states.length - 1]
  if (!lastState) throw new Error('last state is missing')
  expect(readValue(lastState)).toBe(answerOf(p))
}

describe('practice ids', () => {
  it('names the nine kinds', () => {
    expect(PRACTICE_KINDS.map(practiceId)).toEqual([
      'add:1',
      'add:2',
      'add:3',
      'sub:1',
      'sub:2',
      'sub:3',
      'mul:1',
      'mul:2',
      'mul:3',
    ])
  })

  it('parses only the ids it knows', () => {
    expect(parsePracticeId('sub:2')).toEqual({ op: 'sub', digits: 2 })
    expect(parsePracticeId('add:4')).toBeNull()
    expect(parsePracticeId(['add:1'])).toBeNull()
    expect(parsePracticeId(undefined)).toBeNull()
    expect(isPracticeId('add:3')).toBe(true)
    expect(isPracticeId('mul:2')).toBe(true)
    expect(isPracticeId('div:1')).toBe(false)
  })
})

describe('answerOf and rodsFor', () => {
  it('adds, subtracts or multiplies', () => {
    expect(answerOf(problem('add', 472, 385))).toBe(857)
    expect(answerOf(problem('sub', 472, 385))).toBe(87)
    expect(answerOf(problem('mul', 47, 36))).toBe(1692)
  })

  it('keeps one rod spare for the carry, and gives a product twice the digits', () => {
    expect(rodsFor({ op: 'add', digits: 1 })).toBe(2)
    expect(rodsFor({ op: 'sub', digits: 3 })).toBe(4)
    expect(rodsFor({ op: 'mul', digits: 1 })).toBe(2)
    expect(rodsFor({ op: 'mul', digits: 3 })).toBe(6)
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
      if (kind.op === 'mul' && kind.digits === 1) {
        // × 1 teaches nothing, so 1×1 draws from the 九九 range instead.
        expect(p.a).toBeGreaterThanOrEqual(2)
        expect(p.b).toBeGreaterThanOrEqual(2)
      } else {
        expect(String(p.a)).toHaveLength(kind.digits)
        expect(String(p.b)).toHaveLength(kind.digits)
      }
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
    expect(columns.map((c) => (c.kind === 'column' ? c.place : null))).toEqual([2, 1, 0])
    expect(columns.map((c) => (c.kind === 'column' ? c.atom?.id : null))).toEqual([
      atomId(4, 3, 'add'),
      atomId(7, 8, 'add'),
      atomId(2, 5, 'add'),
    ])
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
    expect(hundredsCol).toEqual({ kind: 'column', place: 1, atom: null, steps: [], cascades: false })
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

describe('groupOfStep', () => {
  it('says which group a replayed step belongs to', () => {
    // 472 + 385: hundreds is 2 steps (4 + 3 = +5 − 2), tens is 2 (+10 − 2), ones is 1 (+5).
    const groups = problemSteps(problem('add', 472, 385))
    expect([0, 1, 2, 3, 4].map((i) => groupOfStep(groups, i))).toEqual([0, 0, 1, 1, 2])
    expect(groupOfStep(groups, 5)).toBeUndefined()
  })
})

describe('problemTargetMs', () => {
  it("adds each column move's target and a typing allowance per answer digit", () => {
    const p = problem('add', 472, 385)
    const moves = problemSteps(p).reduce(
      (sum, g) => (g.kind === 'column' && g.atom !== null ? sum + latencyTargetMs(classify(g.atom), 900) : sum),
      0,
    )
    expect(problemTargetMs(p, 900)).toBe(moves + 3 * TYPING_ALLOWANCE_MS)
  })
})

describe('multiplication', () => {
  it('builds only the product, from an empty soroban', () => {
    const p = problem('mul', 47, 36)
    expect(startOf(p)).toBe(0)
    expectReplaysTo(p)
  })

  it('takes each 九九 from the highest places down, placing it by the places multiplied', () => {
    const groups = problemSteps(problem('mul', 47, 36))
    expect(groups.map((g) => (g.kind === 'product' ? [g.x, g.y, g.place] : null))).toEqual([
      [4, 3, 2],
      [4, 6, 1],
      [7, 3, 1],
      [7, 6, 0],
    ])
  })

  // The operand board highlights the two digits of the 九九 on show, so each
  // group says which place of a and which place of b it multiplies.
  it('names the places of the two digits each 九九 multiplies', () => {
    const groups = problemSteps(problem('mul', 47, 36))
    expect(groups.map((g) => (g.kind === 'product' ? [g.xPlace, g.yPlace] : null))).toEqual([
      [1, 1],
      [1, 0],
      [0, 1],
      [0, 0],
    ])
  })

  it('adds the tens digit one place above the ones digit', () => {
    const [first] = problemSteps(problem('mul', 47, 36))
    if (first === undefined || first.kind !== 'product') throw new Error('expected a product group')
    expect(first.moves.map((m) => [m.place, m.atom.operand])).toEqual([
      [3, 1],
      [2, 2],
    ])
  })

  it('moves no bead for a zero digit of the 九九', () => {
    const [six] = problemSteps(problem('mul', 2, 3))
    const [twenty] = problemSteps(problem('mul', 5, 4))
    if (six?.kind !== 'product' || twenty?.kind !== 'product') throw new Error('expected product groups')
    expect(six.moves.map((m) => [m.place, m.atom.operand])).toEqual([[0, 6]])
    expect(twenty.moves.map((m) => [m.place, m.atom.operand])).toEqual([[1, 2]])
  })

  it('keeps a group for a 九九 with a zero, even though nothing moves', () => {
    const groups = problemSteps(problem('mul', 40, 36))
    expect(groups).toHaveLength(4)
    expect(groups[2]).toMatchObject({ kind: 'product', x: 0, y: 3, moves: [], steps: [] })
  })

  it('reaches 9801 from 99 × 99', () => {
    expectReplaysTo(problem('mul', 99, 99))
  })

  it('replays every 1×1 and 2×2 problem to its product, and some carries cascade', () => {
    let cascading = 0
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) expectReplaysTo(problem('mul', a, b))
    for (let a = 10; a <= 99; a++) {
      for (let b = 10; b <= 99; b++) {
        const p = problem('mul', a, b)
        expectReplaysTo(p)
        if (problemSteps(p).some((g) => g.cascades)) cascading++
      }
    }
    expect(cascading).toBeGreaterThan(0)
  })

  it('replays a sample of 3×3 problems to their products', () => {
    for (const p of generateProblems({ op: 'mul', digits: 3 }, 500, seeded(13))) expectReplaysTo(p)
  })

  it('allows time to recall each 九九', () => {
    const p = problem('mul', 47, 36)
    const moves = problemSteps(p).reduce(
      (sum, g) =>
        g.kind === 'product'
          ? sum + g.moves.reduce((s, m) => s + latencyTargetMs(classify(m.atom), 900), 0)
          : sum,
      0,
    )
    expect(problemTargetMs(p, 900)).toBe(moves + 4 * MULTIPLY_RECALL_MS + 4 * TYPING_ALLOWANCE_MS)
  })

  it('has a symbol for every operation', () => {
    expect(OPERATION_SYMBOL).toEqual({ add: '＋', sub: '−', mul: '×' })
  })
})
