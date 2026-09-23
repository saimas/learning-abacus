import { atomId, classify, decompose, type Atom } from './atoms'
import { latencyTargetMs } from './fluency'
import { emptySoroban, readRod, rodFor, setValue, type Soroban } from './soroban'

// Spec (multi-digit ＋ −) §3: practice of two numbers of the same size,
// chosen as an operation and a digit count.
export type Operation = 'add' | 'sub'
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`
export type Problem = { op: Operation; digits: Digits; a: number; b: number }

export const OPERATIONS: readonly Operation[] = ['add', 'sub']
export const DIGITS: readonly Digits[] = [1, 2, 3]
export const PRACTICE_KINDS: readonly PracticeKind[] = OPERATIONS.flatMap((op) =>
  DIGITS.map((digits) => ({ op, digits })),
)

export const ROUND_LENGTH = 10
// Typing the answer costs time the arithmetic does not, and a 4-digit answer
// costs more of it than a 2-digit one. A first estimate, like the per-move
// targets it is added to.
export const TYPING_ALLOWANCE_MS = 400

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
  return problem.op === 'add' ? problem.a + problem.b : problem.a - problem.b
}

// One rod beyond the operands takes the last carry: 999 + 999 = 1998.
export function rodsFor(digits: Digits): number {
  return digits + 1
}

function randomInt(random: () => number, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1))
}

// Uniform over the allowed pairs. A subtraction draws two numbers and puts
// the larger first, which is still uniform over pairs with a > b; equal
// numbers are drawn again, since 0 teaches nothing and reads as a blank
// soroban.
export function generateProblems(kind: PracticeKind, count: number, random: () => number): Problem[] {
  const low = 10 ** (kind.digits - 1)
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

// One column of the problem as the learner works it: the single move it is
// (one of the 180 atoms), and the bead steps that make it.
export type ColumnStep = {
  place: number
  atom: Atom | null
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

function atomFor(rodValue: number, operand: number, op: Operation): Atom {
  return { id: atomId(rodValue, operand, op), rodValue, operand, direction: op }
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
export function problemSteps(problem: Problem): ColumnStep[] {
  const rods = rodsFor(problem.digits)
  let soroban = setValue(emptySoroban(rods), problem.a)
  const columns: ColumnStep[] = []
  for (let place = problem.digits - 1; place >= 0; place--) {
    const digit = digitAt(problem.b, place)
    if (digit === 0) {
      columns.push({ place, atom: null, steps: [], cascades: false })
      continue
    }
    const index = rods - 1 - place
    const rod = soroban.rods[index]
    if (rod === undefined) throw new Error(`no rod at index ${index}`)
    const atom = atomFor(readRod(rod), digit, problem.op)
    const move = placeMove(soroban, index, atom)
    soroban = move.soroban
    columns.push({ place, atom, steps: move.steps, cascades: move.cascades })
  }
  return columns
}

// The soroban at the start, then after each step, for replaying the problem.
export function problemStates(problem: Problem): Soroban[] {
  let current = setValue(emptySoroban(rodsFor(problem.digits)), problem.a)
  const states = [current]
  for (const column of problemSteps(problem)) {
    for (const step of column.steps) {
      current = applyPlacedStep(current, step)
      states.push(current)
    }
  }
  return states
}

// Which column (an index into `columns`) the replay's step `stepIndex`
// belongs to, counting steps from 0 across all columns.
export function columnOfStep(columns: ColumnStep[], stepIndex: number): number | undefined {
  let remaining = stepIndex
  for (let index = 0; index < columns.length; index++) {
    const count = columns[index]?.steps.length ?? 0
    if (remaining < count) return index
    remaining -= count
  }
  return undefined
}

// Spec §4: the time a fluent learner needs is the time for each column's
// move, which the app already calibrates to them, plus typing the answer.
export function problemTargetMs(problem: Problem, calibrationMs: number): number {
  const moves = problemSteps(problem).reduce(
    (sum, column) => (column.atom === null ? sum : sum + latencyTargetMs(classify(column.atom), calibrationMs)),
    0,
  )
  return moves + TYPING_ALLOWANCE_MS * String(answerOf(problem)).length
}
