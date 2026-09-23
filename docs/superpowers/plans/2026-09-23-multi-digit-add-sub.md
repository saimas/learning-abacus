# Multi-digit ＋ and − Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Practise addition and subtraction of two 1-, 2- or 3-digit numbers on the soroban, in rounds of 10, chosen from the chooser sheet, with per-kind fade records shown on the progress screen.

**Architecture:** A pure `problem.ts` domain unit generates problems and decomposes them column by column from the left, reusing `decompose`. A shared `Exercise` feeds a `QuestionView` extracted from `SessionRunner`; a new `RoundRunner` plays 10 problems through it. Records are one `PracticeRecord` per practice kind in `Progress.practices`.

**Tech Stack:** Expo 57 / React Native 0.86, expo-router (typed routes), TypeScript 6, Jest 30 + @testing-library/react-native, Maestro for simulator checks.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-digit-add-sub-design.md`

## Global Constraints

- `src/domain/**` stays pure: no imports from react, react-native, expo, `@/ui`, `@/storage`, `@/i18n` (`src/domain/purity.test.ts` enforces it).
- No schema bump: `SCHEMA_VERSION` stays 1; `practices` is added the way `highestStage` was.
- Single-move practice must not change: `SessionRunner`'s existing tests (`SessionRunner.test.tsx`, `SessionRunner.integration.test.tsx`, `__tests__/session-screen.test.tsx`) pass with no edits to what they assert.
- Every new string goes in both `src/i18n/ja.ts` and `src/i18n/en.ts` with the same arity (`src/i18n/catalogs.test.ts`).
- Japanese copy uses the app's existing register: kanji 練習, 問, 正解; place names 一の位, 十の位, 百の位, 千の位. Minus in displayed arithmetic is U+2212 (−).
- A round is `ROUND_LENGTH = 10` problems. `TYPING_ALLOWANCE_MS = 400`.
- Rod count for a problem is `digits + 1`.
- Comments explain *why*, in full sentences, as in the surrounding code. Match the existing comment density.
- Checks before every commit: `npx jest <files>`; before finishing a task: `npm test`, `npm run typecheck`, `npm run lint`.
- `npm run typecheck` needs expo-router's generated route types. After adding `app/round.tsx` (Task 4), regenerate them by running `npx expo start --offline` in the background, waiting until `.expo/types/router.d.ts` mentions `/round`, then stopping it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Problems (`src/domain/problem.ts`)

**Files:**
- Create: `src/domain/problem.ts`
- Test: `src/domain/problem.test.ts`

**Interfaces:**
- Consumes: `decompose`, `classify`, `atomId`, `type Atom` from `./atoms`; `latencyTargetMs` from `./fluency`; `emptySoroban`, `readRod`, `rodFor`, `setValue`, `type Soroban` from `./soroban`.
- Produces:
  - `type Operation = 'add' | 'sub'`, `type Digits = 1 | 2 | 3`, `type PracticeKind = { op: Operation; digits: Digits }`, ``type PracticeId = `${Operation}:${Digits}` ``, `type Problem = { op: Operation; digits: Digits; a: number; b: number }`
  - `OPERATIONS`, `DIGITS`, `PRACTICE_KINDS`, `ROUND_LENGTH = 10`, `TYPING_ALLOWANCE_MS = 400`
  - `practiceId(kind): PracticeId`, `parsePracticeId(value: unknown): PracticeKind | null`, `isPracticeId(value: unknown): value is PracticeId`
  - `answerOf(p): number`, `rodsFor(digits): number`
  - `generateProblems(kind, count, random: () => number): Problem[]`
  - `type PlacedStep = { rodIndex: number; delta: number }`, `type ColumnStep = { place: number; atom: Atom | null; steps: PlacedStep[]; cascades: boolean }`
  - `applyPlacedStep(s, step): Soroban`, `problemSteps(p): ColumnStep[]`, `problemStates(p): Soroban[]`, `columnOfStep(columns, stepIndex): number | undefined`, `problemTargetMs(p, calibrationMs): number`

- [ ] **Step 1: Write the failing tests**

`src/domain/problem.test.ts`:

```ts
import { atomId, classify } from './atoms'
import { latencyTargetMs } from './fluency'
import {
  answerOf,
  applyPlacedStep,
  columnOfStep,
  generateProblems,
  isPracticeId,
  parsePracticeId,
  PRACTICE_KINDS,
  practiceId,
  problemStates,
  problemSteps,
  problemTargetMs,
  rodsFor,
  TYPING_ALLOWANCE_MS,
  type Digits,
  type Operation,
  type Problem,
} from './problem'
import { readRod, readValue } from './soroban'

// A small seeded generator (mulberry32), so generation tests are repeatable.
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function problem(op: Operation, a: number, b: number): Problem {
  return { op, digits: String(a).length as Digits, a, b }
}

// Every rod stays on the soroban at every step, and the last state reads the answer.
function expectReplaysTo(p: Problem) {
  const states = problemStates(p)
  for (const state of states) {
    expect(state.rods).toHaveLength(rodsFor(p.digits))
    for (const rod of state.rods) {
      expect(readRod(rod)).toBeGreaterThanOrEqual(0)
      expect(readRod(rod)).toBeLessThanOrEqual(9)
    }
  }
  expect(readValue(states[0]!)).toBe(p.a)
  expect(readValue(states[states.length - 1]!)).toBe(answerOf(p))
}

describe('practice ids', () => {
  it('names the six kinds', () => {
    expect(PRACTICE_KINDS.map(practiceId)).toEqual(['add:1', 'add:2', 'add:3', 'sub:1', 'sub:2', 'sub:3'])
  })

  it('parses only the ids it knows', () => {
    expect(parsePracticeId('sub:2')).toEqual({ op: 'sub', digits: 2 })
    expect(parsePracticeId('add:4')).toBeNull()
    expect(parsePracticeId(['add:1'])).toBeNull()
    expect(parsePracticeId(undefined)).toBeNull()
    expect(isPracticeId('add:3')).toBe(true)
    expect(isPracticeId('mul:1')).toBe(false)
  })
})

describe('answerOf and rodsFor', () => {
  it('adds or subtracts', () => {
    expect(answerOf(problem('add', 472, 385))).toBe(857)
    expect(answerOf(problem('sub', 472, 385))).toBe(87)
  })

  it('keeps one rod spare for the carry', () => {
    expect(rodsFor(1)).toBe(2)
    expect(rodsFor(3)).toBe(4)
  })
})

describe('generateProblems', () => {
  it.each(PRACTICE_KINDS)('gives 10 distinct problems of the right size for %o', (kind) => {
    const problems = generateProblems(kind, 10, seeded(7))
    expect(problems).toHaveLength(10)
    expect(new Set(problems.map((p) => `${p.a},${p.b}`)).size).toBe(10)
    for (const p of problems) {
      expect(p.op).toBe(kind.op)
      expect(p.digits).toBe(kind.digits)
      expect(String(p.a)).toHaveLength(kind.digits)
      expect(String(p.b)).toHaveLength(kind.digits)
      if (kind.op === 'sub') expect(p.a).toBeGreaterThan(p.b)
    }
  })

  it('is repeatable for the same seed', () => {
    const kind = { op: 'add', digits: 2 } as const
    expect(generateProblems(kind, 10, seeded(3))).toEqual(generateProblems(kind, 10, seeded(3)))
  })
})

describe('problemSteps', () => {
  it('works from the highest place down', () => {
    const columns = problemSteps(problem('add', 472, 385))
    expect(columns.map((c) => c.place)).toEqual([2, 1, 0])
    expect(columns.map((c) => c.atom?.id)).toEqual([atomId(4, 3, 'add'), atomId(7, 8, 'add'), atomId(2, 5, 'add')])
  })

  it('places a carry on the rod to the left', () => {
    // 7 + 8 on the tens rod (index 2 of 4) is +10 − 2: one bead on the hundreds rod, then −2.
    const tens = problemSteps(problem('add', 472, 385))[1]!
    expect(tens.steps).toEqual([
      { rodIndex: 1, delta: 1 },
      { rodIndex: 2, delta: -2 },
    ])
    expect(tens.cascades).toBe(false)
  })

  it('moves nothing for a 0 digit in b', () => {
    const columns = problemSteps(problem('add', 345, 102))
    expect(columns[1]).toEqual({ place: 1, atom: null, steps: [], cascades: false })
  })

  it('cascades a carry into a 9: 46 + 54', () => {
    const p = problem('add', 46, 54)
    const ones = problemSteps(p)[1]!
    expect(ones.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('cascades a borrow from a 0: 400 − 101', () => {
    const p = problem('sub', 400, 101)
    const ones = problemSteps(p)[2]!
    expect(ones.cascades).toBe(true)
    expectReplaysTo(p)
  })

  it('reaches 1998 from 999 + 999', () => {
    expectReplaysTo(problem('add', 999, 999))
  })

  it('replays every 1- and 2-digit problem to its answer', () => {
    for (const digits of [1, 2] as const) {
      const low = 10 ** (digits - 1)
      const high = 10 ** digits - 1
      for (let a = low; a <= high; a++) {
        for (let b = low; b <= high; b++) {
          expectReplaysTo({ op: 'add', digits, a, b })
          if (a > b) expectReplaysTo({ op: 'sub', digits, a, b })
        }
      }
    }
  })

  it('replays a large sample of 3-digit problems to their answers', () => {
    for (const op of ['add', 'sub'] as const) {
      for (const p of generateProblems({ op, digits: 3 }, 3000, seeded(11))) expectReplaysTo(p)
    }
  })
})

describe('applyPlacedStep', () => {
  it('refuses a step off the rod', () => {
    const [start] = problemStates(problem('add', 9, 1))
    expect(() => applyPlacedStep(start!, { rodIndex: 1, delta: 1 })).toThrow()
  })
})

describe('columnOfStep', () => {
  it('says which column a replayed step belongs to', () => {
    // 472 + 385: hundreds is 2 steps (4 + 3 = +5 − 2), tens is 2 (+10 − 2), ones is 1 (+5).
    const columns = problemSteps(problem('add', 472, 385))
    expect([0, 1, 2, 3, 4].map((i) => columnOfStep(columns, i))).toEqual([0, 0, 1, 1, 2])
    expect(columnOfStep(columns, 5)).toBeUndefined()
  })
})

describe('problemTargetMs', () => {
  it('adds each column move’s target and a typing allowance per answer digit', () => {
    const p = problem('add', 472, 385)
    const moves = problemSteps(p).reduce(
      (sum, c) => (c.atom === null ? sum : sum + latencyTargetMs(classify(c.atom), 900)),
      0,
    )
    expect(problemTargetMs(p, 900)).toBe(moves + 3 * TYPING_ALLOWANCE_MS)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/domain/problem.test.ts`
Expected: FAIL — `Cannot find module './problem'`.

- [ ] **Step 3: Implement `src/domain/problem.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx jest src/domain/problem.test.ts src/domain/purity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/problem.ts src/domain/problem.test.ts
git commit -m "Add multi-digit problems, worked column by column from the left

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Exercise, QuestionView and SessionSummary extracted from SessionRunner

A refactor with no visible change. The runner's per-question UI moves into `QuestionView`, driven by an `Exercise`; the close screen moves into `SessionSummary`. `SessionRunner` keeps its plan logic.

**Files:**
- Create: `src/domain/exercise.ts`, `src/domain/exercise.test.ts`
- Modify: `src/ui/abacus/geometry.ts` (add `beadModeScale`), `src/ui/abacus/geometry.test.ts`
- Create: `src/ui/session/QuestionView.tsx`, `src/ui/session/SessionSummary.tsx`
- Modify: `src/ui/session/SessionRunner.tsx`
- Modify: `src/ui/session/testing.ts` (`setBeads` takes a rod count)
- Test: `src/ui/session/QuestionView.test.tsx`

**Interfaces:**
- Consumes: `answerOf`, `problemStates`, `rodsFor`, `type Problem` from `@/domain/problem` (Task 1).
- Produces:
  - `type Exercise = { rods: number; start: number; expected: number; states: Soroban[] }`, `exerciseForAtom(atom): Exercise`, `exerciseForProblem(problem): Exercise`
  - `beadModeScale(rods: number, width: number): number`
  - `type Submission = { correct: boolean; latencyMs: number | null; t: number }`
  - `QuestionView` props: `{ exercise: Exercise; fade: FadeLevel; coaching: Coaching; prompt: string; demonstration: string | null; renderCorrection: (activeStep: number | undefined) => ReactNode; track: ReactNode; maru: number; shownAt: number; now: () => number; onSubmit: (s: Submission) => void; onMoveOn: (t: number) => void }`. The parent must give it a `key` that changes with every new question, which resets its answer, beads, review and replay.
  - `SessionSummary` props: `{ title: string; answered: number; correct: number; onDone: () => void }`
  - `setBeads(getByTestId, value, rods = 2)` in `src/ui/session/testing.ts`

- [ ] **Step 1: Write the failing domain and geometry tests**

`src/domain/exercise.test.ts`:

```ts
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
})
```

Append to `src/ui/abacus/geometry.test.ts` (add `beadModeScale` and `BEAD_MODE_SCALE` to its imports):

```ts
describe('beadModeScale', () => {
  it('keeps the full bead-mode size when the rods fit', () => {
    expect(beadModeScale(2, 335)).toBe(BEAD_MODE_SCALE)
    expect(beadModeScale(3, 335)).toBe(BEAD_MODE_SCALE)
  })

  it('shrinks four rods to fit a 375 pt phone', () => {
    // 4 rods × 64 + 2 × (6 + 10) of deck and frame padding = 288 pt at scale 1.
    expect(beadModeScale(4, 335)).toBeCloseTo(335 / 288)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/domain/exercise.test.ts src/ui/abacus/geometry.test.ts`
Expected: FAIL — `Cannot find module './exercise'`, `beadModeScale is not a function`.

- [ ] **Step 3: Implement `exercise.ts` and `beadModeScale`**

`src/domain/exercise.ts`:

```ts
import { expectedValue, moveStates, startValue, type Atom } from './atoms'
import { answerOf, problemStates, rodsFor, type Problem } from './problem'
import type { Soroban } from './soroban'

// Spec (multi-digit ＋ −) §4: what one question puts on the soroban, whether
// it is a single move or a whole problem. The words that go with it (the
// prompt, the correction) are the i18n catalogues' business.
export type Exercise = {
  rods: number
  start: number
  expected: number
  // The soroban at the start, then after each step, for the replay.
  states: Soroban[]
}

export function exerciseForAtom(atom: Atom): Exercise {
  return { rods: 2, start: startValue(atom), expected: expectedValue(atom), states: moveStates(atom) }
}

export function exerciseForProblem(problem: Problem): Exercise {
  return {
    rods: rodsFor(problem.digits),
    start: problem.a,
    expected: answerOf(problem),
    states: problemStates(problem),
  }
}
```

In `src/ui/abacus/geometry.ts`, after `BEAD_MODE_SCALE`:

```ts
// Bead mode draws the soroban as large as BEAD_MODE_SCALE allows, but a
// 3-digit problem's four rods at that size are wider than a 375 pt phone.
// `width` is the room the soroban has; the frame is its rods plus the deck's
// and the frame's padding on each side.
export function beadModeScale(rods: number, width: number): number {
  const natural = rods * ROD_WIDTH + 2 * (DECK_PADDING + FRAME_PADDING)
  return Math.min(BEAD_MODE_SCALE, width / natural)
}
```

Run: `npx jest src/domain/exercise.test.ts src/ui/abacus/geometry.test.ts` — Expected: PASS.

- [ ] **Step 4: Generalise the test helper**

In `src/ui/session/testing.ts`, replace `setBeads` with:

```ts
// Sets the session soroban to `value` through each rod's VoiceOver adjust
// action: the same state change a tap makes, without aiming at pixels.
// `rods` is the soroban's rod count: 2 for a single move, digits + 1 for a
// problem. Test-only; imported by the session tests, never by app code.
export function setBeads(getByTestId: GetByTestId, value: number, rods = 2) {
  const digits = String(value).padStart(rods, '0').split('').map(Number)
  digits.forEach((digit, rodIndex) => {
    const shown = () => Number(getByTestId(`rod-${rodIndex}`).props.accessibilityValue.text)
    const adjust = (actionName: string) =>
      fireEvent(getByTestId(`rod-${rodIndex}`), 'accessibilityAction', { nativeEvent: { actionName } })
    for (let step = 0; step < 10 && shown() < digit; step++) adjust('increment')
    for (let step = 0; step < 10 && shown() > digit; step++) adjust('decrement')
  })
}
```

- [ ] **Step 5: Create `SessionSummary.tsx`**

Move the close screen out of `SessionRunner` unchanged, with its title as a prop. The testIDs stay the same.

```tsx
import { StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Button } from '@/ui/kit/Button'
import { Seal } from '@/ui/kit/Seal'
import { colors, fonts, fontSizes } from '@/ui/theme'

// The close screen: the stamped seal, what was answered, and おわる. Shared by
// the daily session and a round of problems, which differ only in the title.
export function SessionSummary({
  title,
  answered,
  correct,
  onDone,
}: {
  title: string
  answered: number
  correct: number
  onDone: () => void
}) {
  const strings = useStrings()
  return (
    <View testID="session-summary" style={styles.summary}>
      <View style={styles.summaryBody}>
        <Seal text={strings.sealDone} state="stamped" size={118} animateIn />
        <Text testID="summary-text" style={styles.summaryTitle}>
          {title}
        </Text>
        {/* Spec §6: the close block reports the result. Atoms mastered and
            tomorrow's preview still belong here and are not built yet. */}
        <Text testID="summary-result" style={styles.summaryResult}>
          {strings.sessionResult(answered, correct)}
        </Text>
      </View>
      <Button testID="finish-button" label={strings.done} onPress={onDone} />
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { flex: 1 },
  summaryBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: {
    marginTop: 26,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 2,
    color: colors.ink,
  },
  summaryResult: { marginTop: space.sm, fontSize: fontSizes.body, color: colors.muted },
})
```

(and import `space` from `@/ui/theme` alongside the other tokens.)

- [ ] **Step 6: Create `QuestionView.tsx`**

Move everything about one question out of `SessionRunner`: the `answer`, `review`, `beads` state, `useMoveReplay`, `missedAt`, `NEXT_GUARD_MS`, `submit`'s scoring, `showAnswer`, `moveOn`, the stamp, the review buttons, both layouts, and their styles. Keep every testID, comment and style value exactly as it is in `SessionRunner.tsx` today. What changes:

```tsx
import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { Exercise } from '@/domain/exercise'
import { answerModeForFade, type Coaching, type FadeLevel } from '@/domain/fade'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { beadModeScale } from '@/ui/abacus/geometry'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { Button } from '@/ui/kit/Button'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { Batsu } from './Batsu'
import { Maru } from './Maru'
import { useMoveReplay } from './useMoveReplay'

// latencyMs is null for an untimed attempt (answered with the beads). `t` is
// the moment of the answer, which the runner uses as the next question's
// start and to check its deadline.
export type Submission = { correct: boolean; latencyMs: number | null; t: number }

// A missed question held on screen until つぎへ: only whether its answer card
// is up needs keeping — up at once where coaching still speaks (F0–F1), and
// after こたえを見る at silent levels.
type Review = { cardShown: boolean }

// A tap on つぎへ this soon after a miss is the second half of a double tap
// on こたえる, which sits in the same place. It must not skip a review the
// learner has not seen yet.
const NEXT_GUARD_MS = 450

// One question, from the prompt to the answer and, after a miss, its review.
// The parent keys it by question, so a new question starts with a clean
// field, untouched beads and no review. The parent decides what the answer
// means for the session (onSubmit) and when to move on (onMoveOn, after a
// miss's review).
export function QuestionView({
  exercise,
  fade,
  coaching,
  prompt,
  demonstration,
  renderCorrection,
  track,
  maru,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
}: {
  exercise: Exercise
  fade: FadeLevel
  coaching: Coaching
  prompt: string
  // Said before the answer at F0 (spec §4). Null where there is nothing to
  // demonstrate, as for a whole problem.
  demonstration: string | null
  // The answer card under review. `activeStep` is the step a replay has just
  // played, counted from 0, or undefined before it has played one.
  renderCorrection: (activeStep: number | undefined) => ReactNode
  track: ReactNode
  // Counts correct answers, so each one remounts the 〇 and replays its fade.
  // 0 means the last answer was wrong, or there has not been one.
  maru: number
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: (t: number) => void
}) {
  const strings = useStrings()
  const { width } = useWindowDimensions()
  const [answer, setAnswer] = useState('')
  // Non-null while a missed question is held on screen for review.
  const [review, setReview] = useState<Review | null>(null)
  // こたえを見る's step-by-step replay of the move, on the same soroban.
  const replay = useMoveReplay()
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  // When this question was missed, for NEXT_GUARD_MS.
  const missedAt = useRef<number | null>(null)

  const mode = answerModeForFade(fade)
  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn one of the atom's attempts.
  const moved = readValue(shownBeads) !== exercise.start
  // The screen's gutters are space.xl on each side (Screen).
  const beadScale = beadModeScale(exercise.rods, width - 2 * space.xl)

  // Scores the answer. A right one is the parent's to move on from; a miss
  // holds the question here for review until つぎへ.
  function submit() {
    // A blank or unparseable field is not an answer. Scoring it would mark
    // every n−n atom correct, and scoring it wrong would burn an attempt for
    // a mistap, so nothing happens at all.
    const given = mode === 'beads' ? (moved ? readValue(shownBeads) : null) : parseAnswer(answer)
    if (given === null) return

    const t = now()
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt)
    const correct = given === exercise.expected

    if (correct) {
      AccessibilityInfo.announceForAccessibility(strings.correct)
    } else {
      missedAt.current = t
      AccessibilityInfo.announceForAccessibility(strings.wrong)
      // The number alone teaches nothing. Where coaching still speaks, the
      // card with the substitution comes up with the ✕; at silent levels it
      // waits to be asked for.
      setReview({ cardShown: coaching !== 'silent' })
    }
    onSubmit({ correct, latencyMs, t })
  }

  function showAnswer() {
    AccessibilityInfo.announceForAccessibility(strings.correctionAnswer(exercise.expected))
    setReview({ cardShown: true })
    replay.play(exercise.states)
  }

  function moveOn() {
    const t = now()
    if (missedAt.current !== null && t - missedAt.current < NEXT_GUARD_MS) return
    onMoveOn(t)
  }

  // ...the rest is SessionRunner's rendering, moved as it is, with these
  // substitutions:
  //   strings.prompt(atom)                  → prompt
  //   the demonstration's strings.coaching(atom), shown when
  //     current.coaching === 'demo' && review === null
  //                                         → demonstration, shown when
  //     demonstration !== null && review === null
  //   <CorrectionCard atom={atom} expected={expected} activeStep={…} />
  //                                         → renderCorrection(played === null ? undefined : played - 1)
  //   decompose(atom).length                → exercise.states.length - 1
  //   current.fade                          → fade
  //   scale={BEAD_MODE_SCALE}               → scale={beadScale}
  //   the local `track` element             → track (the prop)
}
```

Write out the rest in full — do not leave the comment above in the file. After this step `QuestionView.tsx` contains the `demonstration`, `played`, `correctionCard`, `replayStep`, `replayFade`, `stamp`, `reviewButtons` constants and both `return` branches (bead mode and keypad mode) from `SessionRunner.tsx`, plus the styles they use: `practice`, `soroban`, `prompt`, `demonstration`, `scroll`, `scrollContent`, `sorobanWrap`, `stampOverlay`, `hint`, `beadSpacer`, `buttonRow`, `resetSlot`, `submitSlot`, `reviewSlot`.

- [ ] **Step 7: Slim `SessionRunner.tsx` down to the plan logic**

- Remove from `SessionRunner`: `answer`, `review`, `beads`, `replay`, `missedAt`, `NEXT_GUARD_MS`, `Review`, `showAnswer`, `moveOn`, the rendering moved in Step 6, and the close screen (now `SessionSummary`), with the styles that went with them. Remove imports that become unused (`AccessibilityInfo`, `ScrollView`, `Text`, `decompose`, `expectedValue`, `moveStates`, `startValue`, `answerModeForFade`, `adjustRod`, `emptySoroban`, `readValue`, `setValue`, `tapSoroban`, `Soroban`, `Abacus`, `BEAD_MODE_SCALE`, `AnswerPad`, `Button`, `Seal`, `parseAnswer`, `Batsu`, `Maru`, `useMoveReplay`, and unused theme tokens).
- Replace the `shownAt` ref with state, since `QuestionView` reads it during render: `const [shownAt, setShownAt] = useState(sessionStartedAt)`, and in `advance`, `setShownAt(t)` where it set `shownAt.current = t`.
- Add `const [question, setQuestion] = useState(0)`. In `advance`, replace the four resets (`setAnswer('')`, `setBeads(null)`, `setReview(null)`, `replay.stop()`) with `setQuestion((previous) => previous + 1)`, with a comment: `// A new key gives the next question a clean field, untouched beads and no review.`
- The `submit` body moves to an `onSubmit` handler that keeps the session's side: 

```tsx
  function submitted({ correct, latencyMs, t }: Submission) {
    if (block === undefined || current === undefined) return
    onAttempt({ atomId: current.atomId, correct, latencyMs })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))
    // Extends the atom's streak on a right answer, breaks it on a wrong one.
    streaks.current[current.atomId] = correct ? (streaks.current[current.atomId] ?? 0) + 1 : 0
    if (correct) {
      setMaru((previous) => previous + 1)
      advance(true, t)
      return
    }
    failures.current[current.atomId] = (failures.current[current.atomId] ?? 0) + 1
    setMaru(0)
  }
```

- The close block renders:

```tsx
  if (block.kind === 'close') {
    return (
      <SessionSummary
        title={strings.sessionComplete}
        answered={tally.answered}
        correct={tally.correct}
        onDone={() => {
          if (finished.current) return
          finished.current = true
          onFinish()
        }}
      />
    )
  }
```

- The question renders:

```tsx
  const exercise = exerciseForAtom(atom)
  return (
    <QuestionView
      key={question}
      exercise={exercise}
      fade={current.fade}
      coaching={current.coaching}
      prompt={strings.prompt(atom)}
      demonstration={current.coaching === 'demo' ? strings.coaching(atom) : null}
      renderCorrection={(activeStep) => (
        <CorrectionCard atom={atom} expected={exercise.expected} activeStep={activeStep} />
      )}
      track={track}
      maru={maru}
      shownAt={shownAt}
      now={now}
      onSubmit={submitted}
      onMoveOn={(t) => advance(false, t)}
    />
  )
```

- The `AttemptResult` type stays exported from `SessionRunner.tsx` (the provider imports it).

- [ ] **Step 8: Run the existing runner tests unchanged**

Run: `npx jest src/ui/session __tests__/session-screen.test.tsx`
Expected: PASS with no edits to any assertion. If a test fails, the extraction changed behaviour: compare the failing path with the original `SessionRunner.tsx` (`git show HEAD:src/ui/session/SessionRunner.tsx`) and fix the extraction, not the test.

- [ ] **Step 9: Test QuestionView with a problem**

`src/ui/session/QuestionView.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { QuestionView } from './QuestionView'
import { setBeads } from './testing'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problem = { op: 'add', digits: 3, a: 472, b: 385 } as const

function renderView(overrides: Partial<Parameters<typeof QuestionView>[0]> = {}) {
  const onSubmit = jest.fn()
  const onMoveOn = jest.fn()
  let clock = 1_000
  render(
    <QuestionView
      exercise={exerciseForProblem(problem)}
      fade={0}
      coaching="demo"
      prompt="472に385をたす。"
      demonstration={null}
      renderCorrection={(activeStep) => <Text testID="card">{String(activeStep)}</Text>}
      track={null}
      maru={0}
      shownAt={0}
      now={() => (clock += 1_000)}
      onSubmit={onSubmit}
      onMoveOn={onMoveOn}
      {...overrides}
    />,
  )
  return { onSubmit, onMoveOn }
}

describe('QuestionView with a 3-digit problem', () => {
  it('shows four rods, starting at a', () => {
    renderView()
    expect(screen.getByTestId('rod-3')).toBeTruthy()
    expect(screen.queryByTestId('rod-4')).toBeNull()
    expect(screen.getByTestId('rod-1').props.accessibilityValue.text).toBe('4')
  })

  it('scores a bead answer untimed', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: null, t: expect.any(Number) })
  })

  it('times a keypad answer from shownAt', () => {
    const { onSubmit } = renderView({ fade: 3, coaching: 'silent' })
    for (const digit of '857') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: 2_000, t: 2_000 })
  })

  it('holds a miss for review, with the card up at a coaching level', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
    expect(screen.getByTestId('card')).toBeTruthy()
    expect(screen.getByTestId('review-next')).toBeTruthy()
  })

  it('replays every step of the problem', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    fireEvent.press(screen.getByTestId('review-show'))
    // 472 + 385 is 5 steps: +5 − 2, +10 − 2, +5.
    jest.advanceTimersByTime(900)
    expect(screen.getByTestId('replay-step').props.children).toBe('1 / 5')
  })
})
```

Run: `npx jest src/ui/session/QuestionView.test.tsx`
Expected: PASS. (`rod-1`'s accessibility value is the digit on the rod; check `Rod.tsx` if the value text differs, and adjust the test's reading, not the component.)

- [ ] **Step 10: Full check and commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

```bash
git add src/domain/exercise.ts src/domain/exercise.test.ts src/ui/abacus/geometry.ts src/ui/abacus/geometry.test.ts src/ui/session
git commit -m "Extract QuestionView and SessionSummary from SessionRunner

A question is now an Exercise: rods, start, answer and the soroban at each
step. SessionRunner keeps the plan logic and plays each atom through
QuestionView, with no visible change, so a round of multi-digit problems
can use the same screen.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Practice records

**Files:**
- Create: `src/domain/practice.ts`, `src/domain/practice.test.ts`
- Modify: `src/domain/progress.ts`, `src/domain/progress.test.ts`
- Modify: `src/storage/progressStore.ts`, `src/storage/progressStore.test.ts`
- Modify: `src/ui/ProgressProvider.tsx`, `src/ui/ProgressProvider.test.tsx`

**Interfaces:**
- Consumes: `type PracticeId`, `isPracticeId` from `@/domain/problem` (Task 1); `nextFadeLevel`, `answerModeForFade`, `MAX_FADE`, `type FadeLevel` from `./fade`.
- Produces:
  - `type PracticeRecord = { fade: FadeLevel; consecutiveCorrect: number; consecutiveWrong: number; lastPractisedAt: number }`
  - `type PracticeAttempt = { id: PracticeId; correct: boolean; pace: number | null }`
  - `newPracticeRecord(now)`, `applyPracticeAttempt(record, correct, pace, now)`, `isPracticeRecord(value): value is PracticeRecord`
  - `Progress.practices: Partial<Record<PracticeId, PracticeRecord>>`
  - `recordPracticeAttempt(progress, id, correct, pace, now): Progress`
  - `useProgress().practise(attempt: PracticeAttempt): void`

- [ ] **Step 1: Write the failing tests**

`src/domain/practice.test.ts`:

```ts
import { applyPracticeAttempt, isPracticeRecord, newPracticeRecord, type PracticeRecord } from './practice'

function at(fade: PracticeRecord['fade'], overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return { ...newPracticeRecord(0), fade, ...overrides }
}

function play(record: PracticeRecord, answers: [boolean, number | null][]): PracticeRecord {
  return answers.reduce((r, [correct, pace], i) => applyPracticeAttempt(r, correct, pace, i), record)
}

describe('applyPracticeAttempt', () => {
  it('promotes after five fast correct answers', () => {
    const record = play(at(3), Array.from({ length: 5 }, () => [true, 0.8] as [boolean, number]))
    expect(record.fade).toBe(4)
    expect(record.consecutiveCorrect).toBe(0)
  })

  it('does not count a slow correct answer toward promotion', () => {
    const record = play(at(3), [[true, 0.8], [true, 0.8], [true, 1.2], [true, 0.8], [true, 0.8]])
    expect(record.fade).toBe(3)
    expect(record.consecutiveCorrect).toBe(2)
  })

  it('demotes after two misses in a row', () => {
    expect(play(at(4), [[false, 0.5], [false, 0.5]]).fade).toBe(3)
  })

  it('counts an untimed correct answer on accuracy alone at a bead level', () => {
    expect(play(at(0), Array.from({ length: 5 }, () => [true, null] as [boolean, null])).fade).toBe(1)
  })

  it('does not count an untimed answer once the record is past the bead levels', () => {
    expect(play(at(3), [[true, null]]).consecutiveCorrect).toBe(0)
  })

  it('stamps when it was practised', () => {
    expect(applyPracticeAttempt(at(0), true, null, 42).lastPractisedAt).toBe(42)
  })
})

describe('isPracticeRecord', () => {
  it('accepts a record and rejects anything malformed', () => {
    expect(isPracticeRecord(newPracticeRecord(5))).toBe(true)
    expect(isPracticeRecord({ ...newPracticeRecord(5), fade: 9 })).toBe(false)
    expect(isPracticeRecord({ ...newPracticeRecord(5), consecutiveWrong: 'x' })).toBe(false)
    expect(isPracticeRecord(null)).toBe(false)
  })
})
```

Append to `src/domain/progress.test.ts` (import `recordPracticeAttempt`):

```ts
describe('recordPracticeAttempt', () => {
  it('starts a record for the kind and leaves the single moves alone', () => {
    const before = emptyProgress()
    const after = recordPracticeAttempt(before, 'add:2', false, 0.9, 1_000)
    expect(after.practices['add:2']).toEqual({ fade: 0, consecutiveCorrect: 0, consecutiveWrong: 1, lastPractisedAt: 1_000 })
    expect(after.atoms).toBe(before.atoms)
    expect(after.calibrationMs).toBe(before.calibrationMs)
    expect(after.highestStage).toBe(before.highestStage)
  })

  it('starts empty', () => {
    expect(emptyProgress().practices).toEqual({})
  })
})
```

Append to `src/storage/progressStore.test.ts`, following the file's existing pattern for writing a raw document to the mocked AsyncStorage before `loadProgress()`:

```ts
describe('practices', () => {
  it('loads a document written before practices existed with none', async () => {
    const { practices: _, ...old } = emptyProgress()
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(old))
    expect((await loadProgress()).practices).toEqual({})
  })

  it('keeps known kinds and drops unknown ids and malformed records', async () => {
    const good = { fade: 2, consecutiveCorrect: 1, consecutiveWrong: 0, lastPractisedAt: 5 }
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...emptyProgress(), practices: { 'add:2': good, 'mul:2': good, 'sub:1': { fade: 'x' } } }),
    )
    expect((await loadProgress()).practices).toEqual({ 'add:2': good })
  })
})
```

In `src/ui/ProgressProvider.test.tsx`, add a test that `practise({ id: 'sub:3', correct: true, pace: null })` creates `progress.practices['sub:3']` and marks the day practised (`daysPracticed` 1), written in the same way as the file's existing `attempt` test.

- [ ] **Step 2: Run to see them fail**

Run: `npx jest src/domain/practice.test.ts src/domain/progress.test.ts src/storage/progressStore.test.ts src/ui/ProgressProvider.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/domain/practice.ts`:

```ts
import { answerModeForFade, MAX_FADE, nextFadeLevel, type FadeLevel } from './fade'
import type { PracticeId } from './problem'

// Spec (multi-digit ＋ −) §5: one record per practice kind. Problems are
// generated fresh every time, so what gets better is "2-digit addition", not
// any one sum. There is no Leitner box or due date: those schedule material,
// and this practice is chosen, not scheduled.
export type PracticeRecord = {
  fade: FadeLevel
  consecutiveCorrect: number
  consecutiveWrong: number
  lastPractisedAt: number
}

// `pace` is the answer's latency over its problem's time target, so answers
// to problems of different difficulty compare; below 1 is fast enough. It is
// null for an untimed answer, one made on the beads.
export type PracticeAttempt = { id: PracticeId; correct: boolean; pace: number | null }

export function newPracticeRecord(now: number): PracticeRecord {
  return { fade: 0, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: now }
}

// The same ladder as a single move's (fluency.applyAttempt): five fast
// correct answers in a row promote one level, two misses demote one, and an
// untimed bead answer counts on accuracy alone only while the record's own
// level is still a bead level.
export function applyPracticeAttempt(
  record: PracticeRecord,
  correct: boolean,
  pace: number | null,
  now: number,
): PracticeRecord {
  const waived = pace === null && answerModeForFade(record.fade) === 'beads'
  const fastEnough = correct && (waived || (pace !== null && pace < 1))
  const consecutiveCorrect = fastEnough ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const fade = nextFadeLevel(record.fade, consecutiveCorrect, consecutiveWrong)
  // A fade change makes the practice a different exercise, so its streaks restart.
  const fadeChanged = fade !== record.fade
  return {
    fade,
    consecutiveCorrect: fadeChanged ? 0 : consecutiveCorrect,
    consecutiveWrong: fadeChanged ? 0 : consecutiveWrong,
    lastPractisedAt: now,
  }
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// For a record read back from storage.
export function isPracticeRecord(value: unknown): value is PracticeRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isCount(record.fade) &&
    record.fade <= MAX_FADE &&
    isCount(record.consecutiveCorrect) &&
    isCount(record.consecutiveWrong) &&
    typeof record.lastPractisedAt === 'number' &&
    Number.isFinite(record.lastPractisedAt)
  )
}
```

`src/domain/progress.ts`:
- Import `newPracticeRecord`, `applyPracticeAttempt`, `type PracticeRecord` from `./practice` and `type PracticeId` from `./problem`.
- Add to `Progress`, after `highestStage`:

```ts
  // Multi-digit practice, one record per kind (spec: multi-digit ＋ − §5).
  // Added without a schema bump, like highestStage.
  practices: Partial<Record<PracticeId, PracticeRecord>>
```

- Add `practices: {}` to `emptyProgress()`.
- Add:

```ts
// A multi-digit answer updates only its own kind's record. It does not
// credit or fault the single moves inside it: a wrong 3-digit sum should
// not punish five atoms (roadmap §7), and calibration stays a measure of
// single moves.
export function recordPracticeAttempt(
  progress: Progress,
  id: PracticeId,
  correct: boolean,
  pace: number | null,
  now: number,
): Progress {
  const existing = progress.practices[id] ?? newPracticeRecord(now)
  return {
    ...progress,
    practices: { ...progress.practices, [id]: applyPracticeAttempt(existing, correct, pace, now) },
  }
}
```

`src/storage/progressStore.ts`: import `isPracticeId` from `@/domain/problem` and `isPracticeRecord` from `@/domain/practice`; add

```ts
// Keeps each record it can trust and drops the rest, rather than discarding
// the learner's whole history over one bad entry.
function asPractices(value: unknown): Progress['practices'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const practices: Progress['practices'] = {}
  for (const [id, record] of Object.entries(value)) {
    if (isPracticeId(id) && isPracticeRecord(record)) practices[id] = record
  }
  return practices
}
```

and in `loadProgress`'s returned object, after `highestStage`:

```ts
      // Added without a schema bump, like highestStage.
      practices: asPractices(candidate.practices),
```

`src/ui/ProgressProvider.tsx`: add `practise: (attempt: PracticeAttempt) => void` to `ProgressApi`, and

```ts
  const practise = useCallback((attempt: PracticeAttempt) => {
    const now = Date.now()
    const withAttempt = recordPracticeAttempt(latest.current, attempt.id, attempt.correct, attempt.pace, now)
    // A round of problems is practice too, so it stamps the day's seal.
    const next = markDayPracticed(withAttempt, dayKey(now))
    latest.current = next
    setProgress(next)
  }, [])
```

and pass `practise` in the context value.

Run `npm run typecheck`. Any hand-built `Progress` literal in a test that now fails for a missing `practices` gets `practices: {}`.

- [ ] **Step 4: Run to see them pass**

Run: `npx jest src/domain src/storage src/ui/ProgressProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full check and commit**

Run: `npm test && npm run typecheck && npm run lint`

```bash
git add src/domain/practice.ts src/domain/practice.test.ts src/domain/progress.ts src/domain/progress.test.ts src/storage src/ui/ProgressProvider.tsx src/ui/ProgressProvider.test.tsx
git commit -m "Record multi-digit practice per kind

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: A round of problems (`RoundRunner`, `/round`)

**Files:**
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`, `src/i18n/catalogs.test.ts`
- Create: `src/ui/round/ProblemCorrectionCard.tsx`, `src/ui/round/ProblemCorrectionCard.test.tsx`
- Create: `src/ui/round/RoundTrack.tsx`
- Create: `src/ui/round/RoundRunner.tsx`, `src/ui/round/RoundRunner.test.tsx`
- Create: `src/ui/session/confirmQuit.ts`; modify `app/session.tsx` to use it
- Create: `app/round.tsx`, `__tests__/round-screen.test.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: Task 1 (`Problem`, `PracticeKind`, `practiceId`, `parsePracticeId`, `generateProblems`, `problemSteps`, `columnOfStep`, `problemTargetMs`, `ROUND_LENGTH`), Task 2 (`exerciseForProblem`, `QuestionView`, `SessionSummary`, `setBeads(…, rods)`), Task 3 (`PracticeAttempt`, `useProgress().practise`).
- Produces:
  - Strings (both catalogues): `rodName(place)` for places 0–3; `problemPrompt(problem)`; `columnLine(place, atom, cascades)`; `roundCount(index, total)`; `roundComplete`; `roundSection`; `opName(op)`; `digitsName(digits)`; `roundName(kind)`; `roundDetail(kind)`; `practiceStageName(stage)`; `practiceCellLabel(kind, stage)`.
  - `RoundRunner` props: `{ kind: PracticeKind; problems: Problem[]; fade: FadeLevel; calibrationMs: number; onAttempt: (a: PracticeAttempt) => void; onFinish: () => void; onQuit?: () => void; now?: () => number }`
  - `confirmQuit(strings: Strings, onStop: () => void): void`
  - Route `/round?kind=<PracticeId>`

- [ ] **Step 1: Strings**

`PracticeStage` is defined in Task 6's `PracticeTable.tsx`; add it now as a type there so the catalogues can import it type-only. Create `src/ui/progress/PracticeTable.tsx` with just:

```ts
// Where a practice kind stands, named for what the learner does at it:
// not tried yet, answering on the beads (F0–F2), answering from faded beads
// (F3–F5), or mental (F6).
export type PracticeStage = 'unseen' | 'beads' | 'fading' | 'mental'
```

In `src/i18n/ja.ts` (import `type Atom` already exists; add `type Digits, type Operation, type PracticeId, type PracticeKind, type Problem, practiceId, ROUND_LENGTH` from `@/domain/problem` and `import type { PracticeStage } from '@/ui/progress/PracticeTable'` with the same "type-only on purpose" comment as `CellState`):

```ts
// A rod's name by its place, 0 being the ones rod. A 3-digit problem's
// soroban has four rods.
const PLACE: readonly string[] = ['一の位', '十の位', '百の位', '千の位']

const OP_NAME: Record<Operation, string> = { add: 'たし算', sub: 'ひき算' }

// One fixed example per kind for the chooser's detail line.
const EXAMPLE: Record<PracticeId, string> = {
  'add:1': '7 + 8',
  'add:2': '23 + 58',
  'add:3': '472 + 385',
  'sub:1': '9 − 4',
  'sub:2': '81 − 36',
  'sub:3': '634 − 258',
}

const PRACTICE_STAGE: Record<PracticeStage, string> = {
  unseen: 'まだ',
  beads: '珠で',
  fading: 'うすい珠',
  mental: '暗算',
}

function roundName(kind: PracticeKind): string {
  return `${kind.digits}けたの${OP_NAME[kind.op]}`
}
```

and in the `ja` object:

```ts
  rodName: (place: number): string => PLACE[place] ?? `${place}`,
  problemPrompt: (problem: Problem) =>
    problem.op === 'add' ? `${problem.a}に${problem.b}をたす。` : `${problem.a}から${problem.b}をひく。`,
  // One line of a problem's answer card: the rod, then the move worked on
  // it, read exactly as a single move's card reads it.
  columnLine: (place: number, atom: Atom, cascades: boolean) =>
    `${PLACE[place] ?? place}　${coaching(atom)}${
      cascades ? (atom.direction === 'add' ? '（さらに上の位へ繰り上がる）' : '（さらに上の位から繰り下がる）') : ''
    }`,
  roundCount: (index: number, total: number) => `${index} / ${total}`,
  roundComplete: 'けたの練習おわり',
  roundSection: 'けたの練習',
  opName: (op: Operation) => OP_NAME[op],
  digitsName: (digits: Digits) => `${digits}けた`,
  roundName,
  roundDetail: (kind: PracticeKind) => `${EXAMPLE[practiceId(kind)]} など・${ROUND_LENGTH}問`,
  practiceStageName: (stage: PracticeStage) => PRACTICE_STAGE[stage],
  practiceCellLabel: (kind: PracticeKind, stage: PracticeStage) => `${roundName(kind)}、${PRACTICE_STAGE[stage]}`,
```

(replacing the existing `rodName`). In `src/i18n/en.ts`, the same keys:

```ts
const PLACE: readonly string[] = ['ones rod', 'tens rod', 'hundreds rod', 'thousands rod']
const PLACE_TITLE: readonly string[] = ['Ones', 'Tens', 'Hundreds', 'Thousands']
const OP_NAME: Record<Operation, string> = { add: 'Addition', sub: 'Subtraction' }
const EXAMPLE: Record<PracticeId, string> = { /* the same six examples as ja */ }
const PRACTICE_STAGE: Record<PracticeStage, string> = {
  unseen: 'not yet',
  beads: 'beads',
  fading: 'fading',
  mental: 'mental',
}
function roundName(kind: PracticeKind): string {
  return `${kind.digits}-digit ${OP_NAME[kind.op].toLowerCase()}`
}
```

```ts
  rodName: (place): string => PLACE[place] ?? `rod ${place}`,
  problemPrompt: (problem) =>
    `The soroban shows ${problem.a}. ${problem.op === 'add' ? 'Add' : 'Subtract'} ${problem.b}.`,
  columnLine: (place, atom, cascades) =>
    `${PLACE_TITLE[place] ?? place}: ${coaching(atom)}${
      cascades ? (atom.direction === 'add' ? ' (the carry moves on a rod)' : ' (the borrow comes from a rod further on)') : ''
    }`,
  roundCount: (index, total) => `${index} / ${total}`,
  roundComplete: 'Practice complete',
  roundSection: 'Bigger numbers',
  opName: (op) => OP_NAME[op],
  digitsName: (digits) => `${digits} ${digits === 1 ? 'digit' : 'digits'}`,
  roundName,
  roundDetail: (kind) => `e.g. ${EXAMPLE[practiceId(kind)]} · ${ROUND_LENGTH} problems`,
  practiceStageName: (stage) => PRACTICE_STAGE[stage],
  practiceCellLabel: (kind, stage) => `${roundName(kind)}, ${PRACTICE_STAGE[stage]}`,
```

Add to `catalogs.test.ts`:

```ts
describe('multi-digit strings', () => {
  it('prompts a problem', () => {
    expect(ja.problemPrompt({ op: 'add', digits: 3, a: 472, b: 385 })).toBe('472に385をたす。')
    expect(ja.problemPrompt({ op: 'sub', digits: 2, a: 81, b: 36 })).toBe('81から36をひく。')
  })

  it('reads a column as its rod and its move', () => {
    expect(ja.columnLine(1, atom(7, 8, 'add'), false)).toBe('十の位　十の繰上：8をたす = +10 − 2')
    expect(ja.columnLine(0, atom(6, 4, 'add'), true)).toBe(
      '一の位　十の繰上と五の分解：4をたす = +10 − 5 − 1（さらに上の位へ繰り上がる）',
    )
  })

  it('names all four rods', () => {
    expect([0, 1, 2, 3].map(ja.rodName)).toEqual(['一の位', '十の位', '百の位', '千の位'])
  })

  it('names a kind and describes it', () => {
    expect(ja.roundName({ op: 'add', digits: 2 })).toBe('2けたのたし算')
    expect(ja.roundDetail({ op: 'add', digits: 2 })).toBe('23 + 58 など・10問')
    expect(en.roundName({ op: 'sub', digits: 3 })).toBe('3-digit subtraction')
  })
})
```

Run: `npx jest src/i18n` — Expected: PASS.

- [ ] **Step 2: ProblemCorrectionCard (test first)**

`src/ui/round/ProblemCorrectionCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { textOf } from '@/ui/session/testing'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'

const colorOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)?.color

describe('ProblemCorrectionCard', () => {
  it('gives the answer, then one line per column that moves, highest place first', () => {
    render(<ProblemCorrectionCard problem={{ op: 'add', digits: 3, a: 345, b: 102 }} expected={447} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 447')
    expect(screen.getByTestId('correction-column-2')).toBeTruthy()
    // b's tens digit is 0: nothing moves on the tens rod, so it has no line.
    expect(screen.queryByTestId('correction-column-1')).toBeNull()
    expect(textOf(screen.getByTestId('correction-column-0'))).toContain('一の位')
  })

  it('highlights the column being replayed', () => {
    render(<ProblemCorrectionCard problem={{ op: 'add', digits: 3, a: 472, b: 385 }} expected={857} activeColumn={1} />)
    expect(colorOf('correction-column-1')).toBe(colors.accent)
    expect(colorOf('correction-column-2')).not.toBe(colors.accent)
  })
})
```

`src/ui/round/ProblemCorrectionCard.tsx`:

```tsx
import { StyleSheet, Text } from 'react-native'
import { problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, space } from '@/ui/theme'

// The answer card for a missed problem: the answer, then how each column is
// worked, highest place first, in the same words as a single move's card.
// `activeColumn` indexes problemSteps(problem): the column a replay is in.
export function ProblemCorrectionCard({
  problem,
  expected,
  activeColumn,
}: {
  problem: Problem
  expected: number
  activeColumn?: number
}) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      {problemSteps(problem).map((column, index) =>
        column.atom === null ? null : (
          <Text
            key={column.place}
            testID={`correction-column-${column.place}`}
            style={[styles.line, index === activeColumn && styles.activeLine]}
          >
            {strings.columnLine(column.place, column.atom, column.cascades)}
          </Text>
        ),
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
```

Run: `npx jest src/ui/round/ProblemCorrectionCard.test.tsx` — Expected: PASS.

- [ ] **Step 3: RoundTrack**

`src/ui/round/RoundTrack.tsx` — the count in place of the time track, with the same quit button:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { colors, fontSizes, space } from '@/ui/theme'

// A round is a count of problems, not a stretch of time: a segment per
// problem, filled once answered, and "3 / 10" for the one on screen.
export function RoundTrack({ index, total, onQuit }: { index: number; total: number; onQuit?: () => void }) {
  const strings = useStrings()
  return (
    <View style={styles.bar}>
      {onQuit !== undefined ? (
        <Pressable
          testID="quit"
          accessibilityRole="button"
          accessibilityLabel={strings.quitLabel}
          onPress={onQuit}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      ) : null}
      <View style={styles.track}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < index && styles.done]} />
        ))}
      </View>
      <Text testID="round-count" style={styles.label}>
        {strings.roundCount(Math.min(index + 1, total), total)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 28 },
  track: { flex: 1, flexDirection: 'row', gap: 3, height: 4 },
  segment: { flex: 1, backgroundColor: colors.track, borderRadius: 2 },
  done: { backgroundColor: colors.accent },
  label: { fontSize: fontSizes.small, color: colors.muted },
})
```

- [ ] **Step 4: RoundRunner (test first)**

`src/ui/round/RoundRunner.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { Problem } from '@/domain/problem'
import { setBeads } from '@/ui/session/testing'
import { RoundRunner } from './RoundRunner'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problems: Problem[] = [
  { op: 'add', digits: 2, a: 23, b: 58 },
  { op: 'add', digits: 2, a: 46, b: 54 },
  { op: 'add', digits: 2, a: 10, b: 11 },
]

function renderRound(overrides: Partial<Parameters<typeof RoundRunner>[0]> = {}) {
  const onAttempt = jest.fn()
  const onFinish = jest.fn()
  let clock = 0
  render(
    <RoundRunner
      kind={{ op: 'add', digits: 2 }}
      problems={problems}
      fade={0}
      calibrationMs={900}
      onAttempt={onAttempt}
      onFinish={onFinish}
      now={() => (clock += 1_000)}
      {...overrides}
    />,
  )
  return { onAttempt, onFinish }
}

function answerBeads(value: number) {
  setBeads(screen.getByTestId, value, 3)
  fireEvent.press(screen.getByTestId('submit'))
}

describe('RoundRunner', () => {
  it('plays the problems in order, counting them', () => {
    renderRound()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    answerBeads(81)
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
  })

  it('records each answer against the kind, untimed on the beads', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'add:2', correct: true, pace: null })
  })

  it('records a keypad answer’s pace against the problem’s target', () => {
    const { onAttempt } = renderRound({ fade: 3 })
    for (const digit of '81') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    const pace = onAttempt.mock.calls[0][0].pace
    expect(pace).toBeGreaterThan(0)
    expect(pace).toBeLessThan(1)
  })

  it('reviews a miss, then moves on without repeating it', () => {
    renderRound()
    answerBeads(80)
    expect(screen.getByTestId('correction')).toBeTruthy()
    jest.advanceTimersByTime(500)
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  it('ends with the summary after the last problem', () => {
    const { onFinish } = renderRound()
    answerBeads(81)
    answerBeads(100)
    answerBeads(21)
    expect(screen.getByTestId('summary-text').props.children).toBe('けたの練習おわり')
    expect(screen.getByTestId('summary-result').props.children).toBe('3問中 3問正解')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
```

(The review test's clock steps 1 000 ms per `now()` call, which is past `NEXT_GUARD_MS`; the `advanceTimersByTime` only lets animations settle.)

`src/ui/round/RoundRunner.tsx`:

```tsx
import { useRef, useState } from 'react'
import { exerciseForProblem } from '@/domain/exercise'
import { coachingForFade, type FadeLevel } from '@/domain/fade'
import type { PracticeAttempt } from '@/domain/practice'
import {
  columnOfStep,
  practiceId,
  problemSteps,
  problemTargetMs,
  type PracticeKind,
  type Problem,
} from '@/domain/problem'
import { useStrings } from '@/i18n'
import { QuestionView, type Submission } from '@/ui/session/QuestionView'
import { SessionSummary } from '@/ui/session/SessionSummary'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'
import { RoundTrack } from './RoundTrack'

// Spec (multi-digit ＋ −) §6: a round is its problems in order, each once. A
// miss is reviewed and the round moves on; it does not come back, since a
// fresh problem of the same kind teaches as much. The fade is the kind's
// level when the round began and holds for the whole round, as a session
// plan holds its items' levels.
export function RoundRunner({
  kind,
  problems,
  fade,
  calibrationMs,
  onAttempt,
  onFinish,
  onQuit,
  now = Date.now,
}: {
  kind: PracticeKind
  problems: Problem[]
  fade: FadeLevel
  calibrationMs: number
  onAttempt: (attempt: PracticeAttempt) => void
  onFinish: () => void
  onQuit?: () => void
  now?: () => number
}) {
  const strings = useStrings()
  const [index, setIndex] = useState(0)
  // When the problem on screen was shown, for its latency. The first is shown
  // when the round mounts.
  const [shownAt, setShownAt] = useState(() => now())
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  // As in SessionRunner: counts right answers so each one replays the 〇.
  const [maru, setMaru] = useState(0)
  const finished = useRef(false)

  const problem = problems[index]
  if (problem === undefined) {
    return (
      <SessionSummary
        title={strings.roundComplete}
        answered={tally.answered}
        correct={tally.correct}
        onDone={() => {
          if (finished.current) return
          finished.current = true
          onFinish()
        }}
      />
    )
  }

  const exercise = exerciseForProblem(problem)
  const columns = problemSteps(problem)

  function next(t: number) {
    setIndex((previous) => previous + 1)
    setShownAt(t)
  }

  function submitted({ correct, latencyMs, t }: Submission) {
    if (problem === undefined) return
    const pace = latencyMs === null ? null : latencyMs / problemTargetMs(problem, calibrationMs)
    onAttempt({ id: practiceId(kind), correct, pace })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))
    if (correct) {
      setMaru((previous) => previous + 1)
      next(t)
    } else {
      setMaru(0)
    }
  }

  return (
    <QuestionView
      key={index}
      exercise={exercise}
      fade={fade}
      coaching={coachingForFade(fade)}
      prompt={strings.problemPrompt(problem)}
      demonstration={null}
      renderCorrection={(activeStep) => (
        <ProblemCorrectionCard
          problem={problem}
          expected={exercise.expected}
          activeColumn={activeStep === undefined ? undefined : columnOfStep(columns, activeStep)}
        />
      )}
      track={<RoundTrack index={index} total={problems.length} onQuit={onQuit} />}
      maru={maru}
      shownAt={shownAt}
      now={now}
      onSubmit={submitted}
      onMoveOn={next}
    />
  )
}
```

Run: `npx jest src/ui/round` — Expected: PASS. (If the pace test fails because `now()` is called a different number of times than assumed, assert only `0 < pace < 1` as written; the 2-digit target is several seconds and the clock moves 1 000 ms per call.)

- [ ] **Step 5: The route**

`src/ui/session/confirmQuit.ts` — moved out of `app/session.tsx` so both routes share it:

```ts
import { Alert } from 'react-native'
import type { Strings } from '@/i18n/ja'

// Leaving mid-practice asks first; the answers so far are already recorded.
export function confirmQuit(strings: Strings, onStop: () => void) {
  Alert.alert(strings.quitTitle, strings.quitBody, [
    { text: strings.quitContinue, style: 'cancel' },
    { text: strings.quitStop, style: 'destructive', onPress: onStop },
  ])
}
```

In `app/session.tsx`, replace its local `confirmQuit` with `onQuit={() => confirmQuit(strings, leave)}` and drop the `Alert` import.

`app/round.tsx`:

```tsx
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text } from 'react-native'
import { generateProblems, isPracticeId, parsePracticeId, ROUND_LENGTH } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { RoundRunner } from '@/ui/round/RoundRunner'
import { confirmQuit } from '@/ui/session/confirmQuit'

// Home is always underneath when the round was started from it. The replace
// covers a cold deep link straight to /round.
function goHome() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function Round() {
  const { progress, hydrated, practise, flush } = useProgress()
  const strings = useStrings()

  // Spec §6: ?kind=add:2. Narrowed to the id string, a primitive, because a
  // repeated param comes back as a new array on every render.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) ? param : null
  const kind = parsePracticeId(id)

  // Drawn once, at mount — the moment the round was chosen.
  const [problems] = useState(() => (kind === null ? [] : generateProblems(kind, ROUND_LENGTH, Math.random)))

  // The kind's level and the learner's calibration, read once progress has
  // loaded and then held for the round, so a promotion earned mid-round does
  // not change the screen under the learner.
  const setup = useMemo(
    () =>
      hydrated && id !== null
        ? { fade: progress.practices[id]?.fade ?? 0, calibrationMs: progress.calibrationMs }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, id],
  )

  if (kind === null) return <Redirect href="/" />

  if (setup === null) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  // Answers are already applied to progress one by one; this only makes
  // sure they are on disk before the screen goes.
  const leave = () => {
    void flush().then(goHome)
  }

  return (
    <Screen>
      <RoundRunner
        kind={kind}
        problems={problems}
        fade={setup.fade}
        calibrationMs={setup.calibrationMs}
        onAttempt={practise}
        onFinish={leave}
        onQuit={() => confirmQuit(strings, leave)}
      />
    </Screen>
  )
}
```

In `app/_layout.tsx`, beside the session's screen:

```tsx
          <Stack.Screen name="round" options={{ gestureEnabled: false }} />
```

Update that comment to say "The session and a round are left only through ✕ …".

Write `__tests__/round-screen.test.tsx` modelled on `__tests__/session-screen.test.tsx` (same mocks for `expo-router` and the provider): with `kind: 'sub:2'` it renders a prompt matching `/^\d{2}から\d{2}をひく。$/` and the count `1 / 10`; with `kind: 'mul:2'` or no kind it redirects to `/`.

- [ ] **Step 6: Regenerate route types, full check, commit**

Run `npx expo start --offline` in the background until `.expo/types/router.d.ts` contains `/round`, then stop it.

Run: `npm test && npm run typecheck && npm run lint`

```bash
git add src/i18n src/ui/round src/ui/session/confirmQuit.ts src/ui/progress/PracticeTable.tsx app/round.tsx app/session.tsx app/_layout.tsx __tests__/round-screen.test.tsx
git commit -m "Play a round of 10 multi-digit problems at /round

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The chooser's けたの練習 section

**Files:**
- Modify: `src/ui/home/PartChooser.tsx`, `src/ui/home/PartChooser.test.tsx`
- Modify: `app/index.tsx`, `__tests__/home.test.tsx`

**Interfaces:**
- Consumes: `OPERATIONS`, `DIGITS`, `practiceId`, `type Operation`, `type Digits`, `type PracticeKind` (Task 1); strings `roundSection`, `opName`, `digitsName`, `roundName`, `roundDetail` (Task 4); `SegmentedControl` from `@/ui/kit/SegmentedControl`.
- Produces: `PartChooser` gains the prop `onChooseRound: (kind: PracticeKind) => void`. testIDs: `round-section`, `round-op-add`, `round-op-sub`, `round-digits-1`…`round-digits-3`, `choose-round`.

- [ ] **Step 1: Failing tests**

Add to `src/ui/home/PartChooser.test.tsx` (render with the new `onChooseRound={jest.fn()}` prop everywhere the file renders `PartChooser`):

```tsx
describe('けたの練習', () => {
  it('starts on 1-digit addition', () => {
    const onChooseRound = jest.fn()
    renderChooser({ onChooseRound })
    expect(textOf(screen.getByTestId('choose-round'))).toContain('1けたのたし算')
    fireEvent.press(screen.getByTestId('choose-round'))
    expect(onChooseRound).toHaveBeenCalledWith({ op: 'add', digits: 1 })
  })

  it('chooses the operation and the size', () => {
    const onChooseRound = jest.fn()
    renderChooser({ onChooseRound })
    fireEvent.press(screen.getByTestId('round-op-sub'))
    fireEvent.press(screen.getByTestId('round-digits-3'))
    expect(textOf(screen.getByTestId('choose-round'))).toContain('3けたのひき算')
    expect(textOf(screen.getByTestId('choose-round'))).toContain('634 − 258 など・10問')
    fireEvent.press(screen.getByTestId('choose-round'))
    expect(onChooseRound).toHaveBeenCalledWith({ op: 'sub', digits: 3 })
  })
})
```

(`renderChooser` is whatever helper the file already uses to render the sheet; if it has none, render `<PartChooser plan={…} visible onChoose={jest.fn()} onChooseRound={onChooseRound} onClose={jest.fn()} />` with the plan the file's other tests use. `textOf` comes from `@/ui/session/testing`.)

Add to `__tests__/home.test.tsx`: opening the chooser and pressing `choose-round` pushes `{ pathname: '/round', params: { kind: 'add:1' } }`, in the same way the file's existing test checks the part rows' `router.push`.

Run: `npx jest src/ui/home __tests__/home.test.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `PartChooser.tsx`:

```tsx
// The size picker's options are strings, as SegmentedControl's are.
const DIGIT_OPTIONS = DIGITS.map(String) as readonly `${Digits}`[]
```

Inside the component:

```tsx
  // Spec (multi-digit ＋ −) §6: what the round row will start. It starts at
  // ＋ 1けた and, since the sheet stays mounted under Home, is remembered for
  // as long as the app runs.
  const [op, setOp] = useState<Operation>('add')
  const [digits, setDigits] = useState<Digits>(1)
  const kind: PracticeKind = { op, digits }
```

and after the part rows, inside the sheet:

```tsx
          <View testID="round-section" style={styles.section}>
            <View style={styles.rule} />
            <Text maxFontSizeMultiplier={1.3} style={styles.sectionTitle}>
              {strings.roundSection}
            </Text>
            <View style={styles.rule} />
          </View>
          <View style={styles.pickers}>
            <SegmentedControl
              options={OPERATIONS}
              value={op}
              onChange={setOp}
              labelFor={(option) => `${option === 'add' ? '＋' : '−'} ${strings.opName(option)}`}
              testIDFor={(option) => `round-op-${option}`}
            />
            <SegmentedControl
              options={DIGIT_OPTIONS}
              value={`${digits}`}
              onChange={(option) => setDigits(Number(option) as Digits)}
              labelFor={(option) => strings.digitsName(Number(option) as Digits)}
              testIDFor={(option) => `round-digits-${option}`}
            />
          </View>
          <Row
            testID="choose-round"
            name={strings.roundName(kind)}
            detail={strings.roundDetail(kind)}
            onPress={() => onChooseRound(kind)}
          />
```

with styles:

```ts
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: colors.cardLine },
  sectionTitle: { fontSize: fontSizes.caption, color: colors.muted },
  pickers: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
```

In `app/index.tsx`:

```tsx
  const chooseRound = (kind: PracticeKind) => {
    // The same guard as choose: a second tap while the sheet fades out must
    // not start a second round.
    if (chooser === null || !chooser.open) return
    closeChooser()
    router.push({ pathname: '/round', params: { kind: practiceId(kind) } })
  }
```

and pass `onChooseRound={chooseRound}` to `PartChooser`.

- [ ] **Step 3: Pass, full check, commit**

Run: `npx jest src/ui/home __tests__/home.test.tsx` — PASS. Then `npm test && npm run typecheck && npm run lint`.

```bash
git add src/ui/home app/index.tsx __tests__/home.test.tsx
git commit -m "Offer multi-digit rounds in the chooser

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The progress screen's けたの練習 table

**Files:**
- Modify: `src/ui/progress/PracticeTable.tsx` (created as a type-only stub in Task 4)
- Create: `src/ui/progress/PracticeTable.test.tsx`
- Modify: `app/progress.tsx`, `__tests__/progress-screen.test.tsx`

**Interfaces:**
- Consumes: `OPERATIONS`, `DIGITS`, `practiceId` (Task 1); `type PracticeRecord` (Task 3); strings `roundSection`, `opName`, `digitsName`, `practiceStageName`, `practiceCellLabel` (Task 4); `cellColors` from `@/ui/theme`.
- Produces: `practiceStage(record: PracticeRecord | undefined): PracticeStage`, `PracticeTable({ progress })`. testIDs `practice-table`, `practice-cell-<id>`.

- [ ] **Step 1: Failing tests**

`src/ui/progress/PracticeTable.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress } from '@/domain/progress'
import { PracticeTable, practiceStage } from './PracticeTable'

describe('practiceStage', () => {
  it('names where a kind stands by its fade level', () => {
    expect(practiceStage(undefined)).toBe('unseen')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 2 })).toBe('beads')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 3 })).toBe('fading')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 6 })).toBe('mental')
  })
})

describe('PracticeTable', () => {
  it('shows a cell per kind, labelled for VoiceOver', () => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-add:2').props.accessibilityLabel).toBe('2けたのたし算、うすい珠')
    expect(screen.getByTestId('practice-cell-sub:3').props.accessibilityLabel).toBe('3けたのひき算、まだ')
  })
})
```

Add to `__tests__/progress-screen.test.tsx`: the screen shows `practice-table`.

Run: `npx jest src/ui/progress __tests__/progress-screen.test.tsx` — Expected: FAIL.

- [ ] **Step 2: Implement**

`src/ui/progress/PracticeTable.tsx` (keep the `PracticeStage` type and its comment from Task 4):

```tsx
import { StyleSheet, Text, View } from 'react-native'
import { MAX_FADE } from '@/domain/fade'
import type { PracticeRecord } from '@/domain/practice'
import { DIGITS, OPERATIONS, practiceId } from '@/domain/problem'
import type { Progress } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { cellColors, colors, fonts, fontSizes, space } from '@/ui/theme'

// Where a practice kind stands, named for what the learner does at it:
// not tried yet, answering on the beads (F0–F2), answering from faded beads
// (F3–F5), or mental (F6).
export type PracticeStage = 'unseen' | 'beads' | 'fading' | 'mental'

export function practiceStage(record: PracticeRecord | undefined): PracticeStage {
  if (record === undefined) return 'unseen'
  if (record.fade >= MAX_FADE) return 'mental'
  if (record.fade >= 3) return 'fading'
  return 'beads'
}

// The atom map's four colours, in the same order of progress.
const STAGE_COLOR: Record<PracticeStage, string> = {
  unseen: cellColors.unseen,
  beads: cellColors.learning,
  fading: cellColors.reflex,
  mental: cellColors.mental,
}

// Spec (multi-digit ＋ −) §6: a row per operation, a column per size.
export function PracticeTable({ progress }: { progress: Progress }) {
  const strings = useStrings()
  return (
    <View testID="practice-table" style={styles.table}>
      <Text style={styles.title}>{strings.roundSection}</Text>
      <View style={styles.row}>
        <View style={styles.head} />
        {DIGITS.map((digits) => (
          <Text key={digits} style={[styles.cellBox, styles.axis]}>
            {strings.digitsName(digits)}
          </Text>
        ))}
      </View>
      {OPERATIONS.map((op) => (
        <View key={op} style={styles.row}>
          <Text style={[styles.head, styles.axis]}>{op === 'add' ? '＋' : '−'}</Text>
          {DIGITS.map((digits) => {
            const kind = { op, digits }
            const stage = practiceStage(progress.practices[practiceId(kind)])
            const dark = stage === 'fading' || stage === 'mental'
            return (
              <View
                key={digits}
                testID={`practice-cell-${practiceId(kind)}`}
                accessible
                accessibilityLabel={strings.practiceCellLabel(kind, stage)}
                style={[styles.cellBox, styles.cell, { backgroundColor: STAGE_COLOR[stage] }]}
              >
                <Text style={[styles.cellText, dark && styles.cellTextDark]}>{strings.practiceStageName(stage)}</Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  table: { marginTop: space.xl, gap: space.xs },
  title: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink, marginBottom: space.xs },
  row: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  head: { width: 24 },
  axis: { fontSize: fontSizes.caption, color: colors.muted, textAlign: 'center' },
  cellBox: { flex: 1 },
  cell: { height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: fontSizes.caption, color: colors.ink },
  cellTextDark: { color: colors.paper },
})
```

In `app/progress.tsx`, after `<AtomGrid progress={progress} />`: `<PracticeTable progress={progress} />`.

- [ ] **Step 3: Pass, full check, commit**

Run: `npm test && npm run typecheck && npm run lint`

```bash
git add src/ui/progress app/progress.tsx __tests__/progress-screen.test.tsx
git commit -m "Show multi-digit practice on the progress screen

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Simulator check, TestFlight build 9, PR (controller, not a subagent)

- [ ] `npm run ios`; with Maestro (`~/.maestro/bin/maestro`), open the chooser, pick − 3けた, start, answer a problem on the beads, and screenshot (`xcrun simctl io booted screenshot`) the 4-rod soroban and a miss review. Check on an iPhone 17 Pro simulator that the 4 rods fit inside the gutters and the beads are comfortably tappable; if not, revisit `beadModeScale` before going further.
- [ ] Finish a round and check the summary; open the progress screen and check the table.
- [ ] Mark the spec's status as implemented; bump `ios.buildNumber` to 9 in `app.json`; commit.
- [ ] Release per `docs/release-ios.md`; wait for the upload to be VALID.
- [ ] Push the branch and open the PR; tell the owner the build number and `! gh pr merge N --merge`.
