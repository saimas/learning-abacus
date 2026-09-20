import type { RodStep } from './soroban'

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
