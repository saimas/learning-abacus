import { ATOMS, atomId, classify, decompose } from './atoms'
import { applyStep, emptySoroban, readValue, setValue } from './soroban'

describe('the alphabet', () => {
  it('contains exactly 180 atoms', () => {
    expect(ATOMS).toHaveLength(180)
  })

  it('has no duplicate ids', () => {
    expect(new Set(ATOMS.map((a) => a.id)).size).toBe(180)
  })

  it('covers every rod value, operand and direction', () => {
    for (let v = 0; v <= 9; v++) {
      for (let n = 1; n <= 9; n++) {
        expect(ATOMS.some((a) => a.rodValue === v && a.operand === n && a.direction === 'add')).toBe(true)
        expect(ATOMS.some((a) => a.rodValue === v && a.operand === n && a.direction === 'sub')).toBe(true)
      }
    }
  })
})

describe('classification', () => {
  it.each([
    [1, 3, 'add', 'direct'],
    [0, 5, 'add', 'direct'],
    [3, 4, 'add', 'five'],
    [7, 8, 'add', 'ten'],
    [7, 6, 'add', 'both'],
  ] as const)('%i %s %i is %s', (v, n, direction, expected) => {
    expect(classify({ id: atomId(v, n, direction), rodValue: v, operand: n, direction })).toBe(expected)
  })
})

describe('decomposition', () => {
  // The property that validates the entire arithmetic core.
  it.each(ATOMS.map((a) => [a.id, a] as const))(
    '%s decomposes to steps that produce the right value',
    (_id, atom) => {
      // Rod 0 is the carry rod, rod 1 the working rod. Start the carry rod at 1
      // so a borrow has somewhere to come from.
      const start = setValue(emptySoroban(2), 10 + atom.rodValue)
      const result = decompose(atom).reduce((s, step) => applyStep(s, step, 1), start)
      const delta = atom.direction === 'add' ? atom.operand : -atom.operand
      expect(readValue(result)).toBe(10 + atom.rodValue + delta)
    },
  )

  it('turns 3+4 into +5 then -1', () => {
    expect(decompose({ id: atomId(3, 4, 'add'), rodValue: 3, operand: 4, direction: 'add' })).toEqual([
      { rod: 'working', delta: 5 },
      { rod: 'working', delta: -1 },
    ])
  })

  it('turns 7+8 into a carry then -2', () => {
    expect(decompose({ id: atomId(7, 8, 'add'), rodValue: 7, operand: 8, direction: 'add' })).toEqual([
      { rod: 'carry', delta: 1 },
      { rod: 'working', delta: -2 },
    ])
  })
})
