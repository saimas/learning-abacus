import { ATOMS, atomId, classify, decompose, type Atom, type Direction } from './atoms'
import { describeStepParts, describeSteps } from './explain'

function atom(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

describe('describeSteps', () => {
  it('reads a direct move as the single move it is', () => {
    const a = atom(1, 3, 'add')
    expect(classify(a)).toBe('direct')
    expect(describeSteps(a)).toBe('+3')
  })

  it("spells out a 5's complement", () => {
    const a = atom(3, 4, 'add')
    expect(classify(a)).toBe('five')
    expect(describeSteps(a)).toBe('+5 − 1')
  })

  it('counts a carry as the ten it is worth on the working rod', () => {
    const a = atom(7, 8, 'add')
    expect(classify(a)).toBe('ten')
    expect(describeSteps(a)).toBe('+10 − 2')
  })

  it('spells out both substitutions of a combined complement', () => {
    const a = atom(7, 6, 'add')
    expect(classify(a)).toBe('both')
    expect(describeSteps(a)).toBe('+10 − 5 + 1')
  })

  it('reverses every sign for a borrow', () => {
    const a = atom(7, 8, 'sub')
    expect(classify(a)).toBe('ten')
    expect(describeSteps(a)).toBe('−10 + 2')
  })

  it('handles a combined borrow', () => {
    const a = atom(2, 6, 'sub')
    expect(classify(a)).toBe('both')
    expect(describeSteps(a)).toBe('−10 + 5 − 1')
  })
})

describe('describeStepParts', () => {
  it('gives each step its own part, signed as describeSteps reads it', () => {
    expect(describeStepParts(atom(1, 3, 'add'))).toEqual(['+3'])
    expect(describeStepParts(atom(7, 8, 'add'))).toEqual(['+10', '− 2'])
    expect(describeStepParts(atom(2, 6, 'sub'))).toEqual(['−10', '+ 5', '− 1'])
  })

  it('has one part per step of the move, for every atom', () => {
    for (const a of ATOMS) {
      expect(describeStepParts(a)).toHaveLength(decompose(a).length)
    }
  })
})
