import { divisionWalk, walkFrames, walkStates, type WalkStep } from './divisionWalk'
import { answerOf, generateProblems, problemStates, type Digits, type Problem } from './problem'
import { readValue } from './soroban'

// A small seeded generator (mulberry32), so the 3けた sample is repeatable.
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

function division(q: number, d: number): Problem {
  const digits = String(d).length as Digits
  return { op: 'div', digits, a: q * d, b: d }
}

const kinds = (walk: WalkStep[]) => walk.map((step) => step.kind)

// What is wrong with a problem's walk, if anything (spec (division
// walkthrough) §2): it must end where the rounds' steps do, never get stuck
// on a digit's first 九九 (the guess is that 九九), lower a digit one at a
// time, and settle each lane on the quotient's digit.
function walkFaults(problem: Problem): string[] {
  const faults: string[] = []
  const name = `${problem.a} ÷ ${problem.b}`
  const walk = divisionWalk(problem)
  const states = walkStates(problem, walk)
  const rounds = problemStates(problem)
  const end = states[states.length - 1]
  const roundsEnd = rounds[rounds.length - 1]
  if (end === undefined || roundsEnd === undefined || readValue(end) !== readValue(roundsEnd)) {
    faults.push(`${name}: ends elsewhere`)
  }
  const settled: number[] = []
  let trying: number | null = null
  for (const step of walk) {
    if (step.kind === 'stuck' && step.j === problem.digits - 1) faults.push(`${name}: stuck on the first 九九`)
    if (step.kind === 'try') trying = step.digit
    if (step.kind === 'fix') {
      if (step.from !== trying) faults.push(`${name}: fixed ${step.from}, trying ${trying}`)
      trying = step.from - 1
      if (trying === 0) settled.push(0)
    }
    if (step.kind === 'take' && step.last) settled.push(step.digit)
    if (step.kind === 'guess' && step.guess === 0) settled.push(0)
  }
  const expected = String(answerOf(problem)).padStart(problem.digits, '0').split('').map(Number)
  if (settled.join() !== expected.join()) faults.push(`${name}: settled ${settled.join('')}`)
  return faults
}

describe('divisionWalk', () => {
  // The owner's example (2026-09-24), step for step as the web walkthrough
  // that made it click.
  it('works 1692 ÷ 36 guess by guess', () => {
    const walk = divisionWalk(division(47, 36))
    expect(kinds(walk)).toEqual([
      'set',
      'guess',
      'try',
      'take',
      'stuck',
      'fix',
      'take',
      'guess',
      'try',
      'take',
      'stuck',
      'fix',
      'take',
      'done',
    ])
    expect(walk.map((step) => step.left)).toEqual([1692, 1692, 1692, 192, 192, 492, 252, 252, 252, 12, 12, 42, 0, 0])
    expect(walk[0]).toMatchObject({ focus: [1, 2, 3, 4], answer: [null, null] })
    expect(walk[1]).toMatchObject({
      kind: 'guess',
      p: 1,
      chunk: 169,
      partial: 16,
      raw: 5,
      guess: 5,
      remainderZero: false,
      focus: [1, 2, 3],
      divisorPlaces: [1],
    })
    expect(walk[2]).toMatchObject({
      kind: 'try',
      digit: 5,
      lead: 16,
      split: false,
      steps: [{ rodIndex: 0, delta: 5 }],
      marks: [{ rodIndex: 0, amount: 5 }],
      answer: [{ digit: 5, trial: true }, null],
    })
    expect(walk[3]).toMatchObject({
      kind: 'take',
      digit: 5,
      y: 3,
      j: 1,
      amount: 1500,
      before: 1692,
      resumed: false,
      last: false,
      steps: [
        { rodIndex: 1, delta: -1 },
        { rodIndex: 2, delta: -5 },
      ],
      focus: [1, 2],
      marks: [
        { rodIndex: 1, amount: -1 },
        { rodIndex: 2, amount: -5 },
      ],
    })
    expect(walk[4]).toMatchObject({
      kind: 'stuck',
      digit: 5,
      y: 6,
      j: 0,
      amount: 300,
      steps: [],
      marks: [{ rodIndex: 2, amount: -3 }],
      divisorPlaces: [0],
    })
    // The fix: 5 → 4 (a 5-complement on the answer rod), then the 3 of 36
    // back on the hundreds.
    expect(walk[5]).toMatchObject({
      kind: 'fix',
      from: 5,
      taken: 30,
      back: 300,
      before: 192,
      laneStart: 1692,
      steps: [
        { rodIndex: 0, delta: -5 },
        { rodIndex: 0, delta: 4 },
        { rodIndex: 2, delta: 3 },
      ],
      focus: [0, 2],
      marks: [
        { rodIndex: 0, amount: -1 },
        { rodIndex: 2, amount: 3 },
      ],
      divisorPlaces: [1],
      answer: [{ digit: 4, trial: true }, null],
    })
    // The 4 comes through its last 九九, so it is settled.
    expect(walk[6]).toMatchObject({
      kind: 'take',
      digit: 4,
      y: 6,
      amount: 240,
      resumed: true,
      last: true,
      answer: [{ digit: 4, trial: false }, null],
    })
    expect(walk[7]).toMatchObject({ kind: 'guess', p: 0, chunk: 252, partial: 25, guess: 8, focus: [2, 3, 4] })
    expect(walk[11]).toMatchObject({ kind: 'fix', from: 8, taken: 30, back: 30, before: 12, laneStart: 252 })
    expect(walk[12]).toMatchObject({ kind: 'take', digit: 7, amount: 42, last: true })
    expect(walk[13]).toMatchObject({
      kind: 'done',
      focus: [0, 1],
      answer: [
        { digit: 4, trial: false },
        { digit: 7, trial: false },
      ],
    })
    expect(walk.flatMap((step) => step.steps)).toHaveLength(17)
    expect(walkFaults(division(47, 36))).toEqual([])
  })

  it('caps a guess at 9 and lowers it as often as it sticks: 285 ÷ 19', () => {
    const walk = divisionWalk(division(15, 19))
    const second = walk.findIndex((step) => step.kind === 'guess' && step.p === 0)
    expect(walk[second]).toMatchObject({ kind: 'guess', partial: 9, raw: 9, guess: 9 })
    expect(kinds(walk.slice(second))).toEqual([
      'guess',
      'try',
      'take',
      'stuck',
      'fix',
      'stuck',
      'fix',
      'stuck',
      'fix',
      'stuck',
      'fix',
      'take',
      'done',
    ])
    expect(walkFaults(division(15, 19))).toEqual([])
    // 684 ÷ 36: 32 ÷ 3 is 10 or more.
    expect(divisionWalk(division(19, 36)).find((step) => step.kind === 'guess' && step.p === 0)).toMatchObject({
      raw: 10,
      guess: 9,
    })
  })

  it('guesses 0 without placing anything: 202032 ÷ 976 and 360 ÷ 36', () => {
    const walk = divisionWalk(division(207, 976))
    const zero = walk.findIndex((step) => step.kind === 'guess' && step.p === 1)
    expect(walk[zero]).toMatchObject({
      guess: 0,
      remainderZero: false,
      answer: [{ digit: 2, trial: false }, { digit: 0, trial: false }, null],
    })
    expect(walk[zero + 1]).toMatchObject({ kind: 'guess', p: 0 })
    expect(divisionWalk(division(10, 36)).find((step) => step.kind === 'guess' && step.p === 0)).toMatchObject({
      guess: 0,
      remainderZero: true,
    })
  })

  it('ends a lane whose digit is lowered to 0: 17702 ÷ 167', () => {
    const walk = divisionWalk(division(106, 167))
    const toZero = walk.findIndex((step) => step.kind === 'fix' && step.from === 1)
    expect(walk[toZero]).toMatchObject({ p: 1, answer: [{ digit: 1, trial: false }, { digit: 0, trial: false }, null] })
    expect(walk[toZero + 1]).toMatchObject({ kind: 'guess', p: 0, raw: 10, guess: 9 })
    expect(walkFaults(division(106, 167))).toEqual([])
  })

  it('never needs a fix for a 1-digit divisor: 56 ÷ 8', () => {
    expect(kinds(divisionWalk(division(7, 8)))).toEqual(['set', 'guess', 'try', 'take', 'done'])
  })

  it('works every 1けた and 2けた problem, and a large 3けた sample, the way the rounds end', () => {
    const faults: string[] = []
    for (let q = 2; q <= 9; q++) for (let d = 2; d <= 9; d++) faults.push(...walkFaults(division(q, d)))
    for (let q = 10; q <= 99; q++) for (let d = 10; d <= 99; d++) faults.push(...walkFaults(division(q, d)))
    faults.push(...generateProblems({ op: 'div', digits: 3 }, 10_000, seeded(23)).flatMap(walkFaults))
    expect(faults).toEqual([])
  })
})

describe('walkFrames', () => {
  // One frame per bead step, or one for a step without beads.
  it('gives 1692 ÷ 36 23 frames', () => {
    const walk = divisionWalk(division(47, 36))
    const { frames, groupStarts } = walkFrames(walk)
    expect(frames).toHaveLength(23)
    expect(frames.slice(0, 7)).toEqual([
      { step: 0, state: 0 },
      { step: 1, state: 0 },
      { step: 2, state: 1 },
      { step: 3, state: 2 },
      { step: 3, state: 3 },
      { step: 4, state: 3 },
      { step: 5, state: 4 },
    ])
    expect(frames[frames.length - 1]).toEqual({ step: 13, state: 17 })
    expect(groupStarts).toEqual([0, 0, 0, 1, 3, 3, 6, 8, 8, 10, 13, 13, 15, 17])
    expect(walkStates(division(47, 36), walk).map(readValue)).toEqual([
      1692, 51692, 50692, 50192, 192, 40192, 40492, 40292, 40252, 45252, 48252, 48052, 48002, 48012, 47012, 47042,
      47002, 47000,
    ])
  })
})
