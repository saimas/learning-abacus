import { atomId, classify, decompose, type Atom, type Direction } from './atoms'
import { latencyTargetMs } from './fluency'
import { emptySoroban, readRod, rodFor, setValue, type Soroban } from './soroban'

// Spec (multi-digit ＋ − and ×) §3: practice of two numbers of the same
// size, chosen as an operation and a digit count.
export type Operation = 'add' | 'sub' | 'mul'
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`
export type Problem = { op: Operation; digits: Digits; a: number; b: number }

export const OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul']
export const DIGITS: readonly Digits[] = [1, 2, 3]
export const PRACTICE_KINDS: readonly PracticeKind[] = OPERATIONS.flatMap((op) =>
  DIGITS.map((digits) => ({ op, digits })),
)

// The same in every language, so it lives with the operations rather than
// in the string catalogues.
export const OPERATION_SYMBOL: Record<Operation, string> = { add: '＋', sub: '−', mul: '×' }

export const ROUND_LENGTH = 10
// Typing the answer costs time the arithmetic does not, and a 4-digit answer
// costs more of it than a 2-digit one. A first estimate, like the per-move
// targets it is added to.
export const TYPING_ALLOWANCE_MS = 400

// Recalling a 九九 is part of the work a × answer takes that no bead move
// measures. A first estimate, like the per-move targets.
export const MULTIPLY_RECALL_MS = 600

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
  return problem.op === 'add' ? problem.a + problem.b : problem.op === 'sub' ? problem.a - problem.b : problem.a * problem.b
}

// ＋ and − keep one rod beyond the operands for the last carry (999 + 999 =
// 1998). A product of two N-digit numbers can have 2N digits (99 × 99 =
// 9801), and 両落とし puts only the product on the soroban.
export function rodsFor(kind: { op: Operation; digits: Digits }): number {
  return kind.op === 'mul' ? kind.digits * 2 : kind.digits + 1
}

// What the soroban shows before the first step: a for ＋ −, nothing for ×.
export function startOf(problem: Problem): number {
  return problem.op === 'mul' ? 0 : problem.a
}

function randomInt(random: () => number, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1))
}

// Uniform over the allowed pairs. A subtraction draws two numbers and puts
// the larger first, which is still uniform over pairs with a > b; equal
// numbers are drawn again, since 0 teaches nothing and reads as a blank
// soroban.
export function generateProblems(kind: PracticeKind, count: number, random: () => number): Problem[] {
  // × 1 teaches nothing (anything × 1 is itself), so 1×1 draws from 2..9
  // instead of the usual single-digit range of 1..9, leaving out × 1.
  const low = kind.op === 'mul' && kind.digits === 1 ? 2 : 10 ** (kind.digits - 1)
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

// One digit put on the soroban: the single move it is (one of the 180
// atoms), where it goes, and the bead steps that make it.
export type Move = { place: number; atom: Atom; steps: PlacedStep[]; cascades: boolean }

// What the learner works as one unit, and what one line of the answer card
// explains: a column of a ＋ − problem, or one 九九 of a × problem. `steps`
// is every bead step of the group in order; `cascades` says whether any
// carry in it had to ripple on. A 九九's `xPlace` and `yPlace` are the places
// (0 = ones) its digits `x` and `y` come from in a and b, so the operand
// board can point at the two digits being multiplied.
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

// Spec (multiplication) §3: 両落とし from the top. Neither number is set on
// the soroban; the multiplicand's digits are taken from the highest, each
// times the multiplier's digits from the highest, and each 九九 is added as
// its tens digit then its ones digit. The ones digit's place is the two
// digits' places added together. A digit of 0 is not a move, but the 九九 is
// still a step the learner takes, so it keeps its group.
function productSteps(problem: Problem): StepGroup[] {
  let soroban = emptySoroban(rodsFor(problem))
  const rods = soroban.rods.length
  const groups: StepGroup[] = []
  for (let i = problem.digits - 1; i >= 0; i--) {
    for (let j = problem.digits - 1; j >= 0; j--) {
      const x = digitAt(problem.a, i)
      const y = digitAt(problem.b, j)
      const place = i + j
      const moves: Move[] = []
      for (const [digit, at] of [
        [Math.floor((x * y) / 10), place + 1],
        [(x * y) % 10, place],
      ] as const) {
        if (digit === 0) continue
        const index = rods - 1 - at
        const rod = soroban.rods[index]
        if (rod === undefined) throw new Error(`no rod at index ${index}`)
        const atom = atomFor(readRod(rod), digit, 'add')
        const move = placeMove(soroban, index, atom)
        soroban = move.soroban
        moves.push({ place: at, atom, steps: move.steps, cascades: move.cascades })
      }
      groups.push({
        kind: 'product',
        x,
        y,
        xPlace: i,
        yPlace: j,
        place,
        moves,
        steps: moves.flatMap((move) => move.steps),
        cascades: moves.some((move) => move.cascades),
      })
    }
  }
  return groups
}

export function problemSteps(problem: Problem): StepGroup[] {
  const op = problem.op
  return op === 'mul' ? productSteps(problem) : columnSteps(problem, op)
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
export function problemTargetMs(problem: Problem, calibrationMs: number): number {
  let total = TYPING_ALLOWANCE_MS * String(answerOf(problem)).length
  for (const group of problemSteps(problem)) {
    const atoms = group.kind === 'column' ? (group.atom === null ? [] : [group.atom]) : group.moves.map((m) => m.atom)
    for (const atom of atoms) total += latencyTargetMs(classify(atom), calibrationMs)
    if (group.kind === 'product') total += MULTIPLY_RECALL_MS
  }
  return total
}
