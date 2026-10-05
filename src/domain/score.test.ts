import type { Problem } from './problem'
import { answerPoints, basePoints, BEAD_SPEED_FACTOR, comboFactor, levelFactor, speedFactor } from './score'

// 47 + 85's time target is 4,560 ms at the default calibration.
const sum: Problem = { op: 'add', digits: 2, a: 47, b: 85 }

describe('basePoints', () => {
  it('gives 10 points per second of the problem\'s time target', () => {
    expect(basePoints(sum, 900)).toBe(46)
    expect(basePoints({ op: 'add', digits: 1, a: 7, b: 8 }, 900)).toBe(25)
    expect(basePoints({ op: 'div', digits: 2, a: 1692, b: 36 }, 900)).toBe(181)
  })
})

describe('levelFactor', () => {
  it.each([[0, 1], [3, 1.75], [6, 2.5]] as const)('makes level %p ×%p', (level, factor) => {
    expect(levelFactor(level)).toBe(factor)
  })
})

describe('comboFactor', () => {
  it.each([[1, 1], [4, 1], [5, 1.5], [9, 1.5], [10, 2], [19, 2], [20, 3], [50, 3]])(
    'makes a combo of %p ×%p',
    (combo, factor) => {
      expect(comboFactor(combo)).toBe(factor)
    },
  )
})

describe('speedFactor', () => {
  // A 1-second target allows 2 seconds on the beads.
  it.each([[500, 1.5], [2_000, 1.5], [3_000, 1.25], [4_000, 1], [10_000, 1]])(
    'makes %p ms against a 1 s target ×%p',
    (ms, factor) => {
      expect(speedFactor(ms, 1_000)).toBe(factor)
    },
  )

  it('allows the beads twice a typed answer\'s target', () => {
    expect(BEAD_SPEED_FACTOR).toBe(2)
  })
})

describe('answerPoints', () => {
  // Spec (runs) §3's worked example: 47 + 85 at F3, the 12th right answer in
  // a row, within its target: 46 × 1.75 × 2 × 1.5 = 241.5.
  it('multiplies the base by the level, combo and speed factors', () => {
    expect(answerPoints({ problem: sum, calibrationMs: 900, level: 3, combo: 12, answerMs: 5_000 })).toBe(242)
  })

  it('gives the base alone at F0, early in a combo, answered slowly', () => {
    expect(answerPoints({ problem: sum, calibrationMs: 900, level: 0, combo: 1, answerMs: 60_000 })).toBe(46)
  })
})
