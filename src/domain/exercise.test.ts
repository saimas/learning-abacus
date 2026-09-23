import { ATOMS, atomId, expectedValue, moveStates, startValue } from './atoms'
import { exerciseForAtom, exerciseForProblem, stepColouring } from './exercise'
import { problemStates } from './problem'
import { emptySoroban, setValue, type Soroban } from './soroban'

describe('exerciseForAtom', () => {
  it.each(ATOMS.map((atom) => [atom.id, atom] as const))('matches today’s question for %s', (_, atom) => {
    expect(exerciseForAtom(atom)).toEqual({
      rods: 2,
      start: startValue(atom),
      expected: expectedValue(atom),
      states: moveStates(atom),
      groupStarts: [0],
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
      // Hundreds +5 −2, tens +10 −2, ones +5.
      groupStarts: [0, 2, 4],
    })
  })

  it('starts a multiplication at 0 on twice as many rods as digits', () => {
    const problem = { op: 'mul', digits: 2, a: 47, b: 36 } as const
    expect(exerciseForProblem(problem)).toEqual({
      rods: 4,
      start: 0,
      expected: 1692,
      states: problemStates(problem),
      // 4×3 is +1 +2, 4×6 is +2 +4, 7×3 is +5 −3 then +5 −4, 7×6 is +4 +2.
      groupStarts: [0, 2, 4, 8],
    })
  })

  it('starts no operation at a column with nothing to add', () => {
    // 472 + 305: the tens column adds 0, so it moves no bead and there is
    // nothing of it to colour.
    expect(exerciseForProblem({ op: 'add', digits: 3, a: 472, b: 305 }).groupStarts).toEqual([0, 2])
  })
})

// The owner's request (2026-09-23): while stepping, the beads the current
// operation has moved so far are coloured, the latest step's the deepest.
describe('stepColouring', () => {
  const add = exerciseForProblem({ op: 'add', digits: 3, a: 472, b: 385 })
  const colouring = (index: number | null) => stepColouring(add.states, add.groupStarts, index)
  const heaven = (rod: number) => ({ rod, bead: { kind: 'heaven' } as const })
  const earth = (rod: number, index: number) => ({ rod, bead: { kind: 'earth', index } as const })

  it('colours nothing when not stepping, or at the start', () => {
    expect(colouring(null)).toEqual({ group: [], latest: [] })
    expect(colouring(0)).toEqual({ group: [], latest: [] })
  })

  it('colours the first move as both the operation and the latest step', () => {
    // 472 → 972: +5 on the hundreds rod.
    expect(colouring(1)).toEqual({ group: [heaven(1)], latest: [heaven(1)] })
  })

  it('keeps the operation’s earlier beads coloured, and the latest step’s deepest', () => {
    // 972 → 772: −2 finishes the hundreds column.
    expect(colouring(2)).toEqual({
      group: [heaven(1), earth(1, 2), earth(1, 3)],
      latest: [earth(1, 2), earth(1, 3)],
    })
  })

  it('leaves the last operation behind at the first move of the next', () => {
    // 772 → 872: the tens column's carry lands on the hundreds rod, but the
    // hundreds column's own beads are no longer coloured.
    expect(colouring(3)).toEqual({ group: [earth(1, 2)], latest: [earth(1, 2)] })
    // 872 → 852: −2 on the tens rod finishes the tens column.
    expect(colouring(4)).toEqual({
      group: [earth(1, 2), earth(2, 0), earth(2, 1)],
      latest: [earth(2, 0), earth(2, 1)],
    })
  })

  it('colours a whole cascade as one operation', () => {
    // 46 + 54: the tens column is +5 (46 → 96). The ones column's +4 is a
    // 10's complement whose carry meets a full tens rod, so the carry
    // ripples to the hundreds: 096 → 196 → 146 → 106 → 101 → 100.
    const cascade = exerciseForProblem({ op: 'add', digits: 2, a: 46, b: 54 })
    expect(cascade.groupStarts).toEqual([0, 1])
    const at = (index: number) => stepColouring(cascade.states, cascade.groupStarts, index)
    expect(at(1)).toEqual({ group: [heaven(1)], latest: [heaven(1)] })
    // The ones column starts with the carry on the hundreds rod, and the tens
    // column's heaven bead is left behind.
    expect(at(2)).toEqual({ group: [earth(0, 0)], latest: [earth(0, 0)] })
    // The tens rod's heaven bead moves again, now as part of the ones column.
    expect(at(6)).toEqual({
      group: [earth(0, 0), heaven(1), earth(1, 0), earth(1, 1), earth(1, 2), earth(1, 3), heaven(2), earth(2, 0)],
      latest: [earth(2, 0)],
    })
  })

  it('keeps a bead coloured that moved and moved back within the operation', () => {
    // One rod: 0 → 1 → 0 → 5. Earth bead 0 took part, though the rod shows
    // no earth bead at the end.
    const one = (value: number): Soroban => setValue(emptySoroban(1), value)
    expect(stepColouring([one(0), one(1), one(0), one(5)], [0], 3)).toEqual({
      group: [heaven(0), earth(0, 0)],
      latest: [heaven(0)],
    })
  })

  it('treats a single move as one operation', () => {
    // 4 + 3 is +5 −2.
    const atom = ATOMS.find((candidate) => candidate.id === atomId(4, 3, 'add'))
    if (atom === undefined) throw new Error('no atom 4 + 3')
    const exercise = exerciseForAtom(atom)
    expect(stepColouring(exercise.states, exercise.groupStarts, 2)).toEqual({
      group: [heaven(1), earth(1, 2), earth(1, 3)],
      latest: [earth(1, 2), earth(1, 3)],
    })
  })
})
