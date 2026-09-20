import { atomId, classify, type Atom, type Direction } from './atoms'
import { describeSteps, explainMove } from './explain'

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

describe('explainMove', () => {
  // Spec §3: the rewiring has happened when "add 8" *means* "+10 − 2" and
  // never means "8". The sentence is the substitution, stated as an identity.
  it('states the substitution an addition stands for', () => {
    expect(explainMove(atom(7, 8, 'add'))).toBe('Add 8 = +10 − 2')
  })

  it('states the substitution a subtraction stands for', () => {
    expect(explainMove(atom(6, 4, 'sub'))).toBe('Subtract 4 = −5 + 1')
  })
})
