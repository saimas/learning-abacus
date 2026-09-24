import { atomId, classify, decompose, type Atom, type Direction } from './atoms'
import { latencyTargetMs } from './fluency'
import { emptySoroban, readRod, readValue, rodFor, setValue, type Soroban } from './soroban'

// Spec (multi-digit ＋ − and ×) §3: practice of two numbers of the same
// size, chosen as an operation and a digit count. For ÷ (spec: division §1)
// the size is the divisor's and the quotient's: a ÷ problem is a × problem
// run backwards, a the dividend and b the divisor.
export type Operation = 'add' | 'sub' | 'mul' | 'div'
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`
export type Problem = { op: Operation; digits: Digits; a: number; b: number }

export const OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul', 'div']
export const DIGITS: readonly Digits[] = [1, 2, 3]
export const PRACTICE_KINDS: readonly PracticeKind[] = OPERATIONS.flatMap((op) =>
  DIGITS.map((digits) => ({ op, digits })),
)

// The same in every language, so it lives with the operations rather than
// in the string catalogues.
export const OPERATION_SYMBOL: Record<Operation, string> = { add: '＋', sub: '−', mul: '×', div: '÷' }

export const ROUND_LENGTH = 10
// Typing the answer costs time the arithmetic does not, and a 4-digit answer
// costs more of it than a 2-digit one. A first estimate, like the per-move
// targets it is added to.
export const TYPING_ALLOWANCE_MS = 400

// Recalling a 九九 is part of the work a × answer takes that no bead move
// measures. A first estimate, like the per-move targets.
export const MULTIPLY_RECALL_MS = 600

// Choosing each quotient digit (comparing the remainder's head with the
// divisor, then trying a digit) is work of its own in 商除法 that no bead
// move measures. A first estimate, like MULTIPLY_RECALL_MS.
export const DIVIDE_ESTIMATE_MS = 1500

export function practiceId(kind: PracticeKind): PracticeId {
  return `${kind.op}:${kind.digits}`
}

// For values from outside the app's own code, such as a route parameter.
export function parsePracticeId(value: unknown): PracticeKind | null {
  if (typeof value !== 'string') return null
  return PRACTICE_KINDS.find((kind) => practiceId(kind) === value) ?? null
}

export function isPracticeId(value: unknown): value is PracticeId {
  return parsePracticeId(value) !== null
}

export function answerOf(problem: Problem): number {
  switch (problem.op) {
    case 'add':
      return problem.a + problem.b
    case 'sub':
      return problem.a - problem.b
    case 'mul':
      return problem.a * problem.b
    // Always whole: a ÷ problem is made as q × d, then divided by d.
    case 'div':
      return problem.a / problem.b
  }
}

// ＋ and − keep one rod beyond the operands for the last carry (999 + 999 =
// 1998). A product of two N-digit numbers can have 2N digits (99 × 99 =
// 9801), and 両落とし puts only the product on the soroban. 商除法 sets the
// dividend (up to 2N digits, places 0 to 2N − 1) and places the N-digit
// quotient left of it, from place 2N down to place N + 1: 2N + 1 rods.
export function rodsFor(kind: { op: Operation; digits: Digits }): number {
  switch (kind.op) {
    case 'mul':
      return kind.digits * 2
    case 'div':
      return kind.digits * 2 + 1
    default:
      return kind.digits + 1
  }
}

// What the soroban shows before the first step: a for ＋ − (and the dividend
// for ÷), nothing for ×.
export function startOf(problem: Problem): number {
  return problem.op === 'mul' ? 0 : problem.a
}

function randomInt(random: () => number, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1))
}

// Uniform over the allowed pairs. A subtraction draws two numbers and puts
// the larger first, which is still uniform over pairs with a > b; equal
// numbers are drawn again, since 0 teaches nothing and reads as a blank
// soroban. A division (spec: division §1) is a multiplication run
// backwards: it draws the quotient and the divisor, so it always comes out
// exact, and the dividend is their product.
export function generateProblems(kind: PracticeKind, count: number, random: () => number): Problem[] {
  // × 1 teaches nothing (anything × 1 is itself), so 1×1 draws from 2..9
  // instead of the usual single-digit range of 1..9, leaving out × 1. ÷ 1,
  // and a quotient of 1, teach nothing either.
  const nineNine = (kind.op === 'mul' || kind.op === 'div') && kind.digits === 1
  const low = nineNine ? 2 : 10 ** (kind.digits - 1)
  const high = 10 ** kind.digits - 1
  const problems: Problem[] = []
  const seen = new Set<string>()
  // A bound, not an expectation: even 1-digit subtraction has 36 pairs, so
  // this only stops a broken `random` from spinning forever.
  for (let tries = 0; problems.length < count && tries < count * 1000; tries++) {
    let a = randomInt(random, low, high)
    let b = randomInt(random, low, high)
    if (kind.op === 'sub') {
      if (a === b) continue
      if (a < b) [a, b] = [b, a]
    }
    // Drawn as the quotient a and the divisor b; the problem is (a × b) ÷ b.
    if (kind.op === 'div') a *= b
    const key = `${a},${b}`
    if (seen.has(key)) continue
    seen.add(key)
    problems.push({ op: kind.op, digits: kind.digits, a, b })
  }
  return problems
}

// A rod step with its rod named outright, since a problem's steps land on
// several rods and a cascade can reach past the one next door.
export type PlacedStep = { rodIndex: number; delta: number }

// One digit put on the soroban: the single move it is (one of the 180
// atoms), where it goes, and the bead steps that make it.
export type Move = { place: number; atom: Atom; steps: PlacedStep[]; cascades: boolean }

// What the learner works as one unit, and what one line of the answer card
// explains: a column of a ＋ − problem, or one 九九 of a × problem. `steps`
// is every bead step of the group in order; `cascades` says whether any
// carry in it had to ripple on. A 九九's `xPlace` and `yPlace` are the places
// (0 = ones) its digits `x` and `y` come from in a and b, so the operand
// board can point at the two digits being multiplied.
//
// A ÷ problem (商除法) alternates two kinds. `quotient` places the quotient
// digit `q` on the empty rod at `place` (商を立てる); `lead` is the
// remainder's leading N digits, the number compared with the divisor, and
// `split` says the digit lands two rods left of the remainder's head (the
// lead is at least the divisor: 割れる) rather than one (割れない). The card
// explains the placement by these. For a 0 digit nothing is placed and
// `lead` / `split` describe no placement. `subtract` takes the 九九 q × y
// off the remainder, where y is the divisor's digit at `yPlace`, so the
// divisor board can point at it; `place` is where its ones digit comes off,
// and its tens digit comes off one place above.
export type StepGroup =
  | { kind: 'column'; place: number; atom: Atom | null; steps: PlacedStep[]; cascades: boolean }
  | {
    kind: 'product'
    x: number
    y: number
    xPlace: number
    yPlace: number
    place: number
    moves: Move[]
    steps: PlacedStep[]
    cascades: boolean
  }
  | {
    kind: 'quotient'
    q: number
    place: number
    lead: number
    split: boolean
    moves: Move[]
    steps: PlacedStep[]
    cascades: boolean
  }
  | {
    kind: 'subtract'
    q: number
    y: number
    yPlace: number
    place: number
    moves: Move[]
    steps: PlacedStep[]
    cascades: boolean
  }

export function applyPlacedStep(s: Soroban, step: PlacedStep): Soroban {
  const target = s.rods[step.rodIndex]
  if (target === undefined) throw new Error(`no rod at index ${step.rodIndex}`)
  const next = readRod(target) + step.delta
  if (next < 0 || next > 9) throw new Error(`step leaves rod out of range: ${next}`)
  const rods = [...s.rods]
  rods[step.rodIndex] = rodFor(next)
  return { rods }
}

function digitAt(n: number, place: number): number {
  return Math.floor(n / 10 ** place) % 10
}

function atomFor(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

// Plays one move on rod `index`, step by step, so each step sees the rods as
// the ones before it left them. A carry or borrow is one bead on the rod to
// the left, unless that rod is already full (9, adding) or empty (0,
// subtracting). Then it is that rod's own ±1 move, which is itself a 10's
// complement with a carry of its own, so it is played the same way.
function placeMove(
  soroban: Soroban,
  index: number,
  atom: Atom,
): { soroban: Soroban; steps: PlacedStep[]; cascades: boolean } {
  let current = soroban
  const steps: PlacedStep[] = []
  let cascades = false
  for (const step of decompose(atom)) {
    if (step.rod === 'working') {
      const placed = { rodIndex: index, delta: step.delta }
      current = applyPlacedStep(current, placed)
      steps.push(placed)
      continue
    }
    const left = index - 1
    const leftRod = current.rods[left]
    if (leftRod === undefined) throw new Error(`no rod left of ${index} to carry into`)
    const next = readRod(leftRod) + step.delta
    if (next >= 0 && next <= 9) {
      const placed = { rodIndex: left, delta: step.delta }
      current = applyPlacedStep(current, placed)
      steps.push(placed)
      continue
    }
    const inner = placeMove(current, left, atomFor(readRod(leftRod), 1, step.delta > 0 ? 'add' : 'sub'))
    current = inner.soroban
    steps.push(...inner.steps)
    cascades = true
  }
  return { soroban: current, steps, cascades }
}

// Spec §3: a soroban works from the highest place down. Carries only ever go
// left, into columns already worked, so the rod a column is worked on still
// shows a's digit there when its turn comes.
function columnSteps(problem: Problem, direction: Direction): StepGroup[] {
  const rods = rodsFor(problem)
  let soroban = setValue(emptySoroban(rods), problem.a)
  const columns: StepGroup[] = []
  for (let place = problem.digits - 1; place >= 0; place--) {
    const digit = digitAt(problem.b, place)
    if (digit === 0) {
      columns.push({ kind: 'column', place, atom: null, steps: [], cascades: false })
      continue
    }
    const index = rods - 1 - place
    const rod = soroban.rods[index]
    if (rod === undefined) throw new Error(`no rod at index ${index}`)
    const atom = atomFor(readRod(rod), digit, direction)
    const move = placeMove(soroban, index, atom)
    soroban = move.soroban
    columns.push({ kind: 'column', place, atom, steps: move.steps, cascades: move.cascades })
  }
  return columns
}

// Plays each digit, in order, on the rod at its place (0 = ones), as the one
// atom it is from what that rod shows by then. A digit of 0 is not a move.
function playDigits(
  soroban: Soroban,
  digits: readonly (readonly [digit: number, place: number])[],
  direction: Direction,
): { soroban: Soroban; moves: Move[] } {
  let current = soroban
  const moves: Move[] = []
  for (const [digit, place] of digits) {
    if (digit === 0) continue
    const index = current.rods.length - 1 - place
    const rod = current.rods[index]
    if (rod === undefined) throw new Error(`no rod at index ${index}`)
    const atom = atomFor(readRod(rod), digit, direction)
    const move = placeMove(current, index, atom)
    current = move.soroban
    moves.push({ place, atom, steps: move.steps, cascades: move.cascades })
  }
  return { soroban: current, moves }
}

// A group of moves is worked as its moves' bead steps in order, and it
// cascades if any of its moves did.
function movesGroup(moves: Move[]): { moves: Move[]; steps: PlacedStep[]; cascades: boolean } {
  return { moves, steps: moves.flatMap((move) => move.steps), cascades: moves.some((move) => move.cascades) }
}

// A 九九's two digits, tens first, the ones digit at `place`.
function productDigits(product: number, place: number): [digit: number, place: number][] {
  return [
    [Math.floor(product / 10), place + 1],
    [product % 10, place],
  ]
}

// Spec (multiplication) §3: 両落とし from the top. Neither number is set on
// the soroban; the multiplicand's digits are taken from the highest, each
// times the multiplier's digits from the highest, and each 九九 is added as
// its tens digit then its ones digit. The ones digit's place is the two
// digits' places added together. A digit of 0 is not a move, but the 九九 is
// still a step the learner takes, so it keeps its group.
function productSteps(problem: Problem): StepGroup[] {
  let soroban = emptySoroban(rodsFor(problem))
  const groups: StepGroup[] = []
  for (let i = problem.digits - 1; i >= 0; i--) {
    for (let j = problem.digits - 1; j >= 0; j--) {
      const x = digitAt(problem.a, i)
      const y = digitAt(problem.b, j)
      const place = i + j
      const played = playDigits(soroban, productDigits(x * y, place), 'add')
      soroban = played.soroban
      groups.push({ kind: 'product', x, y, xPlace: i, yPlace: j, place, ...movesGroup(played.moves) })
    }
  }
  return groups
}

// Spec (division) §2: 商除法. The dividend is set right-aligned, so each of
// its digits sits at its own place. For each quotient digit q, from the
// highest (place p of the quotient), 商を立てる places q on the rod at place
// p + N + 1, then each 九九 of q and a divisor digit y, from the divisor's
// highest (place j), comes off the remainder: its tens digit at place
// p + j + 1, its ones digit at p + j, borrowing the way ＋ − carry.
//
// Why this stays on the rods: before q is placed, the remainder is the
// quotient's digits below p + 1 times the divisor, under 10^(p+1) × 10^N,
// so the rod at p + N + 1 is empty. Each 九九 taken off leaves at least the
// rest of that product, so the remainder never goes below 0 and no borrow
// reaches the quotient's rods. At the end only the quotient is left,
// followed by N + 1 zeros.
function quotientSteps(problem: Problem): StepGroup[] {
  const n = problem.digits
  const quotient = answerOf(problem)
  let soroban = setValue(emptySoroban(rodsFor(problem)), problem.a)
  const groups: StepGroup[] = []
  for (let p = n - 1; p >= 0; p--) {
    const q = digitAt(quotient, p)
    const place = p + n + 1
    // The quotient's digits placed so far sit above `place`; below it is
    // the remainder.
    const remainder = readValue(soroban) % 10 ** place
    // Its highest place, from its digits rather than log10, whose rounding
    // can land a power of 10 one place low. A remainder of 0 has its head
    // at the ones.
    const head = String(remainder).length - 1
    const lead = Math.floor(remainder / 10 ** Math.max(0, head - n + 1))
    const placed = playDigits(soroban, [[q, place]], 'add')
    soroban = placed.soroban
    groups.push({ kind: 'quotient', q, place, lead, split: place - head === 2, ...movesGroup(placed.moves) })
    // Nothing is multiplied by a 0, so there is no 九九 to take off.
    if (q === 0) continue
    for (let j = n - 1; j >= 0; j--) {
      const y = digitAt(problem.b, j)
      const taken = playDigits(soroban, productDigits(q * y, p + j), 'sub')
      soroban = taken.soroban
      groups.push({ kind: 'subtract', q, y, yPlace: j, place: p + j, ...movesGroup(taken.moves) })
    }
  }
  return groups
}

export function problemSteps(problem: Problem): StepGroup[] {
  const op = problem.op
  switch (op) {
    case 'mul':
      return productSteps(problem)
    case 'div':
      return quotientSteps(problem)
    default:
      return columnSteps(problem, op)
  }
}

// The soroban at the start, then after each step, for replaying the problem.
export function problemStates(problem: Problem): Soroban[] {
  let current = setValue(emptySoroban(rodsFor(problem)), startOf(problem))
  const states = [current]
  for (const group of problemSteps(problem)) {
    for (const step of group.steps) {
      current = applyPlacedStep(current, step)
      states.push(current)
    }
  }
  return states
}

// Which group (an index into `groups`) the replay's step `stepIndex`
// belongs to, counting steps from 0 across all groups.
export function groupOfStep(groups: StepGroup[], stepIndex: number): number | undefined {
  let remaining = stepIndex
  for (let index = 0; index < groups.length; index++) {
    const count = groups[index]?.steps.length ?? 0
    if (remaining < count) return index
    remaining -= count
  }
  return undefined
}

// Spec (multiplication) §3: each digit's move, which the app already
// calibrates to the learner, plus recalling each 九九, plus typing the answer.
// Spec (division) §2: a ÷ problem's 九九 are recalled the same way, and
// each quotient digit placed is estimated first. A 0 digit is not: the
// remainder is too small for a digit to land there, which estimating the
// next digit already shows.
export function problemTargetMs(problem: Problem, calibrationMs: number): number {
  let total = TYPING_ALLOWANCE_MS * String(answerOf(problem)).length
  for (const group of problemSteps(problem)) {
    const atoms = group.kind === 'column' ? (group.atom === null ? [] : [group.atom]) : group.moves.map((m) => m.atom)
    for (const atom of atoms) total += latencyTargetMs(classify(atom), calibrationMs)
    if (group.kind === 'product' || group.kind === 'subtract') total += MULTIPLY_RECALL_MS
    if (group.kind === 'quotient' && group.q > 0) total += DIVIDE_ESTIMATE_MS
  }
  return total
}
