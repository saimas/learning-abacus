import { atomId, classify } from './atoms'
import { latencyTargetMs } from './fluency'
import {
  answerOf,
  applyPlacedStep,
  DIVIDE_ESTIMATE_MS,
  divisorFirstDigit,
  generateProblems,
  groupOfStep,
  isPracticeId,
  MITORI_TERMS,
  MULTIPLY_RECALL_MS,
  OPERATION_SYMBOL,
  parsePracticeId,
  PRACTICE_KINDS,
  practiceId,
  problemKey,
  problemSections,
  problemStates,
  problemSteps,
  problemTargetMs,
  rodsFor,
  startOf,
  TYPING_ALLOWANCE_MS,
  type Digits,
  type MitoriProblem,
  type PairProblem,
  type Problem,
  type StepGroup,
} from './problem'
import { readRod, readValue, type Soroban } from './soroban'

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

function problem(op: PairProblem['op'], a: number, b: number): PairProblem {
  return { op, digits: String(a).length as Digits, a, b }
}

function mitori(digits: Digits, terms: number[]): MitoriProblem {
  return { op: 'mitori', digits, terms }
}

// The column groups of a 見取算 problem, as "term:place:moved", in order.
function termColumns(p: MitoriProblem): string[] {
  return problemSteps(p).map((g) => {
    if (g.kind !== 'column') throw new Error(`unexpected ${g.kind} group`)
    return `${g.term}:${g.place}:${g.steps.length > 0 ? 'moves' : 'still'}`
  })
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
  it('names the fifteen kinds', () => {
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
      'div:1',
      'div:2',
      'div:3',
      'mitori:1',
      'mitori:2',
      'mitori:3',
    ])
  })

  it('parses only the ids it knows', () => {
    expect(parsePracticeId('sub:2')).toEqual({ op: 'sub', digits: 2 })
    expect(parsePracticeId('add:4')).toBeNull()
    expect(parsePracticeId(['add:1'])).toBeNull()
    expect(parsePracticeId(undefined)).toBeNull()
    expect(isPracticeId('add:3')).toBe(true)
    expect(isPracticeId('mul:2')).toBe(true)
    expect(isPracticeId('div:1')).toBe(true)
    expect(isPracticeId('pow:1')).toBe(false)
    expect(parsePracticeId('mitori:2')).toEqual({ op: 'mitori', digits: 2 })
    expect(isPracticeId('mitori:4')).toBe(false)
  })
})

describe('answerOf and rodsFor', () => {
  it('adds, subtracts, multiplies or divides', () => {
    expect(answerOf(problem('add', 472, 385))).toBe(857)
    expect(answerOf(problem('sub', 472, 385))).toBe(87)
    expect(answerOf(problem('mul', 47, 36))).toBe(1692)
    expect(answerOf({ op: 'div', digits: 2, a: 1692, b: 36 })).toBe(47)
  })

  it('keeps one rod spare for the carry, and gives a product twice the digits', () => {
    expect(rodsFor({ op: 'add', digits: 1 })).toBe(2)
    expect(rodsFor({ op: 'sub', digits: 3 })).toBe(4)
    expect(rodsFor({ op: 'mul', digits: 1 })).toBe(2)
    expect(rodsFor({ op: 'mul', digits: 3 })).toBe(6)
  })

  it('gives a division room for the quotient left of the dividend', () => {
    expect(rodsFor({ op: 'div', digits: 1 })).toBe(3)
    expect(rodsFor({ op: 'div', digits: 2 })).toBe(5)
    expect(rodsFor({ op: 'div', digits: 3 })).toBe(7)
  })
})

describe('generateProblems', () => {
  it.each(PRACTICE_KINDS.filter((kind) => kind.op !== 'mitori'))('gives 10 distinct problems of the right size for %o', (kind) => {
    const problems = generateProblems(kind, 10, seeded(7))
    expect(problems).toHaveLength(10)
    expect(new Set(problems.map((p) => (p.op === 'mitori' ? p.terms.join(',') : `${p.a},${p.b}`))).size).toBe(10)
    for (const p of problems) {
      if (p.op === 'mitori') throw new Error('expected a two-number problem')
      expect(p.op).toBe(kind.op)
      expect(p.digits).toBe(kind.digits)
      if (kind.op === 'div') {
        // × run backwards: an N-digit quotient times an N-digit divisor,
        // always exact.
        expect(p.a % p.b).toBe(0)
        const q = p.a / p.b
        if (kind.digits === 1) {
          // ÷ 1 teaches nothing either, so 1けた draws both from 2..9.
          expect(q).toBeGreaterThanOrEqual(2)
          expect(p.b).toBeGreaterThanOrEqual(2)
        }
        expect(String(q)).toHaveLength(kind.digits)
        expect(String(p.b)).toHaveLength(kind.digits)
      } else if (kind.op === 'mul' && kind.digits === 1) {
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

  // ÷ written as its code point, since a look-alike would pass by eye.
  it('has a symbol for every operation', () => {
    expect(OPERATION_SYMBOL).toEqual({ add: '＋', sub: '−', mul: '×', div: '\u00F7', mitori: '±' })
  })
})

// Spec (division) §2: 商除法. The dividend is set on the soroban, each
// quotient digit is placed to its left, and each 九九 of that digit and the
// divisor is taken off the dividend, until only the quotient is left.
describe('division', () => {
  // A ÷ problem is × run backwards, so it is named by its quotient and
  // divisor, and its size is the divisor's (and the quotient's) digits.
  function division(q: number, d: number): PairProblem {
    return { op: 'div', digits: String(d).length as Digits, a: q * d, b: d }
  }

  // What each group says it does, without its bead steps.
  function outline(group: StepGroup) {
    switch (group.kind) {
      case 'quotient':
        return { kind: group.kind, q: group.q, place: group.place, lead: group.lead, split: group.split }
      case 'subtract':
        return { kind: group.kind, q: group.q, y: group.y, yPlace: group.yPlace, place: group.place }
      default:
        return { kind: group.kind }
    }
  }

  function lastOf(states: Soroban[]): Soroban {
    const last = states[states.length - 1]
    if (last === undefined) throw new Error('last state is missing')
    return last
  }

  // Every way a ÷ problem's replay can break the spec's invariants, as
  // messages, so an exhaustive run reports every problem that fails rather
  // than stopping at the first (and runs faster than an expect per rod).
  function divisionFaults(p: PairProblem): string[] {
    const faults: string[] = []
    const name = `${p.a} ÷ ${p.b}`
    const rods = rodsFor(p)
    const q = p.a / p.b
    const groups = problemSteps(p)
    const states = problemStates(p)
    const first = states[0]
    if (first === undefined || readValue(first) !== p.a) faults.push(`${name}: does not start at the dividend`)
    // Every rod stays on the soroban at every state, so the remainder never
    // goes below zero.
    states.forEach((state, index) => {
      if (state.rods.length !== rods) faults.push(`${name}: state ${index} has ${state.rods.length} rods`)
      if (state.rods.some((rod) => readRod(rod) < 0 || readRod(rod) > 9)) faults.push(`${name}: state ${index} off the rods`)
    })
    // The quotient on the left, zeros to its right.
    const expected = q * 10 ** (p.digits + 1)
    if (readValue(lastOf(states)) !== expected) {
      faults.push(`${name}: ends at ${readValue(lastOf(states))}, not ${expected}`)
    }
    const allSteps = groups.flatMap((group) => group.steps)
    let at = 0
    for (const group of groups) {
      if (group.kind === 'quotient') {
        const index = rods - 1 - group.place
        const before = states[at]?.rods[index]
        if (before === undefined || readRod(before) !== 0) faults.push(`${name}: quotient rod ${group.place} not empty`)
        // Nothing after the digit is placed, borrows included, reaches its
        // rod or any rod left of it.
        const later = allSteps.slice(at + group.steps.length)
        if (later.some((step) => step.rodIndex <= index)) faults.push(`${name}: a later step touches place ${group.place}`)
        // The 割れる / 割れない rule the card reads: a quotient digit lands two
        // rods left of the remainder's head exactly when the head's leading
        // N digits are at least the divisor.
        if (group.q > 0 && group.split !== group.lead >= p.b) {
          faults.push(`${name}: split ${group.split} but lead ${group.lead} against ${p.b}`)
        }
        // A 0 digit is not placed, so it never claims 割れる, whatever the
        // rods' geometry says.
        if (group.q === 0 && group.split) faults.push(`${name}: a 0 digit at place ${group.place} claims split`)
        // The guess the card explains (the owner, 2026-09-24): the divisor's
        // first digit alone is smaller than the divisor, so the guess is
        // never too small, only too big, and lowering it is all the learner
        // is ever asked to do. A digit is at most 9.
        if (group.guess < group.q || group.guess > 9) {
          faults.push(`${name}: guess ${group.guess} for digit ${group.q} at place ${group.place}`)
        }
        // The walkthrough says the head is one or two digits.
        if (group.partial > 99) faults.push(`${name}: head ${group.partial} at place ${group.place}`)
        // The card says "nothing is left" only when the rods below the
        // quotient's read 0, not whenever the head does (10815 ÷ 105).
        const state = states[at]
        const remainder = state === undefined ? undefined : readValue(state) % 10 ** group.place
        if (group.remainderZero !== (remainder === 0)) {
          faults.push(`${name}: remainderZero ${group.remainderZero} but ${remainder} left at place ${group.place}`)
        }
        // A 1-digit divisor has no lower digit to come off as well, so its
        // guess is always the digit.
        if (p.digits === 1 && group.guess !== group.q) faults.push(`${name}: guess ${group.guess} is not ${group.q}`)
      }
      at += group.steps.length
    }
    return faults
  }

  it('sets the dividend on the soroban', () => {
    expect(startOf(division(47, 36))).toBe(1692)
  })

  it('places each quotient digit, then takes off its 九九 with each divisor digit from the highest', () => {
    // 1692 ÷ 36: 16 is under 36 (割れない), so 4 goes one rod left of the
    // head; 1692 − 4×36×10 = 252, and 25 is under 36 again, so 7 does too.
    expect(problemSteps(division(47, 36)).map(outline)).toEqual([
      { kind: 'quotient', q: 4, place: 4, lead: 16, split: false },
      { kind: 'subtract', q: 4, y: 3, yPlace: 1, place: 2 },
      { kind: 'subtract', q: 4, y: 6, yPlace: 0, place: 1 },
      { kind: 'quotient', q: 7, place: 3, lead: 25, split: false },
      { kind: 'subtract', q: 7, y: 3, yPlace: 1, place: 1 },
      { kind: 'subtract', q: 7, y: 6, yPlace: 0, place: 0 },
    ])
  })

  // The owner (2026-09-24): "it says 商4を立てる but I have no idea where
  // that 4 comes from". Each digit is guessed by a 九九: the head of what is
  // left (above the divisor's width below the digit's own place) ÷ the
  // divisor's first digit, at most 9. The guess can be too big, since the
  // divisor's lower digits come off too; the digit placed is the one that
  // takes off.
  it('guesses each digit from the head of what is left ÷ the divisor’s first digit', () => {
    const guesses = (q: number, d: number) =>
      problemSteps(division(q, d)).flatMap((group) =>
        group.kind === 'quotient' ? [{ q: group.q, partial: group.partial, guess: group.guess }] : [],
      )
    // 1692 ÷ 36: 16 ÷ 3 is 5, but 5 × 36 is too big, so 4; then 252 left,
    // 25 ÷ 3 is 8, but 8 × 36 is too big, so 7.
    expect(guesses(47, 36)).toEqual([
      { q: 4, partial: 16, guess: 5 },
      { q: 7, partial: 25, guess: 8 },
    ])
    // 432 ÷ 36: 4 ÷ 3 is 1, then 72 left, 7 ÷ 3 is 2; both right first time.
    expect(guesses(12, 36)).toEqual([
      { q: 1, partial: 4, guess: 1 },
      { q: 2, partial: 7, guess: 2 },
    ])
    // 202032 ÷ 976: 20 ÷ 9 is 2; then 6832 left, 6 ÷ 9 is 0; then 68 ÷ 9 is 7.
    expect(guesses(207, 976)).toEqual([
      { q: 2, partial: 20, guess: 2 },
      { q: 0, partial: 6, guess: 0 },
      { q: 7, partial: 68, guess: 7 },
    ])
    // 684 ÷ 36: after 1, 32 ÷ 3 is 10, but a digit is at most 9.
    expect(guesses(19, 36)).toEqual([
      { q: 1, partial: 6, guess: 2 },
      { q: 9, partial: 32, guess: 9 },
    ])
    // 360 ÷ 36: after 1, nothing is left.
    expect(guesses(10, 36)).toEqual([
      { q: 1, partial: 3, guess: 1 },
      { q: 0, partial: 0, guess: 0 },
    ])
  })

  // A head of 0 does not mean nothing is left: 10815 ÷ 105, after the 1,
  // leaves 315, whose head above the tens is 0. Only 360 ÷ 36, after the
  // 1, leaves nothing at all.
  it('says whether anything is left when a digit is decided, apart from its head', () => {
    const zeros = (q: number, d: number) =>
      problemSteps(division(q, d)).flatMap((group) =>
        group.kind === 'quotient' && group.q === 0 ? [{ partial: group.partial, remainderZero: group.remainderZero }] : [],
      )
    expect(zeros(103, 105)).toEqual([{ partial: 0, remainderZero: false }])
    expect(zeros(10, 36)).toEqual([{ partial: 0, remainderZero: true }])
    expect(zeros(207, 976)).toEqual([{ partial: 6, remainderZero: false }])
  })

  it('names the divisor’s first digit, which each guess divides by', () => {
    expect([division(7, 8), division(47, 36), division(207, 976)].map(divisorFirstDigit)).toEqual([8, 3, 9])
  })

  it('places a quotient digit as one addition on its empty rod', () => {
    const [first] = problemSteps(division(47, 36))
    if (first?.kind !== 'quotient') throw new Error('expected a quotient group')
    expect(first.moves.map((m) => [m.place, m.atom.id])).toEqual([[4, atomId(0, 4, 'add')]])
    expect(first.steps).toEqual([{ rodIndex: 0, delta: 4 }])
  })

  it('subtracts the tens digit of a 九九 one place above its ones digit', () => {
    // 4×3 = 12 off 41692: 1 from the thousands, then 2 from the hundreds.
    const second = problemSteps(division(47, 36))[1]
    if (second?.kind !== 'subtract') throw new Error('expected a subtract group')
    expect(second.moves.map((m) => [m.place, m.atom.id])).toEqual([
      [3, atomId(1, 1, 'sub')],
      [2, atomId(6, 2, 'sub')],
    ])
  })

  it('leaves only the quotient, followed by zeros', () => {
    const p = division(47, 36)
    expect(readValue(lastOf(problemStates(p)))).toBe(47000)
    expect(divisionFaults(p)).toEqual([])
  })

  it('places the quotient two rods left of the head when the head divides (割れる)', () => {
    // 432 ÷ 36: 43 is at least 36, so 1 goes two rods left of the 4.
    const [first] = problemSteps(division(12, 36))
    expect(first === undefined ? undefined : outline(first)).toEqual({
      kind: 'quotient',
      q: 1,
      place: 4,
      lead: 43,
      split: true,
    })
    expect(divisionFaults(division(12, 36))).toEqual([])
  })

  it('keeps a group for a 0 quotient digit, which places nothing and takes nothing off', () => {
    // 202032 ÷ 976 = 207: the tens digit is 0, so nothing is multiplied.
    const p = division(207, 976)
    const groups = problemSteps(p)
    const kinds = groups.map((g) => g.kind)
    expect(kinds).toEqual([
      'quotient',
      'subtract',
      'subtract',
      'subtract',
      'quotient',
      'quotient',
      'subtract',
      'subtract',
      'subtract',
    ])
    // Its remainder's head, 683, sits three places below it, which would
    // read as 割れる by position alone; a digit that is never placed claims
    // neither rule.
    expect(groups[4]).toMatchObject({
      kind: 'quotient',
      q: 0,
      place: 5,
      split: false,
      moves: [],
      steps: [],
      cascades: false,
    })
    expect(readValue(lastOf(problemStates(p)))).toBe(207 * 10 ** 4)
    expect(divisionFaults(p)).toEqual([])
  })

  it('keeps a group for a 0 divisor digit, which takes nothing off', () => {
    // 12915 ÷ 105 = 123: the tens digit of 105 is 0.
    const groups = problemSteps(division(123, 105))
    expect(groups[2]).toMatchObject({ kind: 'subtract', q: 1, y: 0, yPlace: 1, moves: [], steps: [] })
    expect(divisionFaults(division(123, 105))).toEqual([])
  })

  it('works every 1けた and 2けた problem down to its quotient', () => {
    const faults: string[] = []
    for (let q = 2; q <= 9; q++) for (let d = 2; d <= 9; d++) faults.push(...divisionFaults(division(q, d)))
    for (let q = 10; q <= 99; q++) for (let d = 10; d <= 99; d++) faults.push(...divisionFaults(division(q, d)))
    expect(faults).toEqual([])
  })

  // No 1けた or 2けた problem borrows through a 0 rod; 3けた ones can.
  it('borrows through a 0 rod the way ＋ − do: 28158 ÷ 247', () => {
    // After 1 and 1 are placed, 1101058 − 1×7 on the tens: the tens rod's 5
    // is short, and the hundreds rod it borrows from is 0, so the borrow
    // comes from the thousands and the hundreds becomes 9 (1100058 →
    // 1100558 → 1100958), then the tens takes +3 (1100988).
    const p = division(114, 247)
    const seventh = problemSteps(p)[7]
    expect(seventh).toMatchObject({ kind: 'subtract', q: 1, y: 7, yPlace: 0, place: 1, cascades: true })
    expect(seventh?.steps).toEqual([
      { rodIndex: 3, delta: -1 },
      { rodIndex: 4, delta: 5 },
      { rodIndex: 4, delta: 4 },
      { rodIndex: 5, delta: 3 },
    ])
    expect(divisionFaults(p)).toEqual([])
  })

  it('works a large sample of 3けた problems down to their quotients', () => {
    const faults = generateProblems({ op: 'div', digits: 3 }, 10_000, seeded(17)).flatMap((p) => {
      if (p.op === 'mitori') throw new Error('expected a division')
      return divisionFaults(p)
    })
    expect(faults).toEqual([])
  })

  it('allows time to recall each 九九 and to estimate each quotient digit', () => {
    const moveTargets = (p: Problem) =>
      problemSteps(p).reduce(
        (sum, g) =>
          g.kind === 'column' ? sum : sum + g.moves.reduce((s, m) => s + latencyTargetMs(classify(m.atom), 900), 0),
        0,
      )
    const p = division(47, 36)
    expect(problemTargetMs(p, 900)).toBe(
      moveTargets(p) + 4 * MULTIPLY_RECALL_MS + 2 * DIVIDE_ESTIMATE_MS + 2 * TYPING_ALLOWANCE_MS,
    )
    // 202032 ÷ 976 = 207: the 0 digit is placed without an estimate, and
    // has no 九九 to recall, so only 2 and 7 count.
    const zero = division(207, 976)
    expect(problemTargetMs(zero, 900)).toBe(
      moveTargets(zero) + 6 * MULTIPLY_RECALL_MS + 2 * DIVIDE_ESTIMATE_MS + 3 * TYPING_ALLOWANCE_MS,
    )
  })
})

// Spec (見取算) §3: the first number starts on the soroban; each later number
// is worked onto it from its highest digit down, each digit one move on its
// rod, as a ＋ − problem's b is.
describe('見取算', () => {
  const example = mitori(2, [47, 30, -23, 61, -19])

  it('adds up the signed numbers, starting from the first on N + 1 rods', () => {
    expect(answerOf(example)).toBe(96)
    expect(startOf(example)).toBe(47)
    expect(rodsFor(example)).toBe(3)
  })

  it('has a symbol of its own', () => {
    expect(OPERATION_SYMBOL.mitori).toBe('±')
  })

  it('works each later number from its highest digit, tagging each move with its number', () => {
    // 30's ones digit is 0: it keeps its group but moves nothing.
    expect(termColumns(example)).toEqual([
      '1:1:moves',
      '1:0:still',
      '2:1:moves',
      '2:0:moves',
      '3:1:moves',
      '3:0:moves',
      '4:1:moves',
      '4:0:moves',
    ])
    expectReplaysTo(example)
  })

  it('adds a positive number and subtracts a negative one', () => {
    const groups = problemSteps(example)
    const directionOf = (term: number) =>
      groups.flatMap((g) => (g.kind === 'column' && g.term === term && g.atom !== null ? [g.atom.direction] : []))
    expect(directionOf(1)).toEqual(['add'])
    expect(directionOf(2)).toEqual(['sub', 'sub'])
    expect(directionOf(3)).toEqual(['add', 'add'])
    expect(directionOf(4)).toEqual(['sub', 'sub'])
  })

  it('cascades a carry through a 9: ＋15 onto 185', () => {
    // 95 + 90 = 185; +15 makes the tens 9, so the ones' +5 carries through them.
    const p = mitori(2, [95, 90, 15, -60, 22])
    const ones = problemSteps(p).find((g) => g.kind === 'column' && g.term === 2 && g.place === 0)
    expect(ones?.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('cascades a borrow through a 0: −101 from 1000', () => {
    const p = mitori(3, [500, 500, -101, 200, -300])
    const ones = problemSteps(p).find((g) => g.kind === 'column' && g.term === 2 && g.place === 0)
    expect(ones?.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('works on from a running total of 0', () => {
    // 5 − 5 leaves a blank soroban; 3 is then worked from 0.
    expectReplaysTo(mitori(1, [5, -5, 3, 4, -2]))
  })

  it('reaches a four-digit total on four rods', () => {
    expectReplaysTo(mitori(3, [999, 999, 999, -999, 999]))
  })

  it("targets each digit move's time plus typing the total, as ＋ − do", () => {
    const moves = problemSteps(example).reduce(
      (sum, g) => (g.kind === 'column' && g.atom !== null ? sum + latencyTargetMs(classify(g.atom), 900) : sum),
      0,
    )
    expect(problemTargetMs(example, 900)).toBe(moves + 2 * TYPING_ALLOWANCE_MS)
  })

  // Spec (見取算) §3: five N-digit numbers, the first added, one or two of
  // the rest subtracted, never below 0 on the way, never 0 at the end.
  it.each([1, 2, 3] as const)('generates well-formed %i-digit columns', (digits) => {
    const problems = generateProblems({ op: 'mitori', digits }, 200, seeded(digits))
    expect(problems).toHaveLength(200)
    expect(new Set(problems.map((p) => (p.op === 'mitori' ? p.terms.join(',') : ''))).size).toBe(200)
    const subtractions = new Set<number>()
    for (const p of problems) {
      if (p.op !== 'mitori') throw new Error('expected a 見取算 problem')
      expect(p.digits).toBe(digits)
      expect(p.terms).toHaveLength(MITORI_TERMS)
      for (const term of p.terms) expect(String(Math.abs(term))).toHaveLength(digits)
      expect(p.terms[0]).toBeGreaterThan(0)
      const negatives = p.terms.filter((term) => term < 0).length
      expect(negatives).toBeGreaterThanOrEqual(1)
      expect(negatives).toBeLessThanOrEqual(2)
      subtractions.add(negatives)
      let total = 0
      for (const term of p.terms) {
        total += term
        expect(total).toBeGreaterThanOrEqual(0)
      }
      expect(total).toBeGreaterThan(0)
      // A total equal to the first number would leave the beads exactly
      // where they started (spec (見取算) §3), so こたえる could never be
      // pressed to submit it.
      expect(total).not.toBe(p.terms[0])
      expectReplaysTo(p)
    }
    // Both counts occur.
    expect([...subtractions].sort()).toEqual([1, 2])
  })

  it('generates the same columns for the same seed', () => {
    const kind = { op: 'mitori', digits: 2 } as const
    expect(generateProblems(kind, 10, seeded(5))).toEqual(generateProblems(kind, 10, seeded(5)))
  })
})

// Spec (core rounds) §11, the owner (2026-09-27/28): 手順を見る groups a
// problem's steps the way the learner thinks of them — one number added or
// taken off (＋ −, 見取算), one multiplicand digit times the whole multiplier
// (×), one quotient digit placed and taken off (÷) — each with what the
// soroban reads before and after it (for ÷, what is left).
describe('problemSections', () => {
  // Every group belongs to exactly one section, in order, and each section
  // starts where the one before it ends.
  function expectWholeAndChained(p: Problem) {
    const sections = problemSections(p)
    expect(sections.flatMap((section) => section.groups)).toEqual(problemSteps(p).map((_, index) => index))
    for (let k = 1; k < sections.length; k++) expect(sections[k]?.before).toBe(sections[k - 1]?.after)
  }

  it('makes the number added one section for ＋, and the number taken off for −', () => {
    expect(problemSections(problem('add', 472, 385))).toEqual([
      { kind: 'number', value: 385, before: 472, after: 857, groups: [0, 1, 2] },
    ])
    expect(problemSections(problem('sub', 472, 385))).toEqual([
      { kind: 'number', value: -385, before: 472, after: 87, groups: [0, 1, 2] },
    ])
  })

  it('makes each later number of a 見取算 column a section', () => {
    expect(problemSections(mitori(2, [47, 30, -23, 61, -19]))).toEqual([
      { kind: 'number', value: 30, before: 47, after: 77, groups: [0, 1] },
      { kind: 'number', value: -23, before: 77, after: 54, groups: [2, 3] },
      { kind: 'number', value: 61, before: 54, after: 115, groups: [4, 5] },
      { kind: 'number', value: -19, before: 115, after: 96, groups: [6, 7] },
    ])
  })

  it('makes each multiplicand digit times the multiplier a section for ×', () => {
    expect(problemSections(problem('mul', 47, 36))).toEqual([
      { kind: 'multiply', x: 4, multiplier: 36, before: 0, after: 1440, groups: [0, 1] },
      { kind: 'multiply', x: 7, multiplier: 36, before: 1440, after: 1692, groups: [2, 3] },
    ])
  })

  it('keeps a section for a multiplicand digit of 0, which changes nothing', () => {
    const sections = problemSections(problem('mul', 405, 123))
    expect(sections.map((section) => (section.kind === 'multiply' ? section.x : null))).toEqual([4, 0, 5])
    expect(sections[1]?.before).toBe(sections[1]?.after)
    expect(sections[2]?.after).toBe(405 * 123)
  })

  it('makes each quotient digit a section for ÷, with what is left before and after', () => {
    expect(problemSections({ op: 'div', digits: 2, a: 1692, b: 36 })).toEqual([
      { kind: 'divide', q: 4, before: 1692, after: 252, groups: [0, 1, 2] },
      { kind: 'divide', q: 7, before: 252, after: 0, groups: [3, 4, 5] },
    ])
  })

  it('keeps a section for a quotient digit of 0, which places and takes off nothing', () => {
    const sections = problemSections({ op: 'div', digits: 3, a: 202032, b: 976 })
    expect(sections.map((section) => (section.kind === 'divide' ? section.q : null))).toEqual([2, 0, 7])
    expect(sections.map((section) => [section.before, section.after])).toEqual([
      [202032, 6832],
      [6832, 6832],
      [6832, 0],
    ])
  })

  it('covers every step of every kind of problem, in order', () => {
    for (const kind of PRACTICE_KINDS) {
      for (const p of generateProblems(kind, 30, seeded(17))) expectWholeAndChained(p)
    }
  })
})

describe('problemKey', () => {
  it('names a problem by its numbers', () => {
    expect(problemKey({ op: 'add', digits: 2, a: 47, b: 85 })).toBe('47,85')
    expect(problemKey({ op: 'mitori', digits: 1, terms: [7, 3, -2, 8, -4] })).toBe('7,3,-2,8,-4')
  })
})
