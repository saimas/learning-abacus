# learning-abacus Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an offline iOS app that teaches all 180 single-rod soroban atoms to reflex speed and fades the beads away until the learner performs each move mentally.

**Architecture:** A pure TypeScript domain core (`src/domain/`) holds the soroban engine, the generated 180-atom alphabet, the Leitner + latency scheduler, the fade ladder and the session planner — every one a pure function of state, tested without a simulator. A thin React Native layer renders the abacus, with a single `FadeLayer` component owning visibility. Progress lives in AsyncStorage as one versioned document, written at block boundaries.

**Tech Stack:** Expo ~57, React Native 0.86, expo-router, TypeScript (strict), react-native-reanimated, @react-native-async-storage/async-storage, jest-expo, @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-20-learning-abacus-curriculum-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **iOS only, portrait.** No Android or web work in Phase 1.
- **Fully offline.** No network calls at runtime. No backend, no sync, no telemetry.
- **Persistence is AsyncStorage only**, one document under key `learning-abacus/progress/v1`.
- **`src/domain/` is pure.** No imports of `react`, `react-native`, `expo`, `@react-native-async-storage/async-storage`, `../storage`, or `../ui`. Enforced by `src/domain/purity.test.ts` (Task 1).
- **TypeScript strict**, with `noUncheckedIndexedAccess: true` and `noImplicitOverride: true`. Path alias `@/*` → `./src/*`.
- **Code style:** no semicolons, single quotes, 2-space indent — matching `learning-database`.
- **Tests are colocated** as `src/**/name.test.ts` next to the file under test. Screen-level integration tests go in `__tests__/` at the repo root.
- **Session length is exactly 285 seconds of blocks** (45 + 120 + 90 + 30). This is asserted in tests and must not drift.
- **At most 2 new atoms per day** (`NEW_ATOMS_PER_DAY = 2`).
- **Phase 1 scope is stages 0-4 only.** No multiplication, division, multi-rod operation, 検定 mock exams, or 読上算 audio.
- **Verification commands:** `npm test` and `npm run typecheck` must both pass before every commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/soroban.ts` | Rod and soroban state; `readValue`, `setValue`, `applyStep` |
| `src/domain/atoms.ts` | The generated 180-atom alphabet; `classify`, `decompose` |
| `src/domain/curriculum.ts` | Stages 0-4, `atomsForStage`, `isStageUnlocked` |
| `src/domain/fluency.ts` | Leitner boxes, latency targets, `isReflex` |
| `src/domain/fade.ts` | Fade levels, promote/demote, `visualForFade` |
| `src/domain/progress.ts` | The `Progress` aggregate and `recordAttempt` |
| `src/domain/session.ts` | `selectSession` → `SessionPlan` |
| `src/domain/purity.test.ts` | Enforces domain purity |
| `src/storage/progressStore.ts` | AsyncStorage load/save |
| `src/ui/abacus/Bead.tsx`, `Rod.tsx`, `Abacus.tsx` | Bead rendering |
| `src/ui/abacus/FadeLayer.tsx` | The single owner of visibility |
| `src/ui/session/SessionRunner.tsx` | Walks a `SessionPlan`, owns the timer |
| `src/ui/progress/AtomGrid.tsx` | The 180-cell map |
| `app/index.tsx`, `app/progress.tsx`, `app/settings.tsx` | Screens |

---

## Task 1: Project scaffold and purity harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `app.json`, `jest.setup.js`, `eslint.config.js`
- Create: `app/_layout.tsx`, `app/index.tsx`
- Create: `src/domain/purity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a working `npm test` / `npm run typecheck`; the purity guard every later domain task relies on

- [ ] **Step 1: Scaffold the Expo app**

```bash
cd /Users/masashisaito/Documents/workspace/learning-abacus
npx create-expo-app@latest . --template blank-typescript
```

If the directory is non-empty, scaffold into a temp dir and copy in, preserving `LICENSE`, `README.md` and `docs/`.

- [ ] **Step 2: Set package name and scripts**

In `package.json`, set `"name": "learning-abacus"` and ensure:

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "lint": "expo lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "typecheck": "tsc --noEmit"
  },
  "jest": { "preset": "jest-expo" }
}
```

- [ ] **Step 3: Configure TypeScript**

`tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "types": ["jest"],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Write the purity test**

Create `src/domain/purity.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DOMAIN_DIR = join(__dirname)
const FORBIDDEN = [
  'react',
  'react-native',
  '@react-native-async-storage/async-storage',
  'expo',
  '../storage',
  '../ui',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!full.endsWith('.ts') || full.endsWith('.test.ts')) return []
    return [full]
  })
}

describe('domain purity', () => {
  const files = sourceFiles(DOMAIN_DIR)

  it('finds domain source files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports no platform modules', (file) => {
    const source = readFileSync(file, 'utf8')
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
    const violations = imports.filter((spec) =>
      FORBIDDEN.some((banned) => spec === banned || spec.startsWith(`${banned}/`)),
    )
    expect(violations).toEqual([])
  })
})
```

Note: `node:fs` typechecks only because this file is a test and `types: ["jest"]` is set. If `tsc` complains about `node:fs`, add `@types/node` as a devDependency and a `tsconfig.tools.json` that includes only this file, following `learning-database`.

- [ ] **Step 5: Run it and watch it fail**

Run: `npm test -- purity`
Expected: FAIL — "finds domain source files to check" fails because `src/domain/` has no non-test `.ts` files yet.

- [ ] **Step 6: Add a placeholder domain module so the guard has something to guard**

Create `src/domain/soroban.ts` with the single line:

```ts
export const ROD_MAX = 9
```

- [ ] **Step 7: Verify the suite passes**

Run: `npm test && npm run typecheck`
Expected: PASS, both.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app with domain purity guard"
```

---

## Task 2: Soroban engine

**Files:**
- Modify: `src/domain/soroban.ts`
- Test: `src/domain/soroban.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Rod = { heaven: boolean; earth: number }` — `earth` is 0-4
  - `type Soroban = { rods: Rod[] }` — `rods[0]` is the leftmost (highest place)
  - `type RodStep = { rod: 'working' | 'carry'; delta: number }`
  - `emptySoroban(rodCount: number): Soroban`
  - `readRod(rod: Rod): number`
  - `rodFor(value: number): Rod`
  - `readValue(s: Soroban): number`
  - `setValue(s: Soroban, n: number): Soroban`
  - `applyStep(s: Soroban, step: RodStep, workingIndex: number): Soroban`

- [ ] **Step 1: Write the failing test**

Create `src/domain/soroban.test.ts`:

```ts
import { emptySoroban, readRod, readValue, rodFor, setValue, applyStep } from './soroban'

describe('rod', () => {
  it('reads 0 as no beads', () => {
    expect(readRod({ heaven: false, earth: 0 })).toBe(0)
  })

  it('reads the heaven bead as 5', () => {
    expect(readRod({ heaven: true, earth: 0 })).toBe(5)
  })

  it('reads heaven plus three earth as 8', () => {
    expect(readRod({ heaven: true, earth: 3 })).toBe(8)
  })

  it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('round-trips %i', (n) => {
    expect(readRod(rodFor(n))).toBe(n)
  })
})

describe('soroban', () => {
  it('starts empty', () => {
    expect(readValue(emptySoroban(2))).toBe(0)
  })

  it('round-trips a two-digit value', () => {
    expect(readValue(setValue(emptySoroban(2), 47))).toBe(47)
  })

  it('applies a step to the working rod', () => {
    const s = setValue(emptySoroban(2), 3)
    expect(readValue(applyStep(s, { rod: 'working', delta: 5 }, 1))).toBe(8)
  })

  it('applies a carry step to the rod on the left', () => {
    const s = setValue(emptySoroban(2), 7)
    expect(readValue(applyStep(s, { rod: 'carry', delta: 1 }, 1))).toBe(17)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- soroban`
Expected: FAIL — `readRod is not a function`.

- [ ] **Step 3: Implement**

Replace `src/domain/soroban.ts`:

```ts
export const ROD_MAX = 9

export type Rod = { heaven: boolean; earth: number }
export type Soroban = { rods: Rod[] }
export type RodStep = { rod: 'working' | 'carry'; delta: number }

export function readRod(rod: Rod): number {
  return (rod.heaven ? 5 : 0) + rod.earth
}

export function rodFor(value: number): Rod {
  if (value < 0 || value > ROD_MAX) throw new Error(`rod value out of range: ${value}`)
  return { heaven: value >= 5, earth: value % 5 }
}

export function emptySoroban(rodCount: number): Soroban {
  return { rods: Array.from({ length: rodCount }, () => rodFor(0)) }
}

export function readValue(s: Soroban): number {
  return s.rods.reduce((acc, rod) => acc * 10 + readRod(rod), 0)
}

export function setValue(s: Soroban, n: number): Soroban {
  const digits = String(n).padStart(s.rods.length, '0').split('')
  return { rods: digits.map((d) => rodFor(Number(d))) }
}

export function applyStep(s: Soroban, step: RodStep, workingIndex: number): Soroban {
  const index = step.rod === 'working' ? workingIndex : workingIndex - 1
  const target = s.rods[index]
  if (target === undefined) throw new Error(`no rod at index ${index}`)
  const next = readRod(target) + step.delta
  if (next < 0 || next > ROD_MAX) throw new Error(`step leaves rod out of range: ${next}`)
  const rods = [...s.rods]
  rods[index] = rodFor(next)
  return { rods }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- soroban && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/soroban.ts src/domain/soroban.test.ts
git commit -m "feat: add pure soroban bead engine"
```

---

## Task 3: The 180-atom alphabet

This is the correctness heart of the app. The property test in Step 1 validates every complement decomposition at once.

**Files:**
- Create: `src/domain/atoms.ts`
- Test: `src/domain/atoms.test.ts`

**Interfaces:**
- Consumes: `RodStep`, `rodFor`, `readRod`, `applyStep`, `emptySoroban`, `setValue`, `readValue` from `./soroban`
- Produces:
  - `type Direction = 'add' | 'sub'`
  - `type AtomClass = 'direct' | 'five' | 'ten' | 'both'`
  - `type Atom = { id: string; rodValue: number; operand: number; direction: Direction }`
  - `const ATOMS: readonly Atom[]` — exactly 180
  - `atomId(rodValue: number, operand: number, direction: Direction): string`
  - `classify(atom: Atom): AtomClass`
  - `decompose(atom: Atom): RodStep[]`

**Domain rules.** For an addition atom with rod value `v` and operand `n`:
- `v + n <= 9` and `n <= 4 - (v % 5)` → **direct**: `[{working, +n}]`
- `v + n <= 9` but not enough earth beads → **five**: `[{working, +5}, {working, -(5 - n)}]`
- `v + n > 9` and `(v % 5) >= (n % 5)` reachable without the heaven bead → **ten**: `[{carry, +1}, {working, -(10 - n)}]`
- `v + n > 9` and the subtraction of `10 - n` itself needs a 5's complement → **both**: `[{carry, +1}, {working, -5}, {working, +(5 - (10 - n))}]`

Subtraction mirrors this with signs reversed and `carry, -1` for the borrow.

- [ ] **Step 1: Write the failing test**

Create `src/domain/atoms.test.ts`:

```ts
import { ATOMS, atomId, classify, decompose } from './atoms'
import { applyStep, emptySoroban, readValue, setValue } from './soroban'

describe('the alphabet', () => {
  it('contains exactly 180 atoms', () => {
    expect(ATOMS).toHaveLength(180)
  })

  it('has no duplicate ids', () => {
    expect(new Set(ATOMS.map((a) => a.id)).size).toBe(180)
  })

  it('covers every rod value, operand and direction', () => {
    for (let v = 0; v <= 9; v++) {
      for (let n = 1; n <= 9; n++) {
        expect(ATOMS.some((a) => a.rodValue === v && a.operand === n && a.direction === 'add')).toBe(true)
        expect(ATOMS.some((a) => a.rodValue === v && a.operand === n && a.direction === 'sub')).toBe(true)
      }
    }
  })
})

describe('classification', () => {
  it.each([
    [1, 3, 'add', 'direct'],
    [0, 5, 'add', 'direct'],
    [3, 4, 'add', 'five'],
    [7, 8, 'add', 'ten'],
    [7, 6, 'add', 'both'],
  ] as const)('%i %s %i is %s', (v, n, direction, expected) => {
    expect(classify({ id: atomId(v, n, direction), rodValue: v, operand: n, direction })).toBe(expected)
  })
})

describe('decomposition', () => {
  // The property that validates the entire arithmetic core.
  it.each(ATOMS.map((a) => [a.id, a] as const))(
    '%s decomposes to steps that produce the right value',
    (_id, atom) => {
      // Rod 0 is the carry rod, rod 1 the working rod. Start the carry rod at 1
      // so a borrow has somewhere to come from.
      const start = setValue(emptySoroban(2), 10 + atom.rodValue)
      const result = decompose(atom).reduce((s, step) => applyStep(s, step, 1), start)
      const delta = atom.direction === 'add' ? atom.operand : -atom.operand
      expect(readValue(result)).toBe(10 + atom.rodValue + delta)
    },
  )

  it('turns 3+4 into +5 then -1', () => {
    expect(decompose({ id: atomId(3, 4, 'add'), rodValue: 3, operand: 4, direction: 'add' })).toEqual([
      { rod: 'working', delta: 5 },
      { rod: 'working', delta: -1 },
    ])
  })

  it('turns 7+8 into a carry then -2', () => {
    expect(decompose({ id: atomId(7, 8, 'add'), rodValue: 7, operand: 8, direction: 'add' })).toEqual([
      { rod: 'carry', delta: 1 },
      { rod: 'working', delta: -2 },
    ])
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- atoms`
Expected: FAIL — cannot find module `./atoms`.

- [ ] **Step 3: Implement**

Create `src/domain/atoms.ts`:

```ts
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
```

Worked check of the two hardest shapes, to confirm the code above before running it:

- **7+8** — carries, so `+1` on the carry rod, then `decomposeWithinRod(7, 2, -1)`. Earth is 2, room is 2, so a single `-2`. Result `[carry +1, working -2]`: 7 + 10 - 2 = 15. Classifies as `ten`.
- **7+6** — carries, so `+1` on the carry rod, then `decomposeWithinRod(7, 4, -1)`. Earth is 2 but 4 is needed, so the heaven bead moves: `-5` then `+1`. Result `[carry +1, working -5, working +1]`: 7 + 10 - 5 + 1 = 13. Two working steps under a carry, so it classifies as `both`.

If any of the 180 property cases fails, fix the arithmetic — never weaken the test.

- [ ] **Step 4: Run the tests**

Run: `npm test -- atoms && npm run typecheck`
Expected: PASS, all 180 property cases green.

- [ ] **Step 5: Record the real class counts**

Run this to replace the spec's estimates with the generator's truth:

```bash
npx tsx -e "import{ATOMS,classify}from'./src/domain/atoms';const c:Record<string,number>={};for(const a of ATOMS)c[classify(a)]=(c[classify(a)]??0)+1;console.log(c)"
```

Update the counts in §3 of the spec to match, and note the real figures in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/domain/atoms.ts src/domain/atoms.test.ts docs/
git commit -m "feat: generate and classify the 180-atom alphabet"
```

---
## Task 4: The fade ladder

**Files:**
- Create: `src/domain/fade.ts`
- Test: `src/domain/fade.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type FadeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6`
  - `type FadeVisual = 'solid' | 'dim' | 'ghost' | 'frame' | 'hidden'`
  - `type Coaching = 'demo' | 'correct' | 'silent'`
  - `const MAX_FADE: FadeLevel`
  - `const FADE_PROMOTE_STREAK = 5`, `const FADE_DEMOTE_STREAK = 2`
  - `visualForFade(level: FadeLevel): FadeVisual`
  - `coachingForFade(level: FadeLevel): Coaching`
  - `nextFadeLevel(level: FadeLevel, consecutiveCorrect: number, consecutiveWrong: number): FadeLevel`

**Why this shape.** Seven fade levels map to only five renderings: F0, F1 and F2 all show solid beads and differ only in coaching. Keeping `visualForFade` and `coachingForFade` as separate pure functions is what stops that difference leaking into the bead components later.

- [ ] **Step 1: Write the failing test**

Create `src/domain/fade.test.ts`:

```ts
import { coachingForFade, nextFadeLevel, visualForFade } from './fade'

describe('visualForFade', () => {
  it.each([
    [0, 'solid'],
    [1, 'solid'],
    [2, 'solid'],
    [3, 'dim'],
    [4, 'ghost'],
    [5, 'frame'],
    [6, 'hidden'],
  ] as const)('F%i renders %s', (level, expected) => {
    expect(visualForFade(level)).toBe(expected)
  })
})

describe('coachingForFade', () => {
  it.each([
    [0, 'demo'],
    [1, 'correct'],
    [2, 'silent'],
    [6, 'silent'],
  ] as const)('F%i coaches %s', (level, expected) => {
    expect(coachingForFade(level)).toBe(expected)
  })
})

describe('nextFadeLevel', () => {
  it('promotes after five consecutive correct', () => {
    expect(nextFadeLevel(2, 5, 0)).toBe(3)
  })

  it('holds below the promote streak', () => {
    expect(nextFadeLevel(2, 4, 0)).toBe(2)
  })

  it('demotes after two consecutive wrong', () => {
    expect(nextFadeLevel(4, 0, 2)).toBe(3)
  })

  it('never promotes past F6', () => {
    expect(nextFadeLevel(6, 5, 0)).toBe(6)
  })

  it('never demotes below F0', () => {
    expect(nextFadeLevel(0, 0, 2)).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- fade`
Expected: FAIL — cannot find module `./fade`.

- [ ] **Step 3: Implement**

Create `src/domain/fade.ts`:

```ts
export type FadeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type FadeVisual = 'solid' | 'dim' | 'ghost' | 'frame' | 'hidden'
export type Coaching = 'demo' | 'correct' | 'silent'

export const MAX_FADE: FadeLevel = 6
export const FADE_PROMOTE_STREAK = 5
export const FADE_DEMOTE_STREAK = 2

const VISUALS: Record<FadeLevel, FadeVisual> = {
  0: 'solid',
  1: 'solid',
  2: 'solid',
  3: 'dim',
  4: 'ghost',
  5: 'frame',
  6: 'hidden',
}

export function visualForFade(level: FadeLevel): FadeVisual {
  return VISUALS[level]
}

export function coachingForFade(level: FadeLevel): Coaching {
  if (level === 0) return 'demo'
  if (level === 1) return 'correct'
  return 'silent'
}

export function nextFadeLevel(
  level: FadeLevel,
  consecutiveCorrect: number,
  consecutiveWrong: number,
): FadeLevel {
  if (consecutiveWrong >= FADE_DEMOTE_STREAK) return Math.max(0, level - 1) as FadeLevel
  if (consecutiveCorrect >= FADE_PROMOTE_STREAK) return Math.min(MAX_FADE, level + 1) as FadeLevel
  return level
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- fade && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fade.ts src/domain/fade.test.ts
git commit -m "feat: add the fade ladder with visual and coaching mappings"
```

---

## Task 5: Fluency — Leitner boxes and latency targets

**Files:**
- Create: `src/domain/fluency.ts`
- Test: `src/domain/fluency.test.ts`

**Interfaces:**
- Consumes: `FadeLevel`, `nextFadeLevel` from `./fade`; `AtomClass` from `./atoms`
- Produces:
  - `type AtomRecord = { atomId: string; box: number; fade: FadeLevel; consecutiveCorrect: number; consecutiveWrong: number; recentLatencyMs: number[]; dueAt: number }`
  - `const CLASS_TARGET_MS: Record<AtomClass, number>`
  - `const LEITNER_MAX_BOX = 5`, `const REFLEX_MIN_BOX = 4`, `const LATENCY_WINDOW = 5`
  - `newRecord(atomId: string, now: number): AtomRecord`
  - `medianLatencyMs(record: AtomRecord): number | null`
  - `latencyTargetMs(cls: AtomClass, calibrationMs: number): number`
  - `isReflex(record: AtomRecord, cls: AtomClass, calibrationMs: number): boolean`
  - `applyAttempt(record: AtomRecord, cls: AtomClass, correct: boolean, latencyMs: number, now: number): AtomRecord`

**Definition of reflex** (from the spec, used verbatim by the unlock gate): box ≥ 4 **and** median latency over the last five attempts under the class target.

**Calibration.** Absolute thresholds are unfair across people and devices, so targets scale by the learner's own median on direct-class atoms: `target = CLASS_TARGET_MS[cls] * (calibrationMs / CLASS_TARGET_MS.direct)`, with the scale clamped to `[0.6, 2.5]` so one bad day cannot move the goalposts permanently.

- [ ] **Step 1: Write the failing test**

Create `src/domain/fluency.test.ts`:

```ts
import {
  applyAttempt,
  CLASS_TARGET_MS,
  isReflex,
  latencyTargetMs,
  medianLatencyMs,
  newRecord,
} from './fluency'

const NOW = 1_700_000_000_000

function recordWith(latencies: number[], box: number) {
  return { ...newRecord('3+4', NOW), recentLatencyMs: latencies, box }
}

describe('medianLatencyMs', () => {
  it('is null before any attempt', () => {
    expect(medianLatencyMs(newRecord('3+4', NOW))).toBeNull()
  })

  it('takes the middle of an odd-length window', () => {
    expect(medianLatencyMs(recordWith([500, 900, 1500], 1))).toBe(900)
  })
})

describe('latencyTargetMs', () => {
  it('is the class target when calibration matches the direct baseline', () => {
    expect(latencyTargetMs('five', CLASS_TARGET_MS.direct)).toBe(CLASS_TARGET_MS.five)
  })

  it('scales up for a slower learner', () => {
    expect(latencyTargetMs('direct', 1800)).toBe(1800)
  })

  it('clamps runaway calibration', () => {
    expect(latencyTargetMs('direct', 90_000)).toBe(CLASS_TARGET_MS.direct * 2.5)
  })
})

describe('isReflex', () => {
  it('requires both box and speed', () => {
    expect(isReflex(recordWith([400, 500, 600, 500, 400], 4), 'direct', 900)).toBe(true)
  })

  it('rejects a fast atom in a low box', () => {
    expect(isReflex(recordWith([400, 500, 600, 500, 400], 2), 'direct', 900)).toBe(false)
  })

  it('rejects a high-box atom that is still slow', () => {
    expect(isReflex(recordWith([3000, 3200, 3100, 3000, 3300], 5), 'direct', 900)).toBe(false)
  })

  it('rejects an atom with too few timings to judge', () => {
    expect(isReflex(recordWith([400], 5), 'direct', 900)).toBe(false)
  })
})

describe('applyAttempt', () => {
  it('promotes the box and schedules further out on success', () => {
    const next = applyAttempt(newRecord('3+4', NOW), 'direct', true, 600, NOW)
    expect(next.box).toBe(2)
    expect(next.consecutiveCorrect).toBe(1)
    expect(next.dueAt).toBeGreaterThan(NOW)
  })

  it('resets to box 1 on failure', () => {
    const strong = { ...newRecord('3+4', NOW), box: 5, consecutiveCorrect: 4 }
    const next = applyAttempt(strong, 'direct', false, 2500, NOW)
    expect(next.box).toBe(1)
    expect(next.consecutiveCorrect).toBe(0)
    expect(next.consecutiveWrong).toBe(1)
  })

  it('keeps only the last five latencies', () => {
    let record = newRecord('3+4', NOW)
    for (const ms of [100, 200, 300, 400, 500, 600]) {
      record = applyAttempt(record, 'direct', true, ms, NOW)
    }
    expect(record.recentLatencyMs).toEqual([200, 300, 400, 500, 600])
  })

  it('promotes fade once the streak is met', () => {
    let record = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) record = applyAttempt(record, 'direct', true, 500, NOW)
    expect(record.fade).toBe(1)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- fluency`
Expected: FAIL — cannot find module `./fluency`.

- [ ] **Step 3: Implement**

Create `src/domain/fluency.ts`:

```ts
import type { AtomClass } from './atoms'
import { nextFadeLevel, type FadeLevel } from './fade'

export type AtomRecord = {
  atomId: string
  box: number
  fade: FadeLevel
  consecutiveCorrect: number
  consecutiveWrong: number
  recentLatencyMs: number[]
  dueAt: number
}

export const CLASS_TARGET_MS: Record<AtomClass, number> = {
  direct: 900,
  five: 1200,
  ten: 1400,
  both: 1800,
}

export const LEITNER_MAX_BOX = 5
export const REFLEX_MIN_BOX = 4
export const LATENCY_WINDOW = 5

const MINUTE = 60_000
const BOX_INTERVAL_MS = [0, 10 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE, 3 * 24 * 60 * MINUTE, 7 * 24 * 60 * MINUTE]

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

export function newRecord(atomId: string, now: number): AtomRecord {
  return {
    atomId,
    box: 1,
    fade: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    recentLatencyMs: [],
    dueAt: now,
  }
}

export function medianLatencyMs(record: AtomRecord): number | null {
  if (record.recentLatencyMs.length === 0) return null
  const sorted = [...record.recentLatencyMs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const lower = sorted[mid - 1]
  const upper = sorted[mid]
  if (lower === undefined || upper === undefined) return null
  return (lower + upper) / 2
}

export function latencyTargetMs(cls: AtomClass, calibrationMs: number): number {
  const raw = calibrationMs / CLASS_TARGET_MS.direct
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
  return CLASS_TARGET_MS[cls] * scale
}

export function isReflex(record: AtomRecord, cls: AtomClass, calibrationMs: number): boolean {
  if (record.box < REFLEX_MIN_BOX) return false
  if (record.recentLatencyMs.length < LATENCY_WINDOW) return false
  const median = medianLatencyMs(record)
  if (median === null) return false
  return median < latencyTargetMs(cls, calibrationMs)
}

export function applyAttempt(
  record: AtomRecord,
  _cls: AtomClass,
  correct: boolean,
  latencyMs: number,
  now: number,
): AtomRecord {
  const box = correct ? Math.min(LEITNER_MAX_BOX, record.box + 1) : 1
  const consecutiveCorrect = correct ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const recentLatencyMs = [...record.recentLatencyMs, latencyMs].slice(-LATENCY_WINDOW)
  const fade = nextFadeLevel(record.fade, consecutiveCorrect, consecutiveWrong)
  const fadeChanged = fade !== record.fade

  return {
    ...record,
    box,
    fade,
    // A fade change makes the atom a different exercise, so its streaks restart.
    consecutiveCorrect: fadeChanged ? 0 : consecutiveCorrect,
    consecutiveWrong: fadeChanged ? 0 : consecutiveWrong,
    recentLatencyMs: fadeChanged ? [] : recentLatencyMs,
    dueAt: now + (BOX_INTERVAL_MS[box] ?? 0),
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- fluency && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fluency.ts src/domain/fluency.test.ts
git commit -m "feat: add Leitner scheduling with latency-based reflex test"
```

---

## Task 6: Curriculum stages and the unlock gate

**Files:**
- Create: `src/domain/curriculum.ts`
- Test: `src/domain/curriculum.test.ts`

**Interfaces:**
- Consumes: `ATOMS`, `classify`, `type Atom`, `type AtomClass` from `./atoms`; `type AtomRecord`, `isReflex` from `./fluency`
- Produces:
  - `type StageIndex = 0 | 1 | 2 | 3 | 4`
  - `type Stage = { index: StageIndex; name: string; classes: AtomClass[] }`
  - `const STAGES: readonly Stage[]`
  - `const UNLOCK_REFLEX_RATIO = 0.85`, `const UNLOCK_MIN_FADE = 3`
  - `atomsForStage(index: StageIndex): Atom[]`
  - `isStageUnlocked(records: Record<string, AtomRecord>, calibrationMs: number, index: StageIndex): boolean`
  - `highestUnlockedStage(records: Record<string, AtomRecord>, calibrationMs: number): StageIndex`

**Note on the signature.** `isStageUnlocked` takes the records map rather than the whole `Progress` object. That keeps the dependency pointing one way — `curriculum` knows nothing about `progress`, which imports it in Task 7.

Stage 0 carries no atoms (it is the reading/setting tutorial), so stages 0 and 1 are always unlocked.

- [ ] **Step 1: Write the failing test**

Create `src/domain/curriculum.test.ts`:

```ts
import { atomsForStage, highestUnlockedStage, isStageUnlocked, STAGES } from './curriculum'
import { classify } from './atoms'
import { newRecord, type AtomRecord } from './fluency'

const NOW = 1_700_000_000_000

function reflexRecord(atomId: string): AtomRecord {
  return {
    ...newRecord(atomId, NOW),
    box: 5,
    fade: 4,
    recentLatencyMs: [300, 300, 300, 300, 300],
  }
}

function allReflex(stage: 1 | 2 | 3 | 4): Record<string, AtomRecord> {
  const records: Record<string, AtomRecord> = {}
  for (const atom of atomsForStage(stage)) records[atom.id] = reflexRecord(atom.id)
  return records
}

describe('STAGES', () => {
  it('covers stages 0 to 4', () => {
    expect(STAGES.map((s) => s.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('assigns every atom to exactly one stage', () => {
    const counts = new Map<string, number>()
    for (const stage of [1, 2, 3, 4] as const) {
      for (const atom of atomsForStage(stage)) {
        counts.set(atom.id, (counts.get(atom.id) ?? 0) + 1)
      }
    }
    expect(counts.size).toBe(180)
    expect([...counts.values()].every((n) => n === 1)).toBe(true)
  })

  it('puts direct atoms in stage 1', () => {
    expect(atomsForStage(1).every((a) => classify(a) === 'direct')).toBe(true)
  })
})

describe('isStageUnlocked', () => {
  it('always unlocks stages 0 and 1', () => {
    expect(isStageUnlocked({}, 900, 0)).toBe(true)
    expect(isStageUnlocked({}, 900, 1)).toBe(true)
  })

  it('locks stage 2 with no history', () => {
    expect(isStageUnlocked({}, 900, 2)).toBe(false)
  })

  it('unlocks stage 2 once stage 1 is reflex and faded', () => {
    expect(isStageUnlocked(allReflex(1), 900, 2)).toBe(true)
  })

  it('keeps stage 2 locked when stage 1 is fast but not faded', () => {
    const records = allReflex(1)
    for (const id of Object.keys(records)) {
      const record = records[id]
      if (record !== undefined) records[id] = { ...record, fade: 2 }
    }
    expect(isStageUnlocked(records, 900, 2)).toBe(false)
  })
})

describe('highestUnlockedStage', () => {
  it('is 1 for a new learner', () => {
    expect(highestUnlockedStage({}, 900)).toBe(1)
  })

  it('advances to 2 once stage 1 is mastered', () => {
    expect(highestUnlockedStage(allReflex(1), 900)).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- curriculum`
Expected: FAIL — cannot find module `./curriculum`.

- [ ] **Step 3: Implement**

Create `src/domain/curriculum.ts`:

```ts
import { ATOMS, classify, type Atom, type AtomClass } from './atoms'
import { isReflex, type AtomRecord } from './fluency'

export type StageIndex = 0 | 1 | 2 | 3 | 4
export type Stage = { index: StageIndex; name: string; classes: AtomClass[] }

export const UNLOCK_REFLEX_RATIO = 0.85
export const UNLOCK_MIN_FADE = 3

export const STAGES: readonly Stage[] = Object.freeze([
  { index: 0, name: 'Reading the soroban', classes: [] },
  { index: 1, name: 'Direct moves', classes: ['direct'] },
  { index: 2, name: "5's complements", classes: ['five'] },
  { index: 3, name: "10's complements", classes: ['ten'] },
  { index: 4, name: 'Combined complements', classes: ['both'] },
])

export function atomsForStage(index: StageIndex): Atom[] {
  const stage = STAGES[index]
  if (stage === undefined) return []
  return ATOMS.filter((atom) => stage.classes.includes(classify(atom)))
}

export function isStageUnlocked(
  records: Record<string, AtomRecord>,
  calibrationMs: number,
  index: StageIndex,
): boolean {
  if (index <= 1) return true
  const previous = atomsForStage((index - 1) as StageIndex)
  if (previous.length === 0) return true
  const mastered = previous.filter((atom) => {
    const record = records[atom.id]
    if (record === undefined) return false
    return record.fade >= UNLOCK_MIN_FADE && isReflex(record, classify(atom), calibrationMs)
  })
  return mastered.length / previous.length >= UNLOCK_REFLEX_RATIO
}

export function highestUnlockedStage(
  records: Record<string, AtomRecord>,
  calibrationMs: number,
): StageIndex {
  let highest: StageIndex = 1
  for (const index of [2, 3, 4] as const) {
    if (!isStageUnlocked(records, calibrationMs, index)) break
    highest = index
  }
  return highest
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- curriculum && npm run typecheck`
Expected: PASS.

If "assigns every atom to exactly one stage" fails, `classify` in Task 3 is producing a class outside the four named here — fix `classify`, not this test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/curriculum.ts src/domain/curriculum.test.ts
git commit -m "feat: add stages 0-4 with the cumulative unlock gate"
```

---
## Task 7: The Progress aggregate

**Files:**
- Create: `src/domain/progress.ts`
- Test: `src/domain/progress.test.ts`

**Interfaces:**
- Consumes: `ATOMS`, `classify` from `./atoms`; `AtomRecord`, `applyAttempt`, `newRecord`, `medianLatencyMs`, `CLASS_TARGET_MS`, `LATENCY_WINDOW` from `./fluency`; `highestUnlockedStage`, `type StageIndex` from `./curriculum`
- Produces:
  - `const SCHEMA_VERSION = 1`
  - `const DEFAULT_CALIBRATION_MS = 900`
  - `type Progress = { schemaVersion: number; atoms: Record<string, AtomRecord>; daysPracticed: number; lastSessionDay: string | null; calibrationMs: number; tutorialDone: boolean }`
  - `emptyProgress(): Progress`
  - `recordAttempt(progress: Progress, atomId: string, correct: boolean, latencyMs: number, now: number): Progress`
  - `markDayPracticed(progress: Progress, day: string): Progress`
  - `currentStage(progress: Progress): StageIndex`
  - `dayKey(now: number): string`

**Calibration is recomputed on every attempt** as the median of the per-atom median latencies across direct-class atoms that have a full five-attempt window. With no such atoms yet it stays at `DEFAULT_CALIBRATION_MS`.

**`daysPracticed` is the headline metric, not a consecutive streak** — the spec is explicit that consecutive streaks punish ordinary life and cause abandonment. `markDayPracticed` is idempotent within a day.

- [ ] **Step 1: Write the failing test**

Create `src/domain/progress.test.ts`:

```ts
import {
  currentStage,
  dayKey,
  DEFAULT_CALIBRATION_MS,
  emptyProgress,
  markDayPracticed,
  recordAttempt,
  SCHEMA_VERSION,
} from './progress'

const NOW = 1_700_000_000_000

describe('emptyProgress', () => {
  it('is stamped with the schema version', () => {
    expect(emptyProgress().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('starts with no atom history and the default calibration', () => {
    const p = emptyProgress()
    expect(Object.keys(p.atoms)).toHaveLength(0)
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
    expect(p.daysPracticed).toBe(0)
  })
})

describe('recordAttempt', () => {
  it('creates a record the first time an atom is seen', () => {
    const p = recordAttempt(emptyProgress(), '1+3', true, 700, NOW)
    expect(p.atoms['1+3']?.box).toBe(2)
  })

  it('does not mutate the input', () => {
    const before = emptyProgress()
    recordAttempt(before, '1+3', true, 700, NOW)
    expect(Object.keys(before.atoms)).toHaveLength(0)
  })

  it('recalibrates once a direct atom has a full window', () => {
    let p = emptyProgress()
    for (let i = 0; i < 5; i++) p = recordAttempt(p, '1+3', true, 400, NOW)
    expect(p.calibrationMs).toBe(400)
  })

  it('leaves calibration at the default before any full window', () => {
    const p = recordAttempt(emptyProgress(), '1+3', true, 400, NOW)
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
  })
})

describe('markDayPracticed', () => {
  it('counts a new day', () => {
    const p = markDayPracticed(emptyProgress(), '2026-09-20')
    expect(p.daysPracticed).toBe(1)
    expect(p.lastSessionDay).toBe('2026-09-20')
  })

  it('is idempotent within the same day', () => {
    const once = markDayPracticed(emptyProgress(), '2026-09-20')
    expect(markDayPracticed(once, '2026-09-20').daysPracticed).toBe(1)
  })

  it('counts a gap as one day, not a broken streak', () => {
    const first = markDayPracticed(emptyProgress(), '2026-09-01')
    expect(markDayPracticed(first, '2026-09-20').daysPracticed).toBe(2)
  })
})

describe('currentStage', () => {
  it('is 1 for a new learner', () => {
    expect(currentStage(emptyProgress())).toBe(1)
  })
})

describe('dayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(dayKey(Date.UTC(2026, 8, 20, 12))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- progress`
Expected: FAIL — cannot find module `./progress`.

- [ ] **Step 3: Implement**

Create `src/domain/progress.ts`:

```ts
import { classify } from './atoms'
import { highestUnlockedStage, type StageIndex } from './curriculum'
import {
  applyAttempt,
  LATENCY_WINDOW,
  medianLatencyMs,
  newRecord,
  type AtomRecord,
} from './fluency'

export const SCHEMA_VERSION = 1
export const DEFAULT_CALIBRATION_MS = 900

export type Progress = {
  schemaVersion: number
  atoms: Record<string, AtomRecord>
  daysPracticed: number
  lastSessionDay: string | null
  calibrationMs: number
  tutorialDone: boolean
}

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    atoms: {},
    daysPracticed: 0,
    lastSessionDay: null,
    calibrationMs: DEFAULT_CALIBRATION_MS,
    tutorialDone: false,
  }
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

function classFor(atomId: string): 'direct' | 'five' | 'ten' | 'both' {
  const match = /^(\d)([+-])(\d)$/.exec(atomId)
  if (match === null) throw new Error(`malformed atom id: ${atomId}`)
  const [, rod, sign, operand] = match
  return classify({
    id: atomId,
    rodValue: Number(rod),
    operand: Number(operand),
    direction: sign === '+' ? 'add' : 'sub',
  })
}

function recalibrate(atoms: Record<string, AtomRecord>, fallback: number): number {
  const medians: number[] = []
  for (const [atomId, record] of Object.entries(atoms)) {
    if (record.recentLatencyMs.length < LATENCY_WINDOW) continue
    if (classFor(atomId) !== 'direct') continue
    const median = medianLatencyMs(record)
    if (median !== null) medians.push(median)
  }
  if (medians.length === 0) return fallback
  medians.sort((a, b) => a - b)
  const mid = Math.floor(medians.length / 2)
  if (medians.length % 2 === 1) return medians[mid] ?? fallback
  const lower = medians[mid - 1]
  const upper = medians[mid]
  if (lower === undefined || upper === undefined) return fallback
  return (lower + upper) / 2
}

export function recordAttempt(
  progress: Progress,
  atomId: string,
  correct: boolean,
  latencyMs: number,
  now: number,
): Progress {
  const existing = progress.atoms[atomId] ?? newRecord(atomId, now)
  const updated = applyAttempt(existing, classFor(atomId), correct, latencyMs, now)
  const atoms = { ...progress.atoms, [atomId]: updated }
  return { ...progress, atoms, calibrationMs: recalibrate(atoms, DEFAULT_CALIBRATION_MS) }
}

export function markDayPracticed(progress: Progress, day: string): Progress {
  if (progress.lastSessionDay === day) return progress
  return { ...progress, daysPracticed: progress.daysPracticed + 1, lastSessionDay: day }
}

export function currentStage(progress: Progress): StageIndex {
  return highestUnlockedStage(progress.atoms, progress.calibrationMs)
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- progress && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/progress.ts src/domain/progress.test.ts
git commit -m "feat: add the Progress aggregate with rolling latency calibration"
```

---

## Task 8: The session planner

**Files:**
- Create: `src/domain/session.ts`
- Test: `src/domain/session.test.ts`

**Interfaces:**
- Consumes: `atomsForStage` from `./curriculum`; `coachingForFade`, `type Coaching`, `type FadeLevel`, `MAX_FADE` from `./fade`; `type Progress`, `currentStage` from `./progress`
- Produces:
  - `type BlockKind = 'warmup' | 'focus' | 'faderep' | 'close'`
  - `type SessionItem = { atomId: string; fade: FadeLevel; coaching: Coaching }`
  - `type SessionBlock = { kind: BlockKind; seconds: number; items: SessionItem[] }`
  - `type SessionPlan = { blocks: SessionBlock[]; totalSeconds: number }`
  - `const BLOCK_SECONDS: Record<BlockKind, number>`
  - `const SESSION_SECONDS = 285`
  - `const NEW_ATOMS_PER_DAY = 2`
  - `const MAX_ATTEMPTS_PER_ATOM = 3`
  - `selectSession(progress: Progress, now: number): SessionPlan`

**Block composition** (spec §6): warm-up 45s / focus 120s / fade rep 90s / close 30s.

- Warm-up: up to 10 due atoms, highest box first — safe wins that activate the learner.
- Focus: up to 3 atoms, lowest box first within the current stage, including at most `NEW_ATOMS_PER_DAY` never-seen atoms.
- Fade rep: up to 6 seen atoms below `MAX_FADE`, presented one fade level higher than their record. This is the block that builds anzan.
- Close: no items.

`MAX_ATTEMPTS_PER_ATOM` is exported here for the runner in Task 11 to enforce — three failures on one atom within a session and it stops appearing.

- [ ] **Step 1: Write the failing test**

Create `src/domain/session.test.ts`:

```ts
import { atomsForStage } from './curriculum'
import { emptyProgress, recordAttempt, type Progress } from './progress'
import {
  BLOCK_SECONDS,
  NEW_ATOMS_PER_DAY,
  selectSession,
  SESSION_SECONDS,
} from './session'

const NOW = 1_700_000_000_000

describe('selectSession', () => {
  it('always runs the four blocks in order', () => {
    const plan = selectSession(emptyProgress(), NOW)
    expect(plan.blocks.map((b) => b.kind)).toEqual(['warmup', 'focus', 'faderep', 'close'])
  })

  it('always totals exactly the session budget', () => {
    expect(selectSession(emptyProgress(), NOW).totalSeconds).toBe(SESSION_SECONDS)
  })

  it('sums the block seconds to the total', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const sum = plan.blocks.reduce((acc, b) => acc + b.seconds, 0)
    expect(sum).toBe(SESSION_SECONDS)
    expect(sum).toBe(
      BLOCK_SECONDS.warmup + BLOCK_SECONDS.focus + BLOCK_SECONDS.faderep + BLOCK_SECONDS.close,
    )
  })

  it('introduces at most two new atoms for a brand-new learner', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const focus = plan.blocks.find((b) => b.kind === 'focus')
    expect(focus?.items.length).toBe(NEW_ATOMS_PER_DAY)
  })

  it('only offers atoms from an unlocked stage', () => {
    const plan = selectSession(emptyProgress(), NOW)
    const allowed = new Set(atomsForStage(1).map((a) => a.id))
    for (const block of plan.blocks) {
      for (const item of block.items) expect(allowed.has(item.atomId)).toBe(true)
    }
  })

  it('gives a new learner nothing to warm up on', () => {
    const plan = selectSession(emptyProgress(), NOW)
    expect(plan.blocks.find((b) => b.kind === 'warmup')?.items).toEqual([])
  })

  it('presents fade-rep atoms one level above their record', () => {
    let progress: Progress = emptyProgress()
    const atomId = atomsForStage(1)[0]?.id ?? '0+1'
    progress = recordAttempt(progress, atomId, true, 400, NOW)
    const record = progress.atoms[atomId]
    const plan = selectSession(progress, NOW + 60_000)
    const item = plan.blocks.find((b) => b.kind === 'faderep')?.items.find((i) => i.atomId === atomId)
    if (item !== undefined && record !== undefined) {
      expect(item.fade).toBe(record.fade + 1)
    }
  })

  it('never shows the same atom twice within one block', () => {
    const plan = selectSession(emptyProgress(), NOW)
    for (const block of plan.blocks) {
      const ids = block.items.map((i) => i.atomId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- session`
Expected: FAIL — cannot find module `./session`.

- [ ] **Step 3: Implement**

Create `src/domain/session.ts`:

```ts
import { atomsForStage, type StageIndex } from './curriculum'
import { coachingForFade, MAX_FADE, type Coaching, type FadeLevel } from './fade'
import { currentStage, type Progress } from './progress'

export type BlockKind = 'warmup' | 'focus' | 'faderep' | 'close'
export type SessionItem = { atomId: string; fade: FadeLevel; coaching: Coaching }
export type SessionBlock = { kind: BlockKind; seconds: number; items: SessionItem[] }
export type SessionPlan = { blocks: SessionBlock[]; totalSeconds: number }

export const BLOCK_SECONDS: Record<BlockKind, number> = {
  warmup: 45,
  focus: 120,
  faderep: 90,
  close: 30,
}

export const SESSION_SECONDS = 285
export const NEW_ATOMS_PER_DAY = 2
export const MAX_ATTEMPTS_PER_ATOM = 3

const WARMUP_ITEMS = 10
const FOCUS_ITEMS = 3
const FADEREP_ITEMS = 6

function item(atomId: string, fade: FadeLevel): SessionItem {
  return { atomId, fade, coaching: coachingForFade(fade) }
}

export function selectSession(progress: Progress, now: number): SessionPlan {
  const stage: StageIndex = currentStage(progress)
  // Every unlocked stage stays in play, so earlier material keeps being rehearsed.
  const available = ([0, 1, 2, 3, 4] as const)
    .filter((index) => index <= stage)
    .flatMap((index) => atomsForStage(index))

  const seen = available.filter((atom) => progress.atoms[atom.id] !== undefined)
  const unseen = available.filter((atom) => progress.atoms[atom.id] === undefined)

  const due = seen
    .filter((atom) => (progress.atoms[atom.id]?.dueAt ?? 0) <= now)
    .sort((a, b) => (progress.atoms[b.id]?.box ?? 0) - (progress.atoms[a.id]?.box ?? 0))

  const warmup = due
    .slice(0, WARMUP_ITEMS)
    .map((atom) => item(atom.id, progress.atoms[atom.id]?.fade ?? 0))

  const shaky = seen
    .slice()
    .sort((a, b) => (progress.atoms[a.id]?.box ?? 0) - (progress.atoms[b.id]?.box ?? 0))
    .filter((atom) => !warmup.some((w) => w.atomId === atom.id))

  const fresh = unseen.slice(0, NEW_ATOMS_PER_DAY)
  const focusAtoms = [...fresh, ...shaky].slice(0, Math.max(FOCUS_ITEMS, fresh.length))
  const focus = focusAtoms.map((atom) => item(atom.id, progress.atoms[atom.id]?.fade ?? 0))

  const faderep = seen
    .filter((atom) => (progress.atoms[atom.id]?.fade ?? 0) < MAX_FADE)
    .slice(0, FADEREP_ITEMS)
    .map((atom) => item(atom.id, ((progress.atoms[atom.id]?.fade ?? 0) + 1) as FadeLevel))

  return {
    blocks: [
      { kind: 'warmup', seconds: BLOCK_SECONDS.warmup, items: warmup },
      { kind: 'focus', seconds: BLOCK_SECONDS.focus, items: focus },
      { kind: 'faderep', seconds: BLOCK_SECONDS.faderep, items: faderep },
      { kind: 'close', seconds: BLOCK_SECONDS.close, items: [] },
    ],
    totalSeconds: SESSION_SECONDS,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- session && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/session.ts src/domain/session.test.ts
git commit -m "feat: add the fixed five-minute session planner"
```

---

## Task 9: Persistence

**Files:**
- Create: `src/storage/progressStore.ts`
- Test: `src/storage/progressStore.test.ts`
- Modify: `package.json` (add `@react-native-async-storage/async-storage`)

**Interfaces:**
- Consumes: `type Progress`, `emptyProgress`, `SCHEMA_VERSION` from `@/domain/progress`
- Produces:
  - `const STORAGE_KEY = 'learning-abacus/progress/v1'`
  - `loadProgress(): Promise<Progress>`
  - `saveProgress(progress: Progress): Promise<void>`

**Corrupt or unknown data is discarded, never thrown.** A learner opening the app must always get a working session; a parse failure falls back to `emptyProgress()`.

- [ ] **Step 1: Install the dependency**

```bash
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Write the failing test**

Create `src/storage/progressStore.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { emptyProgress, SCHEMA_VERSION } from '@/domain/progress'
import { loadProgress, saveProgress, STORAGE_KEY } from './progressStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('loadProgress', () => {
  it('returns empty progress when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null)
    expect(await loadProgress()).toEqual(emptyProgress())
  })

  it('round-trips a saved document', async () => {
    const progress = { ...emptyProgress(), daysPracticed: 7 }
    mockGetItem.mockResolvedValue(JSON.stringify(progress))
    expect((await loadProgress()).daysPracticed).toBe(7)
  })

  it('falls back to empty progress on malformed JSON', async () => {
    mockGetItem.mockResolvedValue('{not json')
    expect(await loadProgress()).toEqual(emptyProgress())
  })

  it('discards a document from an unknown schema version', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, atoms: {} }))
    expect(await loadProgress()).toEqual(emptyProgress())
  })

  it('survives a storage failure', async () => {
    mockGetItem.mockRejectedValue(new Error('disk gone'))
    expect(await loadProgress()).toEqual(emptyProgress())
  })
})

describe('saveProgress', () => {
  it('writes under the versioned key', async () => {
    const progress = emptyProgress()
    await saveProgress(progress)
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(progress))
  })
})
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npm test -- progressStore`
Expected: FAIL — cannot find module `./progressStore`.

- [ ] **Step 4: Implement**

Create `src/storage/progressStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { emptyProgress, SCHEMA_VERSION, type Progress } from '@/domain/progress'

export const STORAGE_KEY = 'learning-abacus/progress/v1'

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw === null) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyProgress()
    const candidate = parsed as Partial<Progress>
    if (candidate.schemaVersion !== SCHEMA_VERSION) return emptyProgress()
    return { ...emptyProgress(), ...candidate } as Progress
  } catch {
    return emptyProgress()
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // A failed write costs at most one block of history; never crash a session over it.
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- progressStore && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage package.json package-lock.json
git commit -m "feat: persist progress to AsyncStorage with safe fallbacks"
```

---
## Task 10: The abacus and FadeLayer

**Files:**
- Create: `src/ui/abacus/FadeLayer.tsx`, `src/ui/abacus/Bead.tsx`, `src/ui/abacus/Rod.tsx`, `src/ui/abacus/Abacus.tsx`
- Test: `src/ui/abacus/FadeLayer.test.tsx`, `src/ui/abacus/Abacus.test.tsx`
- Modify: `package.json` (add `@testing-library/react-native`)

**Interfaces:**
- Consumes: `type FadeLevel`, `type FadeVisual`, `visualForFade` from `@/domain/fade`; `type Rod as RodState`, `type Soroban`, `readRod` from `@/domain/soroban`
- Produces:
  - `const BEAD_OPACITY: Record<FadeVisual, number>`
  - `showsFrame(visual: FadeVisual): boolean`
  - `FadeLayer(props: { level: FadeLevel; children: ReactNode })`
  - `Abacus(props: { soroban: Soroban; fade: FadeLevel; onBeadPress?: (rodIndex: number, kind: 'heaven' | 'earth', index: number) => void })`

**This is the task that protects the core feature.** Visibility must resolve in exactly one place. `Abacus` asks `visualForFade` once and passes the result down; `Bead` and `Rod` never see a `FadeLevel`. If a later task reaches for `fade` inside a bead component, that is the bug this structure exists to prevent.

The prototype on `codex/create-soroban-app-with-animations` has usable `Bead`/`Rod`/`Abacus` geometry. Retrieve it with `git show origin/codex/create-soroban-app-with-animations:src/components/Abacus/Bead.tsx` and adapt; do not merge the branch, whose quiz engine is superseded.

- [ ] **Step 1: Install the testing library**

```bash
npm install --save-dev @testing-library/react-native
```

- [ ] **Step 2: Write the failing test**

Create `src/ui/abacus/FadeLayer.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { BEAD_OPACITY, FadeLayer, showsFrame } from './FadeLayer'

describe('BEAD_OPACITY', () => {
  it('shows beads fully when solid', () => {
    expect(BEAD_OPACITY.solid).toBe(1)
  })

  it('hides beads entirely at frame and hidden', () => {
    expect(BEAD_OPACITY.frame).toBe(0)
    expect(BEAD_OPACITY.hidden).toBe(0)
  })

  it('fades monotonically from solid to ghost', () => {
    expect(BEAD_OPACITY.solid).toBeGreaterThan(BEAD_OPACITY.dim)
    expect(BEAD_OPACITY.dim).toBeGreaterThan(BEAD_OPACITY.ghost)
  })
})

describe('showsFrame', () => {
  it('keeps the frame until everything disappears', () => {
    expect(showsFrame('frame')).toBe(true)
    expect(showsFrame('hidden')).toBe(false)
  })
})

describe('FadeLayer', () => {
  it('renders its children at full opacity for F0', () => {
    const { getByTestId } = render(
      <FadeLayer level={0}>
        <Text>beads</Text>
      </FadeLayer>,
    )
    expect(getByTestId('fade-layer').props.style).toEqual(
      expect.objectContaining({ opacity: 1 }),
    )
  })

  it('renders its children invisible at F6', () => {
    const { getByTestId } = render(
      <FadeLayer level={6}>
        <Text>beads</Text>
      </FadeLayer>,
    )
    expect(getByTestId('fade-layer').props.style).toEqual(
      expect.objectContaining({ opacity: 0 }),
    )
  })
})
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npm test -- FadeLayer`
Expected: FAIL — cannot find module `./FadeLayer`.

- [ ] **Step 4: Implement FadeLayer**

Create `src/ui/abacus/FadeLayer.tsx`:

```tsx
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { visualForFade, type FadeLevel, type FadeVisual } from '@/domain/fade'

export const BEAD_OPACITY: Record<FadeVisual, number> = {
  solid: 1,
  dim: 0.35,
  ghost: 0.12,
  frame: 0,
  hidden: 0,
}

export function showsFrame(visual: FadeVisual): boolean {
  return visual !== 'hidden'
}

export function FadeLayer({ level, children }: { level: FadeLevel; children: ReactNode }) {
  const visual = visualForFade(level)
  return (
    <View testID="fade-layer" style={{ opacity: BEAD_OPACITY[visual] }}>
      {children}
    </View>
  )
}
```

- [ ] **Step 5: Write the Abacus test**

Create `src/ui/abacus/Abacus.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from './Abacus'

describe('Abacus', () => {
  it('renders one rod per column', () => {
    const { getAllByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={0} />)
    expect(getAllByTestId(/^rod-/)).toHaveLength(2)
  })

  it('renders the frame at F5 but not at F6', () => {
    const framed = render(<Abacus soroban={emptySoroban(2)} fade={5} />)
    expect(framed.queryByTestId('abacus-frame')).not.toBeNull()

    const hidden = render(<Abacus soroban={emptySoroban(2)} fade={6} />)
    expect(hidden.queryByTestId('abacus-frame')).toBeNull()
  })

  it('reflects the value it is given', () => {
    const { getByTestId } = render(<Abacus soroban={setValue(emptySoroban(2), 47)} fade={0} />)
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('4')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('7')
  })
})
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `npm test -- Abacus`
Expected: FAIL — cannot find module `./Abacus`.

- [ ] **Step 7: Implement Bead, Rod and Abacus**

Create `src/ui/abacus/Bead.tsx`:

```tsx
import { Pressable, View } from 'react-native'

export function Bead({
  active,
  kind,
  onPress,
}: {
  active: boolean
  kind: 'heaven' | 'earth'
  onPress?: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <View
        testID={`bead-${kind}`}
        style={{
          width: 34,
          height: 18,
          borderRadius: 9,
          marginVertical: 2,
          backgroundColor: active ? '#8B5A2B' : '#D8C3A5',
        }}
      />
    </Pressable>
  )
}
```

Create `src/ui/abacus/Rod.tsx`:

```tsx
import { View } from 'react-native'
import { readRod, type Rod as RodState } from '@/domain/soroban'
import { Bead } from './Bead'

export function Rod({
  rod,
  index,
  onBeadPress,
}: {
  rod: RodState
  index: number
  onBeadPress?: (kind: 'heaven' | 'earth', beadIndex: number) => void
}) {
  return (
    <View
      testID={`rod-${index}`}
      accessibilityValue={{ text: String(readRod(rod)) }}
      style={{ alignItems: 'center', marginHorizontal: 6 }}
    >
      <Bead active={rod.heaven} kind="heaven" onPress={() => onBeadPress?.('heaven', 0)} />
      <View style={{ height: 2, width: 40, backgroundColor: '#444', marginVertical: 6 }} />
      {[0, 1, 2, 3].map((i) => (
        <Bead key={i} active={i < rod.earth} kind="earth" onPress={() => onBeadPress?.('earth', i)} />
      ))}
    </View>
  )
}
```

Create `src/ui/abacus/Abacus.tsx`:

```tsx
import { View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { Soroban } from '@/domain/soroban'
import { FadeLayer, showsFrame } from './FadeLayer'
import { Rod } from './Rod'

export function Abacus({
  soroban,
  fade,
  onBeadPress,
}: {
  soroban: Soroban
  fade: FadeLevel
  onBeadPress?: (rodIndex: number, kind: 'heaven' | 'earth', beadIndex: number) => void
}) {
  // Visibility resolves here and nowhere else. Bead and Rod never see a FadeLevel.
  const visual = visualForFade(fade)

  return (
    <View
      testID={showsFrame(visual) ? 'abacus-frame' : 'abacus-blank'}
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        padding: 12,
        borderWidth: showsFrame(visual) ? 2 : 0,
        borderColor: '#5C4033',
        borderRadius: 8,
      }}
    >
      <FadeLayer level={fade}>
        <View style={{ flexDirection: 'row' }}>
          {soroban.rods.map((rod, index) => (
            <Rod
              key={index}
              rod={rod}
              index={index}
              onBeadPress={(kind, beadIndex) => onBeadPress?.(index, kind, beadIndex)}
            />
          ))}
        </View>
      </FadeLayer>
    </View>
  )
}
```

- [ ] **Step 8: Run the tests**

Run: `npm test -- abacus && npm run typecheck`
Expected: PASS.

Note: `getAllByTestId(/^rod-/)` returns the rods even inside `FadeLayer`, because opacity 0 still renders. That is intentional — the beads stay mounted so the learner's taps still register at high fade.

- [ ] **Step 9: Commit**

```bash
git add src/ui/abacus package.json package-lock.json
git commit -m "feat: render the abacus with fade owned by a single layer"
```

---

## Task 11: The session runner

**Files:**
- Create: `src/ui/session/SessionRunner.tsx`
- Test: `src/ui/session/SessionRunner.test.tsx`

**Interfaces:**
- Consumes: `type SessionPlan`, `type SessionItem`, `MAX_ATTEMPTS_PER_ATOM` from `@/domain/session`; `Abacus` from `@/ui/abacus/Abacus`; `setValue`, `emptySoroban` from `@/domain/soroban`
- Produces:
  - `type AttemptResult = { atomId: string; correct: boolean; latencyMs: number }`
  - `SessionRunner(props: { plan: SessionPlan; onAttempt: (result: AttemptResult) => void; onBlockEnd: (kind: BlockKind) => void; onFinish: () => void; now?: () => number })`

**Behaviour required by the spec:**
- Presents each item as "rod shows N, add/subtract M" and accepts a numeric answer.
- Measures latency from when the item appears to when the answer is submitted.
- A wrong answer at coaching `demo`/`correct` shows the right move and requeues the item later in the block.
- A wrong answer at `silent` with fade ≥ 4 drops one fade level for the retry, revealing the beads.
- After `MAX_ATTEMPTS_PER_ATOM` failures on one atom in a session, the item is dropped from the rest of the session.
- `onBlockEnd` fires at each block boundary so the caller can persist — persistence is per block, never per attempt.

`now` is injected so tests control the clock. Default it to `Date.now`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/session/SessionRunner.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import type { SessionPlan } from '@/domain/session'
import { SessionRunner } from './SessionRunner'

const plan: SessionPlan = {
  blocks: [
    {
      kind: 'focus',
      seconds: 120,
      items: [{ atomId: '3+4', fade: 0, coaching: 'demo' }],
    },
    { kind: 'close', seconds: 30, items: [] },
  ],
  totalSeconds: 150,
}

function renderRunner(overrides: Partial<Parameters<typeof SessionRunner>[0]> = {}) {
  const onAttempt = jest.fn()
  const onBlockEnd = jest.fn()
  const onFinish = jest.fn()
  let clock = 1_000
  const utils = render(
    <SessionRunner
      plan={plan}
      onAttempt={onAttempt}
      onBlockEnd={onBlockEnd}
      onFinish={onFinish}
      now={() => (clock += 500)}
      {...overrides}
    />,
  )
  return { ...utils, onAttempt, onBlockEnd, onFinish }
}

describe('SessionRunner', () => {
  it('shows the current atom as a prompt', () => {
    const { getByTestId } = renderRunner()
    expect(getByTestId('prompt').props.children).toContain('3')
  })

  it('reports a correct attempt with a latency', () => {
    const { getByTestId, onAttempt } = renderRunner()
    fireEvent.changeText(getByTestId('answer-input'), '7')
    fireEvent.press(getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: '3+4', correct: true }),
    )
    expect(onAttempt.mock.calls[0]?.[0].latencyMs).toBeGreaterThan(0)
  })

  it('reports a wrong answer as incorrect', () => {
    const { getByTestId, onAttempt } = renderRunner()
    fireEvent.changeText(getByTestId('answer-input'), '9')
    fireEvent.press(getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
  })

  it('shows the correction when coaching is demo', () => {
    const { getByTestId, queryByTestId } = renderRunner()
    fireEvent.changeText(getByTestId('answer-input'), '9')
    fireEvent.press(getByTestId('submit'))
    expect(queryByTestId('correction')).not.toBeNull()
  })

  it('fires onBlockEnd when a block completes', () => {
    const { getByTestId, onBlockEnd } = renderRunner()
    fireEvent.changeText(getByTestId('answer-input'), '7')
    fireEvent.press(getByTestId('submit'))
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
  })

  it('drops an atom after three failures', () => {
    const { getByTestId, onAttempt, onFinish } = renderRunner()
    for (let i = 0; i < 3; i++) {
      fireEvent.changeText(getByTestId('answer-input'), '9')
      fireEvent.press(getByTestId('submit'))
    }
    expect(onAttempt).toHaveBeenCalledTimes(3)
    expect(onFinish).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- SessionRunner`
Expected: FAIL — cannot find module `./SessionRunner`.

- [ ] **Step 3: Implement**

Create `src/ui/session/SessionRunner.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { MAX_ATTEMPTS_PER_ATOM, type BlockKind, type SessionItem, type SessionPlan } from '@/domain/session'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from '@/ui/abacus/Abacus'

export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number }

type Queued = { item: SessionItem; blockIndex: number }

function parseAtomId(atomId: string): { rodValue: number; operand: number; sign: 1 | -1 } {
  const match = /^(\d)([+-])(\d)$/.exec(atomId)
  if (match === null) throw new Error(`malformed atom id: ${atomId}`)
  return {
    rodValue: Number(match[1]),
    operand: Number(match[3]),
    sign: match[2] === '+' ? 1 : -1,
  }
}

export function SessionRunner({
  plan,
  onAttempt,
  onBlockEnd,
  onFinish,
  now = Date.now,
}: {
  plan: SessionPlan
  onAttempt: (result: AttemptResult) => void
  onBlockEnd: (kind: BlockKind) => void
  onFinish: () => void
  now?: () => number
}) {
  const queue = useMemo<Queued[]>(
    () => plan.blocks.flatMap((block, blockIndex) => block.items.map((item) => ({ item, blockIndex }))),
    [plan],
  )

  const [pending, setPending] = useState<Queued[]>(queue)
  const [answer, setAnswer] = useState('')
  const [correction, setCorrection] = useState<number | null>(null)
  const failures = useRef<Record<string, number>>({})
  const shownAt = useRef<number>(now())

  const current = pending[0]

  if (current === undefined) {
    return (
      <View>
        <Text testID="session-complete">Done for today</Text>
      </View>
    )
  }

  const { rodValue, operand, sign } = parseAtomId(current.item.atomId)
  const expected = rodValue + sign * operand

  function submit() {
    if (current === undefined) return
    const latencyMs = Math.max(1, now() - shownAt.current)
    const correct = Number(answer) === expected
    onAttempt({ atomId: current.item.atomId, correct, latencyMs })

    const rest = pending.slice(1)
    let next = rest

    if (!correct) {
      const count = (failures.current[current.item.atomId] ?? 0) + 1
      failures.current[current.item.atomId] = count
      if (current.item.coaching !== 'silent') setCorrection(expected)
      if (count < MAX_ATTEMPTS_PER_ATOM) {
        // Reveal one level on a high-fade miss, so the learner sees what they
        // should have been imagining, then try again later in the block.
        const fade = (current.item.fade >= 4 ? current.item.fade - 1 : current.item.fade) as FadeLevel
        next = [...rest, { ...current, item: { ...current.item, fade } }]
      }
    } else {
      setCorrection(null)
    }

    const blockChanged = next[0]?.blockIndex !== current.blockIndex
    if (blockChanged) {
      const block = plan.blocks[current.blockIndex]
      if (block !== undefined) onBlockEnd(block.kind)
    }

    setAnswer('')
    shownAt.current = now()
    setPending(next)
    if (next.length === 0) onFinish()
  }

  return (
    <View>
      <Abacus soroban={setValue(emptySoroban(2), rodValue)} fade={current.item.fade} />
      <Text testID="prompt">{`${rodValue} ${sign === 1 ? '+' : '−'} ${operand}`}</Text>
      <TextInput
        testID="answer-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="submit" accessibilityRole="button" onPress={submit}>
        <Text>Answer</Text>
      </Pressable>
      {correction !== null ? <Text testID="correction">{`It is ${correction}`}</Text> : null}
    </View>
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- SessionRunner && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/session
git commit -m "feat: add the session runner with correction and failure caps"
```

---
## Task 12: Progress provider and the Today screen

**Files:**
- Create: `src/ui/ProgressProvider.tsx`, `app/_layout.tsx`, `app/index.tsx`
- Test: `src/ui/ProgressProvider.test.tsx`, `__tests__/today-session.test.tsx`

**Interfaces:**
- Consumes: `loadProgress`, `saveProgress` from `@/storage/progressStore`; `recordAttempt`, `markDayPracticed`, `dayKey`, `emptyProgress`, `type Progress` from `@/domain/progress`; `selectSession` from `@/domain/session`; `SessionRunner`, `type AttemptResult` from `@/ui/session/SessionRunner`
- Produces:
  - `ProgressProvider(props: { children: ReactNode })`
  - `useProgress(): { progress: Progress; hydrated: boolean; attempt: (result: AttemptResult) => void; flush: () => Promise<void>; reset: () => Promise<void> }`

**Hydration gate.** Nothing renders a session until `loadProgress` resolves; otherwise the first session is planned against empty progress and overwrites real history on the first flush. `hydrated` gates the screen.

**Persistence is per block.** `attempt` updates in-memory state only. `flush` writes to AsyncStorage and is called from `onBlockEnd` and `onFinish`.

- [ ] **Step 1: Write the failing provider test**

Create `src/ui/ProgressProvider.test.tsx`:

```tsx
import { act, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import { ProgressProvider, useProgress } from './ProgressProvider'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

function Probe() {
  const { progress, hydrated } = useProgress()
  return <Text testID="probe">{hydrated ? String(progress.daysPracticed) : 'loading'}</Text>
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 3 })
  mockSave.mockResolvedValue()
})

describe('ProgressProvider', () => {
  it('gates on hydration then exposes stored progress', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <Probe />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('3'))
  })

  it('does not write on every attempt', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    act(() => api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500 }))
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('writes when flushed', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      await api?.flush()
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- ProgressProvider`
Expected: FAIL — cannot find module `./ProgressProvider`.

- [ ] **Step 3: Implement the provider**

Create `src/ui/ProgressProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { dayKey, emptyProgress, markDayPracticed, recordAttempt, type Progress } from '@/domain/progress'
import { loadProgress, saveProgress } from '@/storage/progressStore'
import type { AttemptResult } from '@/ui/session/SessionRunner'

type ProgressApi = {
  progress: Progress
  hydrated: boolean
  attempt: (result: AttemptResult) => void
  flush: () => Promise<void>
  reset: () => Promise<void>
}

const ProgressContext = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(emptyProgress())
  const [hydrated, setHydrated] = useState(false)
  const latest = useRef<Progress>(progress)

  useEffect(() => {
    let cancelled = false
    void loadProgress().then((stored) => {
      if (cancelled) return
      latest.current = stored
      setProgress(stored)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const attempt = useCallback((result: AttemptResult) => {
    setProgress((previous) => {
      const withAttempt = recordAttempt(
        previous,
        result.atomId,
        result.correct,
        result.latencyMs,
        Date.now(),
      )
      const next = markDayPracticed(withAttempt, dayKey(Date.now()))
      latest.current = next
      return next
    })
  }, [])

  const flush = useCallback(async () => {
    await saveProgress(latest.current)
  }, [])

  const reset = useCallback(async () => {
    const fresh = emptyProgress()
    latest.current = fresh
    setProgress(fresh)
    await saveProgress(fresh)
  }, [])

  return (
    <ProgressContext.Provider value={{ progress, hydrated, attempt, flush, reset }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext)
  if (api === null) throw new Error('useProgress must be used inside a ProgressProvider')
  return api
}
```

- [ ] **Step 4: Write the Today screen test**

Create `__tests__/today-session.test.tsx`:

```tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Today from '../app/index'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue(emptyProgress())
  mockSave.mockResolvedValue()
})

describe('Today', () => {
  it('shows a loading state before hydration', () => {
    const { queryByTestId } = render(
      <ProgressProvider>
        <Today />
      </ProgressProvider>,
    )
    expect(queryByTestId('hydrating')).not.toBeNull()
  })

  it('runs a session once hydrated', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <Today />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    fireEvent.changeText(getByTestId('answer-input'), '1')
    fireEvent.press(getByTestId('submit'))
    expect(getByTestId('prompt')).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `npm test -- today-session`
Expected: FAIL — cannot find module `../app/index`.

- [ ] **Step 6: Implement the layout and screen**

Create `app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'
import { ProgressProvider } from '@/ui/ProgressProvider'

export default function RootLayout() {
  return (
    <ProgressProvider>
      <Stack />
    </ProgressProvider>
  )
}
```

Create `app/index.tsx`:

```tsx
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { selectSession } from '@/domain/session'
import { useProgress } from '@/ui/ProgressProvider'
import { SessionRunner } from '@/ui/session/SessionRunner'

export default function Today() {
  const { progress, hydrated, attempt, flush } = useProgress()

  // Planned once per mount: re-planning mid-session would reshuffle the queue
  // under the learner as their own answers change the schedule.
  const plan = useMemo(
    () => (hydrated ? selectSession(progress, Date.now()) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated],
  )

  if (!hydrated || plan === null) {
    return (
      <View>
        <Text testID="hydrating">Loading your progress…</Text>
      </View>
    )
  }

  return (
    <View>
      <Text testID="days-practiced">{`${progress.daysPracticed} days practised`}</Text>
      <SessionRunner
        plan={plan}
        onAttempt={attempt}
        onBlockEnd={() => void flush()}
        onFinish={() => void flush()}
      />
    </View>
  )
}
```

- [ ] **Step 7: Run the tests**

Run: `npm test && npm run typecheck`
Expected: PASS, whole suite.

- [ ] **Step 8: Commit**

```bash
git add src/ui/ProgressProvider.tsx app/_layout.tsx app/index.tsx __tests__/today-session.test.tsx
git commit -m "feat: wire the Today session to persisted progress"
```

---

## Task 13: Stage 0 — the reading tutorial

**Files:**
- Create: `app/tutorial.tsx`, `src/ui/tutorial/ReadingDrill.tsx`
- Test: `src/ui/tutorial/ReadingDrill.test.tsx`

**Interfaces:**
- Consumes: `Abacus` from `@/ui/abacus/Abacus`; `emptySoroban`, `setValue`, `readValue` from `@/domain/soroban`; `useProgress` from `@/ui/ProgressProvider`
- Produces: `ReadingDrill(props: { onComplete: () => void; values?: number[] })`

Stage 0 carries no atoms — it teaches reading and setting a rod, and completing it sets `tutorialDone`. Ten prompts: the app shows a bead configuration, the learner types the number.

- [ ] **Step 1: Write the failing test**

Create `src/ui/tutorial/ReadingDrill.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import { ReadingDrill } from './ReadingDrill'

describe('ReadingDrill', () => {
  it('advances on a correct reading', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '7')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain(2)
  })

  it('does not advance on a wrong reading', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '2')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain(1)
  })

  it('completes after the last value', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7]} />)
    fireEvent.changeText(getByTestId('reading-input'), '7')
    fireEvent.press(getByTestId('reading-submit'))
    expect(onComplete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- ReadingDrill`
Expected: FAIL — cannot find module `./ReadingDrill`.

- [ ] **Step 3: Implement**

Create `src/ui/tutorial/ReadingDrill.tsx`:

```tsx
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from '@/ui/abacus/Abacus'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const target = values[index] ?? 0

  function submit() {
    if (Number(answer) !== target) {
      setAnswer('')
      return
    }
    setAnswer('')
    if (index + 1 >= values.length) {
      onComplete()
      return
    }
    setIndex(index + 1)
  }

  return (
    <View>
      <Text testID="reading-index">{`Rod ${index + 1} of ${values.length}`}</Text>
      <Abacus soroban={setValue(emptySoroban(1), target)} fade={0} />
      <Text>What number is on this rod?</Text>
      <TextInput
        testID="reading-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="reading-submit" accessibilityRole="button" onPress={submit}>
        <Text>Check</Text>
      </Pressable>
    </View>
  )
}
```

Create `app/tutorial.tsx`:

```tsx
import { router } from 'expo-router'
import { ReadingDrill } from '@/ui/tutorial/ReadingDrill'

export default function Tutorial() {
  return <ReadingDrill onComplete={() => router.replace('/')} />
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- ReadingDrill && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tutorial app/tutorial.tsx
git commit -m "feat: add the stage 0 rod-reading tutorial"
```

---

## Task 14: The 180-atom progress map

**Files:**
- Create: `src/ui/progress/AtomGrid.tsx`, `app/progress.tsx`
- Test: `src/ui/progress/AtomGrid.test.tsx`

**Interfaces:**
- Consumes: `ATOMS`, `classify` from `@/domain/atoms`; `isReflex`, `type AtomRecord` from `@/domain/fluency`; `type Progress` from `@/domain/progress`
- Produces:
  - `type CellState = 'unseen' | 'learning' | 'reflex' | 'mental'`
  - `cellState(record: AtomRecord | undefined, cls: AtomClass, calibrationMs: number): CellState`
  - `AtomGrid(props: { progress: Progress })`

**This is Phase 1's only milestone system** (spec §5 — stages 0-4 sit below 10級, so no official grade is earned). It has to carry motivation alone, so it shows all 180 cells from day one: the unfilled ones are the map of what is coming.

`mental` means fade has reached F6 — the learner performs that move in their head.

- [ ] **Step 1: Write the failing test**

Create `src/ui/progress/AtomGrid.test.tsx`:

```tsx
import { render } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import { newRecord } from '@/domain/fluency'
import { AtomGrid, cellState } from './AtomGrid'

const NOW = 1_700_000_000_000

describe('cellState', () => {
  it('is unseen with no record', () => {
    expect(cellState(undefined, 'direct', 900)).toBe('unseen')
  })

  it('is learning for a fresh record', () => {
    expect(cellState(newRecord('1+3', NOW), 'direct', 900)).toBe('learning')
  })

  it('is reflex when fast and well-boxed', () => {
    const record = { ...newRecord('1+3', NOW), box: 5, recentLatencyMs: [300, 300, 300, 300, 300] }
    expect(cellState(record, 'direct', 900)).toBe('reflex')
  })

  it('is mental at full fade', () => {
    const record = {
      ...newRecord('1+3', NOW),
      box: 5,
      fade: 6 as const,
      recentLatencyMs: [300, 300, 300, 300, 300],
    }
    expect(cellState(record, 'direct', 900)).toBe('mental')
  })
})

describe('AtomGrid', () => {
  it('renders a cell for every atom in the alphabet', () => {
    const { getAllByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getAllByTestId(/^atom-cell-/)).toHaveLength(180)
  })

  it('summarises how many are mastered', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getByTestId('atom-summary').props.children).toContain(0)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- AtomGrid`
Expected: FAIL — cannot find module `./AtomGrid`.

- [ ] **Step 3: Implement**

Create `src/ui/progress/AtomGrid.tsx`:

```tsx
import { Text, View } from 'react-native'
import { ATOMS, classify, type AtomClass } from '@/domain/atoms'
import { isReflex, type AtomRecord } from '@/domain/fluency'
import { MAX_FADE } from '@/domain/fade'
import type { Progress } from '@/domain/progress'

export type CellState = 'unseen' | 'learning' | 'reflex' | 'mental'

const CELL_COLOR: Record<CellState, string> = {
  unseen: '#E8E4DC',
  learning: '#F0C36D',
  reflex: '#7FB069',
  mental: '#2E6E4E',
}

export function cellState(
  record: AtomRecord | undefined,
  cls: AtomClass,
  calibrationMs: number,
): CellState {
  if (record === undefined) return 'unseen'
  const fluent = isReflex(record, cls, calibrationMs)
  if (fluent && record.fade >= MAX_FADE) return 'mental'
  if (fluent) return 'reflex'
  return 'learning'
}

export function AtomGrid({ progress }: { progress: Progress }) {
  const states = ATOMS.map((atom) =>
    cellState(progress.atoms[atom.id], classify(atom), progress.calibrationMs),
  )
  const mental = states.filter((s) => s === 'mental').length

  return (
    <View>
      <Text testID="atom-summary">{`${mental} of ${ATOMS.length} moves are mental`}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ATOMS.map((atom, index) => (
          <View
            key={atom.id}
            testID={`atom-cell-${atom.id}`}
            accessibilityLabel={`${atom.id} ${states[index] ?? 'unseen'}`}
            style={{
              width: 16,
              height: 16,
              margin: 1,
              borderRadius: 3,
              backgroundColor: CELL_COLOR[states[index] ?? 'unseen'],
            }}
          />
        ))}
      </View>
    </View>
  )
}
```

Create `app/progress.tsx`:

```tsx
import { Text, View } from 'react-native'
import { useProgress } from '@/ui/ProgressProvider'
import { AtomGrid } from '@/ui/progress/AtomGrid'

export default function ProgressScreen() {
  const { progress, hydrated } = useProgress()
  if (!hydrated) return <Text testID="hydrating">Loading…</Text>
  return (
    <View>
      <Text>{`${progress.daysPracticed} days practised`}</Text>
      <AtomGrid progress={progress} />
    </View>
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- AtomGrid && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/progress app/progress.tsx
git commit -m "feat: add the 180-atom progress map"
```

---

## Task 15: Settings, reset, and final verification

**Files:**
- Create: `app/settings.tsx`
- Test: `__tests__/settings-reset.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `useProgress` from `@/ui/ProgressProvider`
- Produces: the Settings screen

Reset is destructive and irreversible, so it takes two presses — no native modal, because a blocking dialog is both untestable here and needless.

- [ ] **Step 1: Write the failing test**

Create `__tests__/settings-reset.test.tsx`:

```tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Settings from '../app/settings'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 12 })
  mockSave.mockResolvedValue()
})

function renderSettings() {
  return render(
    <ProgressProvider>
      <Settings />
    </ProgressProvider>,
  )
}

describe('Settings', () => {
  it('shows days practised', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain(12))
  })

  it('requires confirmation before resetting', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('reset')).toBeTruthy())
    fireEvent.press(getByTestId('reset'))
    expect(mockSave).not.toHaveBeenCalled()
    expect(getByTestId('reset-confirm')).toBeTruthy()
  })

  it('resets on the second press', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('reset')).toBeTruthy())
    fireEvent.press(getByTestId('reset'))
    fireEvent.press(getByTestId('reset-confirm'))
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(emptyProgress()))
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm test -- settings-reset`
Expected: FAIL — cannot find module `../app/settings`.

- [ ] **Step 3: Implement**

Create `app/settings.tsx`:

```tsx
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useProgress } from '@/ui/ProgressProvider'

export default function Settings() {
  const { progress, hydrated, reset } = useProgress()
  const [confirming, setConfirming] = useState(false)

  if (!hydrated) return <Text testID="hydrating">Loading…</Text>

  return (
    <View>
      <Text testID="days-practiced">{`${progress.daysPracticed} days practised`}</Text>
      {confirming ? (
        <Pressable testID="reset-confirm" accessibilityRole="button" onPress={() => void reset()}>
          <Text>Really erase everything?</Text>
        </Pressable>
      ) : (
        <Pressable testID="reset" accessibilityRole="button" onPress={() => setConfirming(true)}>
          <Text>Reset all progress</Text>
        </Pressable>
      )}
    </View>
  )
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS, all three.

- [ ] **Step 5: Verify on the simulator**

```bash
npm run ios
```

Confirm by hand: the tutorial reads rods; a session runs its four blocks; beads visibly fade as an atom is promoted; the progress grid fills. Fix anything that fails before continuing.

- [ ] **Step 6: Write the README**

Replace `README.md` with a description covering: what the app is, the 180-atom model, the fade ladder, Phase 1 scope and what is deliberately out, prerequisites (Node LTS, Xcode), and `npm install` / `npm run ios` / `npm test`. Link the spec and this plan, following the shape of `learning-database`'s README.

- [ ] **Step 7: Commit**

```bash
git add app/settings.tsx __tests__/settings-reset.test.tsx README.md
git commit -m "feat: add settings with guarded reset, and document Phase 1"
```

---

## Plan Self-Review

Checked against the spec on 2026-09-20.

**Spec coverage.** §2 three dimensions → Tasks 4-6, 8. §3 the 180 atoms → Task 3. §4 fade ladder → Tasks 4, 10. §5 stages → Tasks 6, 13. §6 daily session → Task 8. §7 scheduling → Tasks 5, 6. §8 error handling and absence → Tasks 5, 7 (`markDayPracticed` counts days, never streaks), 11 (`MAX_ATTEMPTS_PER_ATOM`, fade-drop on a high-fade miss). §9 architecture → Tasks 1, 10, 12, 14. §10 testing → the property test in Task 3 and the purity guard in Task 1. §11 Phase 1 scope → Tasks 13-15.

**Known gap, deliberate.** Spec §8 specifies a recalibration session after a gap beyond 14 days. No task implements it; it needs real usage data to tune and cannot be sensibly designed before the app has been used. It is listed below as the first Phase 2 item rather than guessed at here.

**Type consistency.** `AtomRecord`, `FadeLevel`, `AtomClass`, `Progress`, `SessionPlan`, `SessionItem` and `AttemptResult` are each defined in exactly one task and imported by name thereafter. `isReflex(record, cls, calibrationMs)` keeps the same argument order in Tasks 5, 6 and 14. Atom ids use the single format `"3+4"` / `"7-2"`, parsed by the same regex in `progress.ts` and `SessionRunner.tsx`.

**Dependency direction** is strictly one-way: `soroban → atoms → fade → fluency → curriculum → progress → session`, with `storage` and `ui` above all of them. The purity test in Task 1 enforces the boundary.

## Deferred to Phase 2

- Recalibration after a 14-day absence (spec §8)
- Multi-rod operation, 見取算 strings, multiplication, division
- 暗算検定 7-10級 mock exam — the first real external milestone
- Bead-drag interaction (Phase 1 accepts typed answers only)
