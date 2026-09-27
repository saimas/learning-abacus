import { ATOMS, atomId, expectedValue, moveStates, startValue } from './atoms'
import { exerciseForAtom, exerciseForProblem, stepColouring } from './exercise'
import { problemStates, problemSteps, type MitoriProblem } from './problem'
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
      // Spec (core rounds) §11: the number added is one operation, however
      // many columns it takes (hundreds +5 −2, tens +10 −2, ones +5).
      groupStarts: [0],
    })
  })

  it('starts a multiplication at 0 on twice as many rods as digits', () => {
    const problem = { op: 'mul', digits: 2, a: 47, b: 36 } as const
    expect(exerciseForProblem(problem)).toEqual({
      rods: 4,
      start: 0,
      expected: 1692,
      states: problemStates(problem),
      // One operation per multiplicand digit (spec (core rounds) §11): 4×3
      // is +1 +2 and 4×6 is +2 +4; then 7×3 is +5 −3 then +5 −4, 7×6 +4 +2.
      groupStarts: [0, 4],
    })
  })

  // Spec (division) §2: 商除法 leaves the quotient on the soroban followed
  // by zeros, so the beads are checked against that reading, while the
  // keypad takes the quotient itself.
  it('sets the dividend for a division, and expects the quotient on the keypad and q × 10^(N+1) on the beads', () => {
    const problem = { op: 'div', digits: 2, a: 1692, b: 36 } as const
    expect(exerciseForProblem(problem)).toEqual({
      rods: 5,
      start: 1692,
      expected: 47,
      expectedBeads: 47000,
      states: problemStates(problem),
      // One operation per quotient digit (spec (core rounds) §11): place 4
      // (+4), 4×3 is −1 then −2 as −5 +3, 4×6 is −2 −4; then place 7 as
      // +5 +2, 7×3 is −2 then −1 as −5 +4, 7×6 is −4 −2.
      groupStarts: [0, 6],
    })
  })

  it('gives ＋ − × no separate bead answer', () => {
    for (const op of ['add', 'sub', 'mul'] as const) {
      expect(exerciseForProblem({ op, digits: 2, a: 47, b: 36 })).not.toHaveProperty('expectedBeads')
    }
  })

  it('starts no operation for a section with nothing to move', () => {
    // 405 × 123: the multiplicand's tens digit is 0, so its 九九 move no bead
    // and there is nothing of it to colour: two operations, not three.
    const { groupStarts } = exerciseForProblem({ op: 'mul', digits: 3, a: 405, b: 123 })
    expect(groupStarts).toHaveLength(2)
    expect(groupStarts[0]).toBe(0)
  })

  // Spec (見取算) §7, the owner (2026-09-27): it was hard to tell which clicks
  // were −59's and which +39's, so a 見取算 number is one operation, however
  // many rods it moves.
  it('starts one operation per 見取算 number, not per rod', () => {
    const problem: MitoriProblem = { op: 'mitori', digits: 2, terms: [47, 30, -23, 61, -19] }
    // Where each number's first bead step falls, counted over the steps.
    const expected: number[] = []
    let at = 0
    let current: number | undefined
    for (const group of problemSteps(problem)) {
      if (group.kind === 'column' && group.steps.length > 0 && group.term !== current) {
        expected.push(at)
        current = group.term
      }
      at += group.steps.length
    }
    const { groupStarts } = exerciseForProblem(problem)
    expect(groupStarts).toEqual(expected)
    expect(groupStarts).toHaveLength(4)
    // 47 + 30 is +5 − 2 on the tens rod, two steps; −23 starts after them.
    expect(groupStarts.slice(0, 2)).toEqual([0, 2])
  })
})

// The owner's request (2026-09-23): while stepping, the beads the current
// operation has moved so far are coloured, the latest step's the deepest.
describe('stepColouring', () => {
  // stepColouring colours whatever operations it is given. These tests give
  // it one per column of 472 + 385, which exercises every case it has.
  const add = exerciseForProblem({ op: 'add', digits: 3, a: 472, b: 385 })
  const columns = [0, 2, 4]
  const colouring = (index: number | null) => stepColouring(add.states, columns, index)
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
    const at = (index: number) => stepColouring(cascade.states, [0, 1], index)
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

  it('colours both digits of a 九九 as one operation', () => {
    // 47 × 36's 7×3 = 21: +2 on the hundreds (+5 −3, 1400 → 1940 → 1640),
    // then +1 on the tens (+5 −4, 1640 → 1690 → 1650).
    const mul = exerciseForProblem({ op: 'mul', digits: 2, a: 47, b: 36 })
    expect(stepColouring(mul.states, [0, 2, 4, 8], 8)).toEqual({
      group: [
        heaven(1),
        earth(1, 1),
        earth(1, 2),
        earth(1, 3),
        heaven(2),
        earth(2, 0),
        earth(2, 1),
        earth(2, 2),
        earth(2, 3),
      ],
      latest: [earth(2, 0), earth(2, 1), earth(2, 2), earth(2, 3)],
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
