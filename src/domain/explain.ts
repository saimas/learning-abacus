import { decompose, type Atom } from './atoms'
import type { RodStep } from './soroban'

// Spec §3: the goal state is that "add 8" *means* "+10 − 2" and never means
// "8". That substitution is what the app has to say out loud at F0, so the
// decomposition needs a reading as well as a representation.

// U+2212 MINUS SIGN, matching the spec's own notation. It is the width of the
// plus, so a column of steps stays aligned; the hyphen does not.
const MINUS = '−'

function sign(amount: number): string {
  return amount < 0 ? MINUS : '+'
}

// A carry step moves one bead on the rod to the left, which is worth ten on
// the rod being worked.
function amountOf(step: RodStep): number {
  return step.rod === 'carry' ? step.delta * 10 : step.delta
}

// Reads as arithmetic does: the first term carries its sign, and every step
// after it is an operator applied to what came before — "+10 − 2", not
// "+10 -2".
export function describeSteps(atom: Atom): string {
  return decompose(atom)
    .map(amountOf)
    .map((amount, index) =>
      index === 0
        ? `${sign(amount)}${Math.abs(amount)}`
        : `${sign(amount)} ${Math.abs(amount)}`,
    )
    .join(' ')
}
