import { applyStep, emptySoroban, setValue, type RodStep, type Soroban } from './soroban'

export type Direction = 'add' | 'sub'
export type AtomClass = 'direct' | 'five' | 'ten' | 'both'

export type Atom = {
  id: string
  rodValue: number
  operand: number
  direction: Direction
}

export function atomId(rodValue: number, operand: number, direction: Direction): string {
  return `${rodValue}${direction === 'add' ? '+' : '-'}${operand}`
}

function generate(): Atom[] {
  const atoms: Atom[] = []
  for (let rodValue = 0; rodValue <= 9; rodValue++) {
    for (let operand = 1; operand <= 9; operand++) {
      for (const direction of ['add', 'sub'] as const) {
        atoms.push({ id: atomId(rodValue, operand, direction), rodValue, operand, direction })
      }
    }
  }
  return atoms
}

export const ATOMS: readonly Atom[] = Object.freeze(generate())

export function decompose(atom: Atom): RodStep[] {
  const { rodValue, operand, direction } = atom
  const sign = direction === 'add' ? 1 : -1
  const result = rodValue + sign * operand

  // Needs a carry or borrow into the rod on the left. Adding n becomes
  // "+10, then subtract (10 - n)"; subtracting n becomes "-10, then add
  // (10 - n)". Either way the inner move runs in the opposite direction.
  if (result > 9 || result < 0) {
    const inner = decomposeWithinRod(rodValue, 10 - operand, -sign)
    return [{ rod: 'carry', delta: sign }, ...inner]
  }
  return decomposeWithinRod(rodValue, operand, sign)
}

// Adds `sign * operand` to a rod showing `rodValue`, staying within 0-9.
function decomposeWithinRod(rodValue: number, operand: number, sign: number): RodStep[] {
  const earth = rodValue % 5
  const delta = sign * operand
  const target = rodValue + delta

  const earthRoom = sign > 0 ? 4 - earth : earth
  if (Math.abs(delta) <= earthRoom && Math.floor(target / 5) === Math.floor(rodValue / 5)) {
    return [{ rod: 'working', delta }]
  }
  // Use the heaven bead: move 5, then correct by the 5's complement.
  const steps: RodStep[] = [{ rod: 'working', delta: sign * 5 }]
  const correction = delta - sign * 5
  if (correction !== 0) steps.push({ rod: 'working', delta: correction })
  return steps
}

export function classify(atom: Atom): AtomClass {
  const steps = decompose(atom)
  const carries = steps.some((s) => s.rod === 'carry')
  const workingSteps = steps.filter((s) => s.rod === 'working').length
  if (carries) return workingSteps > 1 ? 'both' : 'ten'
  return workingSteps > 1 ? 'five' : 'direct'
}

// A subtraction that would go below zero has to borrow from the tens rod, so
// the problem starts with a 1 there: 3 − 5 is set as 13 − 5. Starting from 03
// would leave nothing to borrow, and the answer would be −2, which neither
// the keypad nor the beads can express.
export function startValue(atom: Atom): number {
  const borrows = atom.direction === 'sub' && atom.rodValue - atom.operand < 0
  return borrows ? 10 + atom.rodValue : atom.rodValue
}

// What the soroban reads once the move is done: 7 + 4 → 11, 13 − 5 → 8.
export function expectedValue(atom: Atom): number {
  return startValue(atom) + (atom.direction === 'add' ? atom.operand : -atom.operand)
}

// The soroban at each point of the move, for replaying it: the start, then
// the state after each step of decompose(). 7 + 8 → 07, 17, 15. The session
// soroban has two rods; the ones rod (index 1) is the one worked, and a
// carry or borrow lands on the tens rod to its left.
export function moveStates(atom: Atom): Soroban[] {
  let current = setValue(emptySoroban(2), startValue(atom))
  const states = [current]
  for (const step of decompose(atom)) {
    current = applyStep(current, step, 1)
    states.push(current)
  }
  return states
}
