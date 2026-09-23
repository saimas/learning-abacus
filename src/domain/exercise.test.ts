import { ATOMS, expectedValue, moveStates, startValue } from './atoms'
import { exerciseForAtom, exerciseForProblem } from './exercise'
import { problemStates } from './problem'

describe('exerciseForAtom', () => {
  it.each(ATOMS.map((atom) => [atom.id, atom] as const))('matches today’s question for %s', (_, atom) => {
    expect(exerciseForAtom(atom)).toEqual({
      rods: 2,
      start: startValue(atom),
      expected: expectedValue(atom),
      states: moveStates(atom),
    })
  })
})

describe('exerciseForProblem', () => {
  it('sets a on a rod per digit plus one, and expects the sum', () => {
    const problem = { op: 'add', digits: 3, a: 472, b: 385 } as const
    expect(exerciseForProblem(problem)).toEqual({
      rods: 4,
      start: 472,
      expected: 857,
      states: problemStates(problem),
    })
  })

  it('starts a multiplication at 0 on twice as many rods as digits', () => {
    const problem = { op: 'mul', digits: 2, a: 47, b: 36 } as const
    expect(exerciseForProblem(problem)).toEqual({ rods: 4, start: 0, expected: 1692, states: problemStates(problem) })
  })
})
