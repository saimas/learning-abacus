# Answering with the Beads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At fade levels F0–F2 the learner answers by tapping beads on an enlarged soroban and pressing こたえる. Bead answers are untimed. Borrowing subtractions start at 13, so they can be answered at all. TestFlight build 4 is shipped from the feature branch for the user to try.

**Architecture:** Pure domain functions define the tap rule, the start and expected values, the answer mode per fade level, and untimed attempts. The abacus UI gains a scale and optional tap/adjust handlers, and stays controlled by its parent. `SessionRunner` owns the bead state and switches between bead layout and keypad layout per question.

**Tech Stack:** Expo SDK 57, React Native 0.86 (`Animated`, `Pressable`), expo-router, TypeScript strict, Jest via jest-expo with @testing-library/react-native 13, react-native-svg 15.15.4. The release uses Xcode CLI and the App Store Connect API key.

**Spec:** `docs/superpowers/specs/2026-09-22-bead-interaction-design.md`. The approved layout mockup is `docs/superpowers/specs/2026-09-22-bead-interaction-mockups/bead-layout.html` (layout A).

## Global Constraints

- House style, enforced by ESLint: no semicolons, single quotes (double quotes only to avoid escaping an apostrophe), 2-space indent. No statement may start with `[` or `(`; put the value in a `const` first.
- `src/domain/` changes only in the functions this plan names. `src/domain/purity.test.ts` must keep passing, so domain files import no React, React Native, `@/ui`, `@/storage` or `@/i18n`.
- Every colour comes from `src/ui/theme.ts`, with no hex literals in components. Every user-visible string comes from both `src/i18n/ja.ts` and `src/i18n/en.ts` (`Strings = typeof ja`; `catalogs.test.ts` checks parity).
- No `Date.now()` during render (`react-hooks/purity`). Create Animated values with `useState(() => new Animated.Value(x))` and never `useRef(...).current`. Read refs only in effects and handlers. `useNativeDriver: false`.
- Bead mode applies at F0–F2 only, as decided by `answerModeForFade`. At F3+ the screen is today's keypad layout. The reading drill is unchanged.
- Existing testIDs survive: `prompt`, `demonstration`, `correction`, `correction-problem`, `correction-answer`, `correction-coaching`, `submit`, `session-summary`, `summary-text`, `summary-result`, `finish-button`, `fade-layer`, `abacus-frame`, `abacus-blank`, `rod-<n>` (it keeps `accessibilityValue`), `bead-heaven`, `bead-earth`, `deck-lines`, `frame-rod-<n>`, `unit-dot`, `key-0`…`key-9`, `key-delete`, `maru`, `quit`, `block-label`, `track-segment-<i>`. New testIDs: `reset-beads` (もどす). In bead mode こたえる reuses `submit`.
- Test files that render SessionRunner, Seal (`animateIn`) or anything animated use `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`, as the session tests already do. A pre-existing `act(...)` warning from `src/ui/ProgressProvider.tsx` in some `__tests__` files is not new.
- Commit messages end with a `Co-Authored-By:` line naming the model that wrote the commit.
- Work on the branch `feature/bead-interaction`, which already exists and holds the spec. Do not push, and do not merge. Metro (`npm run ios`) may be running from this checkout; leave it running.
- Run one test file with `npx jest <path>`, and the whole suite with `npm test`. Also run `npm run typecheck` and `npm run lint`.

---

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `src/domain/atoms.ts` (+ test) | modify | `startValue`, `expectedValue` |
| `src/domain/soroban.ts` (+ test) | modify | `BeadRef`, `tapBead`, `tapSoroban`, `adjustRod` |
| `src/domain/fade.ts` (+ test) | modify | `AnswerMode`, `answerModeForFade` |
| `src/domain/fluency.ts` (+ test) | modify | `applyAttempt` accepts `latencyMs: number \| null` |
| `src/domain/progress.ts` (+ test) | modify | `recordAttempt` accepts `latencyMs: number \| null` |
| `src/ui/session/SessionRunner.tsx` | modify | `AttemptResult.latencyMs: number \| null`; start/expected values; bead mode |
| `src/i18n/ja.ts`, `src/i18n/en.ts` (+ catalogs test) | modify | prompts use the start value; `beadHint`, `resetBeads`, `rodName` |
| `src/ui/abacus/geometry.ts` (+ test) | modify | `BEAD_MODE_SCALE`, `geometryFor`, scaled `beadTops`, `beadAt` |
| `src/ui/abacus/Bead.tsx` | rewrite | scaled SVG bead that slides to its `top` |
| `src/ui/abacus/Rod.tsx` | rewrite | static column, or a tappable adjustable one |
| `src/ui/abacus/Frame.tsx` | modify | scaled frame and deck lines |
| `src/ui/abacus/Abacus.tsx` (+ test) | modify | `scale`, `onTapBead`, `onAdjustRod` |
| `src/ui/kit/Button.tsx` (+ kit test) | modify | `disabled` prop |
| `src/ui/session/SessionRunner.test.tsx`, `SessionRunner.integration.test.tsx`, `__tests__/session-screen.test.tsx` | modify | mode-aware answering; bead-mode tests |
| `app.json` | modify | `ios.buildNumber` 3 → 4 (Task 6) |

---

### Task 1: Domain rules for bead answering

**Files:**
- Modify: `src/domain/atoms.ts`, `src/domain/soroban.ts`, `src/domain/fade.ts`
- Test: `src/domain/atoms.test.ts`, `src/domain/soroban.test.ts`, `src/domain/fade.test.ts`

**Interfaces:**
- Consumes: `Atom`, `Rod`, `Soroban`, `rodFor`, `readRod`, `ROD_MAX`, `visualForFade`, `FadeLevel` (all existing).
- Produces:
  - `startValue(atom: Atom): number` and `expectedValue(atom: Atom): number` (atoms.ts)
  - `type BeadRef = { kind: 'heaven' } | { kind: 'earth'; index: number }`; `tapBead(rod: Rod, bead: BeadRef): Rod`; `tapSoroban(s: Soroban, rodIndex: number, bead: BeadRef): Soroban`; `adjustRod(s: Soroban, rodIndex: number, delta: number): Soroban` (soroban.ts)
  - `type AnswerMode = 'beads' | 'keypad'` and `answerModeForFade(level: FadeLevel): AnswerMode` (fade.ts)

- [ ] **Step 1: Write the failing tests**

In `src/domain/atoms.test.ts`, change line 1 to:

```ts
import { ATOMS, atomId, classify, decompose, expectedValue, startValue, type Atom, type Direction } from './atoms'
```

and append:

```ts
function atomOf(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

describe('startValue and expectedValue', () => {
  it('starts where the rod is when nothing is borrowed', () => {
    expect(startValue(atomOf(1, 3, 'add'))).toBe(1)
    expect(expectedValue(atomOf(1, 3, 'add'))).toBe(4)
  })

  it('lets a carry land on the tens rod', () => {
    expect(startValue(atomOf(7, 4, 'add'))).toBe(7)
    expect(expectedValue(atomOf(7, 4, 'add'))).toBe(11)
  })

  it('puts a 1 on the tens rod when a subtraction has to borrow', () => {
    expect(startValue(atomOf(3, 5, 'sub'))).toBe(13)
    expect(expectedValue(atomOf(3, 5, 'sub'))).toBe(8)
  })

  it('does not borrow when the rod has enough', () => {
    expect(startValue(atomOf(6, 4, 'sub'))).toBe(6)
    expect(expectedValue(atomOf(6, 4, 'sub'))).toBe(2)
  })

  it('keeps every answer between 0 and 18', () => {
    for (const atom of ATOMS) {
      const value = expectedValue(atom)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(18)
    }
  })
})
```

In `src/domain/soroban.test.ts`, change line 1 to:

```ts
import { adjustRod, applyStep, emptySoroban, readRod, readValue, rodFor, setValue, tapBead, tapSoroban } from './soroban'
```

and append:

```ts
describe('tapBead', () => {
  it('toggles the heaven bead', () => {
    expect(tapBead(rodFor(2), { kind: 'heaven' })).toEqual(rodFor(7))
    expect(tapBead(rodFor(7), { kind: 'heaven' })).toEqual(rodFor(2))
  })

  it('pushes a resting earth bead to the beam with every bead in between', () => {
    expect(tapBead(rodFor(1), { kind: 'earth', index: 3 })).toEqual(rodFor(4))
  })

  it('lifts only the first resting bead when that is the one tapped', () => {
    expect(tapBead(rodFor(1), { kind: 'earth', index: 1 })).toEqual(rodFor(2))
  })

  it('sends a counted earth bead back with every bead beyond it', () => {
    expect(tapBead(rodFor(4), { kind: 'earth', index: 1 })).toEqual(rodFor(1))
    expect(tapBead(rodFor(9), { kind: 'earth', index: 0 })).toEqual(rodFor(5))
  })

  it('leaves the heaven bead where it is when an earth bead moves', () => {
    expect(tapBead(rodFor(6), { kind: 'earth', index: 2 })).toEqual(rodFor(8))
  })

  it('rejects a bead that does not exist', () => {
    expect(() => tapBead(rodFor(0), { kind: 'earth', index: 4 })).toThrow()
  })
})

describe('tapSoroban', () => {
  it('moves beads only on the rod that was tapped', () => {
    const s = setValue(emptySoroban(2), 7)
    expect(readValue(tapSoroban(s, 0, { kind: 'earth', index: 0 }))).toBe(17)
  })
})

describe('adjustRod', () => {
  it('steps one rod up or down by one', () => {
    const s = setValue(emptySoroban(2), 14)
    expect(readValue(adjustRod(s, 1, 1))).toBe(15)
    expect(readValue(adjustRod(s, 0, -1))).toBe(4)
  })

  it('stays within 0–9', () => {
    expect(readRod(adjustRod(setValue(emptySoroban(1), 9), 0, 1).rods[0] ?? rodFor(0))).toBe(9)
    expect(readRod(adjustRod(setValue(emptySoroban(1), 0), 0, -1).rods[0] ?? rodFor(9))).toBe(0)
  })
})
```

In `src/domain/fade.test.ts`, change line 1 to:

```ts
import { answerModeForFade, coachingForFade, nextFadeLevel, visualForFade } from './fade'
```

and append:

```ts
describe('answerModeForFade', () => {
  it('answers with the beads while they are solid', () => {
    for (const level of [0, 1, 2] as const) expect(answerModeForFade(level)).toBe('beads')
  })

  it('answers on the keypad once the beads fade', () => {
    for (const level of [3, 4, 5, 6] as const) expect(answerModeForFade(level)).toBe('keypad')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/domain/atoms.test.ts src/domain/soroban.test.ts src/domain/fade.test.ts`
Expected: FAIL with `startValue is not a function` (and similarly for `tapBead` and `answerModeForFade`).

- [ ] **Step 3: Implement**

Append to `src/domain/atoms.ts`:

```ts
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
```

Append to `src/domain/soroban.ts`:

```ts
const EARTH_BEADS = 4

// Which bead a tap lands on. Earth bead 0 is the one nearest the beam.
export type BeadRef = { kind: 'heaven' } | { kind: 'earth'; index: number }

// A tap moves beads the way a finger does on a real soroban: pushing a bead
// toward the beam pushes every bead between it and the beam along with it,
// and pulling a counted bead away takes every bead beyond it too.
export function tapBead(rod: Rod, bead: BeadRef): Rod {
  if (bead.kind === 'heaven') return { ...rod, heaven: !rod.heaven }
  if (!Number.isInteger(bead.index) || bead.index < 0 || bead.index >= EARTH_BEADS) {
    throw new Error(`no earth bead at index ${bead.index}`)
  }
  if (bead.index < rod.earth) return { ...rod, earth: bead.index }
  return { ...rod, earth: bead.index + 1 }
}

function replaceRod(s: Soroban, rodIndex: number, change: (rod: Rod) => Rod): Soroban {
  const target = s.rods[rodIndex]
  if (target === undefined) throw new Error(`no rod at index ${rodIndex}`)
  const rods = [...s.rods]
  rods[rodIndex] = change(target)
  return { rods }
}

export function tapSoroban(s: Soroban, rodIndex: number, bead: BeadRef): Soroban {
  return replaceRod(s, rodIndex, (rod) => tapBead(rod, bead))
}

// VoiceOver treats each rod as an adjustable value: one swipe moves it by
// one, staying within 0–9.
export function adjustRod(s: Soroban, rodIndex: number, delta: number): Soroban {
  return replaceRod(s, rodIndex, (rod) => rodFor(Math.min(ROD_MAX, Math.max(0, readRod(rod) + delta))))
}
```

Append to `src/domain/fade.ts`:

```ts
export type AnswerMode = 'beads' | 'keypad'

// While the beads are fully drawn (F0–F2) the learner answers by moving
// them. Once they start to fade, the answer is typed from the image in the
// learner's head. This is the only place that decides.
export function answerModeForFade(level: FadeLevel): AnswerMode {
  return visualForFade(level) === 'solid' ? 'beads' : 'keypad'
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/domain`
Expected: PASS, including `purity.test.ts`.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npm run typecheck && npm run lint`
Expected: pass.

```bash
git add src/domain/atoms.ts src/domain/atoms.test.ts src/domain/soroban.ts src/domain/soroban.test.ts src/domain/fade.ts src/domain/fade.test.ts
git commit -m "feat: add the rules for moving beads and where a problem starts

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 2: Untimed attempts

**Files:**
- Modify: `src/domain/fluency.ts` (`applyAttempt`), `src/domain/progress.ts` (`recordAttempt`), `src/ui/session/SessionRunner.tsx` (the `AttemptResult` type only)
- Test: `src/domain/fluency.test.ts`, `src/domain/progress.test.ts`

**Interfaces:**
- Consumes: existing `applyAttempt`, `recordAttempt`, `latencyTargetMs`, `LATENCY_WINDOW`, `nextFadeLevel`.
- Produces:
  - `applyAttempt(record, cls, correct, latencyMs: number | null, calibrationMs, now)`
  - `recordAttempt(progress, atomId, correct, latencyMs: number | null, now)`
  - `export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number | null }` in SessionRunner.tsx

  `null` means untimed.

- [ ] **Step 1: Write the failing tests**

Append to `src/domain/fluency.test.ts`:

```ts
describe('untimed attempts', () => {
  it('counts an untimed correct answer toward the streak with no speed check', () => {
    const next = applyAttempt(newRecord('3+4', NOW), 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.consecutiveCorrect).toBe(1)
  })

  it('promotes the fade level after five untimed correct answers', () => {
    let record: AtomRecord = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) {
      record = applyAttempt(record, 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    }
    expect(record.fade).toBe(1)
  })

  it('records no latency for an untimed attempt', () => {
    const before: AtomRecord = { ...newRecord('3+4', NOW), recentLatencyMs: [800, 900] }
    const next = applyAttempt(before, 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.recentLatencyMs).toEqual([800, 900])
  })

  it('still resets the box and counts the miss when an untimed answer is wrong', () => {
    const strong: AtomRecord = { ...newRecord('3+4', NOW), box: 4, consecutiveCorrect: 3 }
    const next = applyAttempt(strong, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.box).toBe(1)
    expect(next.consecutiveCorrect).toBe(0)
    expect(next.consecutiveWrong).toBe(1)
  })

  it('demotes after two untimed misses in a row', () => {
    let record: AtomRecord = { ...newRecord('3+4', NOW), fade: 2 }
    record = applyAttempt(record, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    record = applyAttempt(record, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    expect(record.fade).toBe(1)
  })
})
```

Append to `src/domain/progress.test.ts`:

```ts
describe('recordAttempt, untimed', () => {
  it('promotes on accuracy and leaves latency and calibration untouched', () => {
    let p = emptyProgress()
    for (let i = 0; i < 5; i++) p = recordAttempt(p, '1+3', true, null, NOW)
    expect(p.atoms['1+3']?.fade).toBe(1)
    expect(p.atoms['1+3']?.recentLatencyMs).toEqual([])
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/domain/fluency.test.ts src/domain/progress.test.ts`
Expected: at runtime the new tests FAIL on `consecutiveCorrect` or `fade` (`null < target` is `false`). `npm run typecheck` also fails with `Argument of type 'null' is not assignable to parameter of type 'number'`.

- [ ] **Step 3: Implement**

In `src/domain/fluency.ts`, replace the whole `applyAttempt` function with:

```ts
// `latencyMs` is null for an untimed attempt: one answered by moving the
// beads (F0–F2). Speed only becomes a mastery signal once the work is mental,
// so an untimed correct answer counts toward the promotion streak on accuracy
// alone, and its time never reaches the median or the calibration.
export function applyAttempt(
  record: AtomRecord,
  cls: AtomClass,
  correct: boolean,
  latencyMs: number | null,
  calibrationMs: number,
  now: number,
): AtomRecord {
  const box = correct ? Math.min(LEITNER_MAX_BOX, record.box + 1) : 1
  const fastEnough = correct && (latencyMs === null || latencyMs < latencyTargetMs(cls, calibrationMs))
  const consecutiveCorrect = fastEnough ? record.consecutiveCorrect + 1 : 0
  const consecutiveWrong = correct ? 0 : record.consecutiveWrong + 1
  const recentLatencyMs =
    latencyMs === null
      ? record.recentLatencyMs
      : [...record.recentLatencyMs, latencyMs].slice(-LATENCY_WINDOW)
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

In `src/domain/progress.ts`, in `recordAttempt`'s parameter list, change `latencyMs: number,` to `latencyMs: number | null,`.

In `src/ui/session/SessionRunner.tsx`, change:

```ts
export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number }
```

to:

```ts
// latencyMs is null for an untimed attempt (answered with the beads).
export type AttemptResult = { atomId: string; correct: boolean; latencyMs: number | null }
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/domain src/ui/ProgressProvider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full checks, commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

```bash
git add src/domain/fluency.ts src/domain/fluency.test.ts src/domain/progress.ts src/domain/progress.test.ts src/ui/session/SessionRunner.tsx
git commit -m "feat: let bead answers count on accuracy alone

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 3: Problems start at their start value

This task fixes borrowing on the keypad path too. Today `3−5` expects −2.

**Files:**
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`, `src/ui/session/SessionRunner.tsx`, `src/ui/session/SessionRunner.integration.test.tsx`
- Test: `src/i18n/catalogs.test.ts`, `src/ui/session/SessionRunner.test.tsx`

**Interfaces:**
- Consumes: `startValue`, `expectedValue` (Task 1).
- Produces:
  - `strings.prompt(atom)` reads the start value: ja `13から5をひく。`, en `The soroban shows 13. Subtract 5.`
  - new keys `beadHint: string`, `resetBeads: string`, `rodName(place: number): string` (place 0 = ones, 1 = tens)
  - SessionRunner shows `startValue(atom)` and scores against `expectedValue(atom)`.

- [ ] **Step 1: Write the failing tests**

Append to `src/i18n/catalogs.test.ts`:

```ts
describe('prompt', () => {
  it('reads the start value, so a borrowing subtraction starts at 13', () => {
    expect(ja.prompt(atom(3, 5, 'sub'))).toBe('13から5をひく。')
    expect(ja.prompt(atom(7, 4, 'add'))).toBe('7に4をたす。')
    expect(en.prompt(atom(3, 5, 'sub'))).toBe('The soroban shows 13. Subtract 5.')
    expect(en.prompt(atom(7, 4, 'add'))).toBe('The soroban shows 7. Add 4.')
  })
})

describe('rodName', () => {
  it('names the ones and tens rods', () => {
    expect(ja.rodName(0)).toBe('一の位')
    expect(ja.rodName(1)).toBe('十の位')
    expect(en.rodName(0)).toBe('ones rod')
    expect(en.rodName(1)).toBe('tens rod')
  })
})
```

In `src/ui/session/SessionRunner.test.tsx`, inside `describe('SessionRunner', ...)`, add:

```tsx
  it('starts a borrowing subtraction at 13 and accepts 8 on the keypad', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3-5', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    expect(getByTestId('prompt').props.children).toBe('13から5をひく。')
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('1')
    answer(getByTestId, '8')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ atomId: '3-5', correct: true }))
  })
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/i18n/catalogs.test.ts src/ui/session/SessionRunner.test.tsx`
Expected: FAIL. The prompt reads `3から5をひく。`, `rodName` is not a function, and `rod-0` reads `0`.

- [ ] **Step 3: Implement the catalogs**

In `src/i18n/ja.ts`, change the atoms import to include `startValue`:

```ts
import { classify, startValue, type Atom, type AtomClass } from '@/domain/atoms'
```

Replace the `prompt` entry with:

```ts
  prompt: (atom: Atom) =>
    atom.direction === 'add'
      ? `${startValue(atom)}に${atom.operand}をたす。`
      : `${startValue(atom)}から${atom.operand}をひく。`,
```

and add these entries after `deleteKey: '1文字消す',`:

```ts
  beadHint: '珠をタップして動かします',
  resetBeads: 'もどす',
  rodName: (place: number) => (place === 0 ? '一の位' : '十の位'),
```

In `src/i18n/en.ts`, change the atoms import to:

```ts
import { startValue, type Atom } from '@/domain/atoms'
```

Replace the `prompt` entry with:

```ts
  prompt: (atom) =>
    `The soroban shows ${startValue(atom)}. ${atom.direction === 'add' ? 'Add' : 'Subtract'} ${atom.operand}.`,
```

and add after `deleteKey: 'Delete',`:

```ts
  beadHint: 'Tap the beads to move them',
  resetBeads: 'Reset',
  rodName: (place) => (place === 0 ? 'ones rod' : 'tens rod'),
```

- [ ] **Step 4: Use the start and expected values in the runner**

In `src/ui/session/SessionRunner.tsx`:
- Change `import type { Atom } from '@/domain/atoms'` to `import { expectedValue, startValue, type Atom } from '@/domain/atoms'`.
- Replace

```ts
  const { rodValue, operand, sign } = parseAtomId(current.atomId)
  const expected = rodValue + sign * operand
  const atom: Atom = {
    id: current.atomId,
    rodValue,
    operand,
    direction: sign === 1 ? 'add' : 'sub',
  }
```

  with

```ts
  const { rodValue, operand, sign } = parseAtomId(current.atomId)
  const atom: Atom = {
    id: current.atomId,
    rodValue,
    operand,
    direction: sign === 1 ? 'add' : 'sub',
  }
  const expected = expectedValue(atom)
```

- Replace `setValue(emptySoroban(2), rodValue)` with `setValue(emptySoroban(2), startValue(atom))`.

In `src/ui/session/SessionRunner.integration.test.tsx`, change the regex in `expectedFor` from `/^(\d)(?:に|から)(\d)を(たす|ひく)。$/` to `/^(\d{1,2})(?:に|から)(\d)を(たす|ひく)。$/`. The arithmetic after it is unchanged, because the first number is now the start value, so 13 − 5 = 8.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx jest src/i18n src/ui/session`
Expected: PASS.

- [ ] **Step 6: Full checks, commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

```bash
git add src/i18n src/ui/session/SessionRunner.tsx src/ui/session/SessionRunner.test.tsx src/ui/session/SessionRunner.integration.test.tsx
git commit -m "fix: start a borrowing subtraction at 13 so it can be answered

3から5をひく used to expect −2, which no input could produce.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 4: The interactive soroban

**Files:**
- Modify: `src/ui/abacus/geometry.ts`, `src/ui/abacus/Frame.tsx`, `src/ui/abacus/Abacus.tsx`
- Rewrite: `src/ui/abacus/Bead.tsx`, `src/ui/abacus/Rod.tsx`
- Test: `src/ui/abacus/geometry.test.ts`, `src/ui/abacus/Abacus.test.tsx`

**Interfaces:**
- Consumes: `BeadRef` (Task 1); `strings.rodName` (Task 3); `FadeLayer`, `showsFrame` (unchanged).
- Produces:
  - `BEAD_MODE_SCALE = 1.38`
  - `type Geometry` and `geometryFor(scale = 1): Geometry`
  - `beadTops(rod, scale = 1)`
  - `beadAt(rod: Rod, y: number, scale = 1): BeadRef`
  - `Abacus({ soroban, fade, scale?, onTapBead?: (rodIndex, bead: BeadRef) => void, onAdjustRod?: (rodIndex, delta) => void })`
  - An interactive rod is a Pressable with `testID="rod-<n>"`, `accessibilityRole="adjustable"`, `accessibilityLabel`, `accessibilityValue`, and increment/decrement actions.

- [ ] **Step 1: Write the failing geometry tests**

In `src/ui/abacus/geometry.test.ts`, replace the import block with:

```ts
import { rodFor } from '@/domain/soroban'
import {
  BEAD_HEIGHT,
  BEAD_MODE_SCALE,
  BEAM_TOP,
  COLUMN_HEIGHT,
  EARTH_TOP,
  EDGE_GAP,
  beadAt,
  beadTops,
  geometryFor,
} from './geometry'
```

and append:

```ts
describe('geometryFor', () => {
  it('reproduces the base sizes at scale 1', () => {
    const g = geometryFor(1)
    expect(g.beadHeight).toBe(BEAD_HEIGHT)
    expect(g.beamTop).toBe(BEAM_TOP)
    expect(g.earthTop).toBe(EARTH_TOP)
    expect(g.columnHeight).toBe(COLUMN_HEIGHT)
  })

  it('makes bead-mode beads big enough to tap', () => {
    const g = geometryFor(BEAD_MODE_SCALE)
    expect(g.beadWidth).toBeCloseTo(69)
    expect(g.beadHeight).toBeCloseTo(28.98, 1)
    expect(g.rodWidth).toBeCloseTo(88.32, 1)
  })
})

describe('beadTops at a scale', () => {
  it('scales every position', () => {
    const base = beadTops(rodFor(7))
    const big = beadTops(rodFor(7), 2)
    expect(big.heaven).toBe(base.heaven * 2)
    expect(big.earth).toEqual(base.earth.map((top) => top * 2))
  })
})

describe('beadAt', () => {
  it('reads a tap above the beam as the heaven bead', () => {
    expect(beadAt(rodFor(0), 5)).toEqual({ kind: 'heaven' })
  })

  it('reads a tap on a counted earth bead as that bead', () => {
    const top = beadTops(rodFor(3)).earth[1] ?? 0
    expect(beadAt(rodFor(3), top + BEAD_HEIGHT / 2)).toEqual({ kind: 'earth', index: 1 })
  })

  it('reads a tap on a resting earth bead as that bead', () => {
    const top = beadTops(rodFor(1)).earth[3] ?? 0
    expect(beadAt(rodFor(1), top + 2)).toEqual({ kind: 'earth', index: 3 })
  })

  it('picks the nearest bead for a tap in the gap', () => {
    const tops = beadTops(rodFor(2)).earth
    const justBelowBead1 = (tops[1] ?? 0) + BEAD_HEIGHT + 2
    expect(beadAt(rodFor(2), justBelowBead1)).toEqual({ kind: 'earth', index: 1 })
  })

  it('works at bead-mode scale', () => {
    const top = beadTops(rodFor(0), BEAD_MODE_SCALE).earth[0] ?? 0
    expect(beadAt(rodFor(0), top + 5, BEAD_MODE_SCALE)).toEqual({ kind: 'earth', index: 0 })
  })
})
```

In `src/ui/abacus/Abacus.test.tsx`, change the imports to:

```tsx
import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { emptySoroban, rodFor, setValue } from '@/domain/soroban'
import { Abacus } from './Abacus'
import { BEAD_HEIGHT, BEAD_MODE_SCALE, BEAM_TOP, EARTH_TOP, beadTops } from './geometry'
```

and append:

```tsx
describe('interactive Abacus', () => {
  it('reports the bead under a tap', () => {
    const onTapBead = jest.fn()
    const { getByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(2), 7)} fade={0} onTapBead={onTapBead} onAdjustRod={jest.fn()} />,
    )
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(onTapBead).toHaveBeenCalledWith(1, { kind: 'heaven' })

    const top = beadTops(rodFor(0)).earth[0] ?? 0
    fireEvent.press(getByTestId('rod-0'), { nativeEvent: { locationY: top + 3 } })
    expect(onTapBead).toHaveBeenLastCalledWith(0, { kind: 'earth', index: 0 })
  })

  it('makes each rod an adjustable value for VoiceOver', () => {
    const onAdjustRod = jest.fn()
    const { getByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(2), 7)} fade={0} onTapBead={jest.fn()} onAdjustRod={onAdjustRod} />,
    )
    const ones = getByTestId('rod-1')
    expect(ones.props.accessibilityRole).toBe('adjustable')
    expect(ones.props.accessibilityLabel).toBe('一の位')
    expect(getByTestId('rod-0').props.accessibilityLabel).toBe('十の位')

    fireEvent(ones, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(onAdjustRod).toHaveBeenCalledWith(1, 1)
    fireEvent(getByTestId('rod-1'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
    expect(onAdjustRod).toHaveBeenLastCalledWith(1, -1)
  })

  it('has no adjustable rods without handlers', () => {
    const { getByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={0} />)
    expect(getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
  })

  it('draws bead-mode beads larger', () => {
    const { getAllByTestId } = render(
      <Abacus soroban={emptySoroban(1)} fade={0} scale={BEAD_MODE_SCALE} />,
    )
    const style = StyleSheet.flatten(getAllByTestId('bead-earth')[0]?.props.style)
    expect(style.width).toBeCloseTo(69)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/ui/abacus`
Expected: FAIL, with `BEAD_MODE_SCALE`/`geometryFor`/`beadAt` undefined, and the interactive tests fail because the rods have no `onPress`.

- [ ] **Step 3: Implement the geometry**

In `src/ui/abacus/geometry.ts`:
- Change line 1 to `import type { BeadRef, Rod } from '@/domain/soroban'`.
- Keep every existing constant.
- Replace the `beadTops` function and everything after it with:

```ts
// The bead-answering layout draws the soroban 1.38× larger, so beads are big
// enough to tap: 69 × 29 pt on 88 pt rods.
export const BEAD_MODE_SCALE = 1.38

export type Geometry = {
  beadWidth: number
  beadHeight: number
  rodWidth: number
  rodLine: number
  heavenHeight: number
  beamHeight: number
  earthHeight: number
  edgeGap: number
  unitDot: number
  framePadding: number
  frameRadius: number
  deckPadding: number
  beamTop: number
  earthTop: number
  columnHeight: number
}

// Every size above, multiplied by `scale`. Scale 1 is today's soroban.
export function geometryFor(scale = 1): Geometry {
  const heavenHeight = HEAVEN_HEIGHT * scale
  const beamHeight = BEAM_HEIGHT * scale
  const earthHeight = EARTH_HEIGHT * scale
  return {
    beadWidth: BEAD_WIDTH * scale,
    beadHeight: BEAD_HEIGHT * scale,
    rodWidth: ROD_WIDTH * scale,
    rodLine: ROD_LINE * scale,
    heavenHeight,
    beamHeight,
    earthHeight,
    edgeGap: EDGE_GAP * scale,
    unitDot: UNIT_DOT * scale,
    framePadding: FRAME_PADDING * scale,
    frameRadius: FRAME_RADIUS * scale,
    deckPadding: DECK_PADDING * scale,
    beamTop: heavenHeight,
    earthTop: heavenHeight + beamHeight,
    columnHeight: heavenHeight + beamHeight + earthHeight,
  }
}

// A bead counts when it touches the beam. That is how a real soroban is read,
// and it is what the reading drill teaches (梁につけた珠だけを数えます).
// Returns each bead's top offset within its rod's column.
export function beadTops(rod: Rod, scale = 1): { heaven: number; earth: number[] } {
  const g = geometryFor(scale)
  const heaven = rod.heaven ? g.beamTop - g.beadHeight : g.edgeGap
  const earth = [0, 1, 2, 3].map((i) =>
    i < rod.earth
      ? g.earthTop + i * g.beadHeight
      : g.columnHeight - g.edgeGap - (4 - i) * g.beadHeight,
  )
  return { heaven, earth }
}

// Which bead a tap at `y` (points from the top of the rod's column) means.
// Above the middle of the beam it is the heaven bead. Below it, it is the
// earth bead whose centre is nearest, so a tap anywhere on the rod picks one.
export function beadAt(rod: Rod, y: number, scale = 1): BeadRef {
  const g = geometryFor(scale)
  if (y < g.beamTop + g.beamHeight / 2) return { kind: 'heaven' }
  const centres = beadTops(rod, scale).earth.map((top) => top + g.beadHeight / 2)
  let nearest = 0
  centres.forEach((centre, index) => {
    const best = centres[nearest] ?? centre
    if (Math.abs(centre - y) < Math.abs(best - y)) nearest = index
  })
  return { kind: 'earth', index: nearest }
}
```

- [ ] **Step 4: Rewrite Bead and Rod**

Replace `src/ui/abacus/Bead.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg'
import { colors } from '@/ui/theme'
import { geometryFor } from './geometry'

// How long a bead takes to slide to its new place.
export const BEAD_SLIDE_MS = 150

// The soroban bead seen side-on: a bicone, so a flattened hexagon.
function hexagon(width: number, height: number): string {
  const shoulder = width * 0.19
  return [
    `0,${height / 2}`,
    `${shoulder},0`,
    `${width - shoulder},0`,
    `${width},${height / 2}`,
    `${width - shoulder},${height}`,
    `${shoulder},${height}`,
  ].join(' ')
}

// Slides rather than jumps when its place changes. A new place mid-slide
// stops the old slide and heads for the new one. The bead never takes
// touches itself: its rod does.
export function Bead({ kind, top, scale = 1 }: { kind: 'heaven' | 'earth'; top: number; scale?: number }) {
  const g = geometryFor(scale)
  const [y] = useState(() => new Animated.Value(top))
  const shown = useRef(top)

  useEffect(() => {
    if (shown.current === top) return
    shown.current = top
    const slide = Animated.timing(y, { toValue: top, duration: BEAD_SLIDE_MS, useNativeDriver: false })
    slide.start()
    return () => slide.stop()
  }, [top, y])

  return (
    <Animated.View
      testID={`bead-${kind}`}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: y,
        left: (g.rodWidth - g.beadWidth) / 2,
        width: g.beadWidth,
        height: g.beadHeight,
      }}
    >
      <Svg width={g.beadWidth} height={g.beadHeight}>
        <Defs>
          <LinearGradient id="bead" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.beadHighlight} />
            <Stop offset="0.55" stopColor={colors.bead} />
            <Stop offset="1" stopColor={colors.beadShade} />
          </LinearGradient>
        </Defs>
        <Polygon points={hexagon(g.beadWidth, g.beadHeight)} fill="url(#bead)" />
      </Svg>
    </Animated.View>
  )
}
```

Replace `src/ui/abacus/Rod.tsx` with:

```tsx
import { Pressable, View, type GestureResponderEvent } from 'react-native'
import { readRod, type BeadRef, type Rod as RodState } from '@/domain/soroban'
import { Bead } from './Bead'
import { beadAt, beadTops, geometryFor } from './geometry'

// One rod's beads, placed by value. The rod line and beam live in the static
// layer (Frame.tsx), so they survive the fade.
//
// With handlers, the whole column is one tap target (the tap's height picks
// the bead), and VoiceOver treats the rod as an adjustable value.
export function Rod({
  rod,
  index,
  scale = 1,
  label,
  onTapBead,
  onAdjust,
}: {
  rod: RodState
  index: number
  scale?: number
  label?: string
  onTapBead?: (bead: BeadRef) => void
  onAdjust?: (delta: number) => void
}) {
  const g = geometryFor(scale)
  const tops = beadTops(rod, scale)
  const size = { width: g.rodWidth, height: g.columnHeight }
  const value = { text: String(readRod(rod)) }
  const beads = (
    <>
      <Bead kind="heaven" top={tops.heaven} scale={scale} />
      {tops.earth.map((top, i) => (
        <Bead key={i} kind="earth" top={top} scale={scale} />
      ))}
    </>
  )

  if (onTapBead === undefined) {
    return (
      <View testID={`rod-${index}`} accessibilityValue={value} style={size}>
        {beads}
      </View>
    )
  }

  return (
    <Pressable
      testID={`rod-${index}`}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={value}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onAdjust?.(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onPress={(event: GestureResponderEvent) => onTapBead(beadAt(rod, event.nativeEvent.locationY, scale))}
      style={size}
    >
      {beads}
    </Pressable>
  )
}
```

- [ ] **Step 5: Scale the frame and wire Abacus**

In `src/ui/abacus/Frame.tsx`:
- Change the geometry import to `import { geometryFor } from './geometry'`.
- Change `FrameBackground` to take `{ scale = 1 }: { scale?: number }`. Inside it, compute `const g = geometryFor(scale)`, use `g.frameRadius` for `rx`/`ry`, and replace `styles.clip` in its wrapper with `{ borderRadius: g.frameRadius, overflow: 'hidden' }`.
- Change `DeckLines` to take `{ rodCount, scale = 1 }: { rodCount: number; scale?: number }`. Compute `const g = geometryFor(scale)` and derive every position from `g`, replacing the `rodLine`, `beam` and `dot` styles with inline objects:

```tsx
export function DeckLines({ rodCount, scale = 1 }: { rodCount: number; scale?: number }) {
  const g = geometryFor(scale)
  const unit = rodCount - 1
  return (
    <View testID="deck-lines" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: rodCount }, (_, index) => (
        <View
          key={index}
          testID={`frame-rod-${index}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: g.rodLine,
            left: g.deckPadding + index * g.rodWidth + (g.rodWidth - g.rodLine) / 2,
            backgroundColor: colors.rod,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: g.beamTop,
          height: g.beamHeight,
          backgroundColor: colors.beam,
        }}
      />
      <View
        testID="unit-dot"
        style={{
          position: 'absolute',
          top: g.beamTop + (g.beamHeight - g.unitDot) / 2,
          left: g.deckPadding + unit * g.rodWidth + (g.rodWidth - g.unitDot) / 2,
          width: g.unitDot,
          height: g.unitDot,
          borderRadius: g.unitDot / 2,
          backgroundColor: colors.paper,
        }}
      />
    </View>
  )
}
```

- Delete the now-unused `StyleSheet.create` block at the bottom of Frame.tsx. Keep `StyleSheet` imported, since `StyleSheet.absoluteFill` is still used.

Replace `src/ui/abacus/Abacus.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { BeadRef, Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { colors } from '@/ui/theme'
import { FadeLayer, showsFrame } from './FadeLayer'
import { DeckLines, FrameBackground } from './Frame'
import { geometryFor } from './geometry'
import { Rod } from './Rod'

// Controlled: the parent owns the soroban. With onTapBead and onAdjustRod the
// rods take taps and VoiceOver adjustments. Without them it is the static
// soroban the keypad levels show.
export function Abacus({
  soroban,
  fade,
  scale = 1,
  onTapBead,
  onAdjustRod,
}: {
  soroban: Soroban
  fade: FadeLevel
  scale?: number
  onTapBead?: (rodIndex: number, bead: BeadRef) => void
  onAdjustRod?: (rodIndex: number, delta: number) => void
}) {
  const strings = useStrings()
  const g = geometryFor(scale)
  // Visibility resolves here and nowhere else. Bead and Rod never see a FadeLevel.
  const visual = visualForFade(fade)
  const framed = showsFrame(visual)
  const count = soroban.rods.length

  return (
    <View
      testID={framed ? 'abacus-frame' : 'abacus-blank'}
      style={[styles.frame, { padding: g.framePadding, borderRadius: g.frameRadius }, framed && styles.framed]}
    >
      {framed ? <FrameBackground scale={scale} /> : null}
      <View style={[styles.deck, { paddingHorizontal: g.deckPadding }, framed && styles.deckFilled]}>
        {framed ? <DeckLines rodCount={count} scale={scale} /> : null}
        {/* Only the beads fade. At F6 nothing above is drawn, but the bead
            columns still take their space, so the screen does not jump. */}
        <FadeLayer level={fade}>
          <View style={styles.rods}>
            {soroban.rods.map((rod, index) => (
              <Rod
                key={index}
                rod={rod}
                index={index}
                scale={scale}
                label={strings.rodName(count - 1 - index)}
                onTapBead={onTapBead === undefined ? undefined : (bead) => onTapBead(index, bead)}
                onAdjust={onAdjustRod === undefined ? undefined : (delta) => onAdjustRod(index, delta)}
              />
            ))}
          </View>
        </FadeLayer>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  framed: {
    backgroundColor: colors.frameBottom,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  deck: { borderRadius: 8 },
  deckFilled: { backgroundColor: colors.deck },
  rods: { flexDirection: 'row' },
})
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx jest src/ui/abacus src/ui/session src/ui/tutorial`
Expected: PASS. The session and drill tests are unchanged, because they pass no handlers and use scale 1.

- [ ] **Step 7: Full checks, commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

```bash
git add src/ui/abacus
git commit -m "feat: let the soroban take taps and grow for bead answers

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 5: Bead mode in the session

**Files:**
- Modify: `src/ui/kit/Button.tsx`, `src/ui/session/SessionRunner.tsx`
- Test: `src/ui/kit/kit.test.tsx`, `src/ui/session/SessionRunner.test.tsx`, `src/ui/session/SessionRunner.integration.test.tsx`, `__tests__/session-screen.test.tsx`

**Interfaces:**
- Consumes: `answerModeForFade`, `tapSoroban`, `adjustRod`, `readValue`, `startValue`, `expectedValue` (Tasks 1 and 3); `AttemptResult` with `latencyMs: number | null` (Task 2); `Abacus` with `scale`/`onTapBead`/`onAdjustRod` and `BEAD_MODE_SCALE` (Task 4); `strings.beadHint`, `strings.resetBeads` (Task 3).
- Produces:
  - `Button({ ..., disabled?: boolean })`
  - In bead mode: `reset-beads` (もどす), `submit` (こたえる, disabled until a bead moves), an enlarged interactive soroban, and `latencyMs: null` reported.

- [ ] **Step 1: Write the failing Button test**

Append inside `describe('Button', ...)` in `src/ui/kit/kit.test.tsx`:

```tsx
  it('does nothing while disabled, and says so to VoiceOver', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(<Button testID="b" label="こたえる" onPress={onPress} disabled />)
    fireEvent.press(getByTestId('b'))
    expect(onPress).not.toHaveBeenCalled()
    expect(getByTestId('b').props.accessibilityState).toMatchObject({ disabled: true })
  })
```

- [ ] **Step 2: Make the runner tests mode-aware and add bead-mode tests (failing)**

In `src/ui/session/SessionRunner.test.tsx`:

1. Change the first import to:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
```

2. Replace the `answer` helper with:

```tsx
type GetByTestId = ReturnType<typeof render>['getByTestId']

// Sets the two-rod soroban to `value` through each rod's VoiceOver adjust
// action: the same state change a tap makes, without aiming at pixels.
function setBeads(getByTestId: GetByTestId, value: number) {
  const digits = [Math.floor(value / 10), value % 10]
  digits.forEach((digit, rodIndex) => {
    const shown = () => Number(getByTestId(`rod-${rodIndex}`).props.accessibilityValue.text)
    const adjust = (actionName: string) =>
      fireEvent(getByTestId(`rod-${rodIndex}`), 'accessibilityAction', { nativeEvent: { actionName } })
    for (let step = 0; step < 10 && shown() < digit; step++) adjust('increment')
    for (let step = 0; step < 10 && shown() > digit; step++) adjust('decrement')
  })
}

// Answers the current question the way the learner would: on the keypad at
// F3+, or by setting the beads at F0–F2. Then submits.
function answer(getByTestId: GetByTestId, value: string) {
  if (screen.queryByTestId('key-0') !== null) {
    for (const digit of value) fireEvent.press(getByTestId(`key-${digit}`))
  } else {
    setBeads(getByTestId, Number(value))
  }
  fireEvent.press(getByTestId('submit'))
}
```

3. The test `'reports a correct attempt with the measured latency'` uses `basicPlan`, which is F0 (bead mode, untimed). Replace its body with:

```tsx
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const clock = manualClock(0)
    const { getByTestId, onAttempt } = renderRunner(plan, clock.now)
    clock.set(3_000)
    answer(getByTestId, '7')
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: '3+4', correct: true, latencyMs: 3_000 }),
    )
```

4. Append a new describe block at the end of the file:

```tsx
describe('SessionRunner answering with beads', () => {
  const twoItems: SessionPlan = {
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }

  it('shows a soroban to answer on, and no keypad, while the beads are solid', () => {
    const { getByTestId, queryByTestId } = renderRunner(basicPlan, autoClock())
    expect(queryByTestId('key-0')).toBeNull()
    expect(getByTestId('rod-1').props.accessibilityRole).toBe('adjustable')
    expect(getByTestId('reset-beads')).toBeTruthy()
  })

  it('answers on the keypad once the beads fade', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    expect(getByTestId('key-0')).toBeTruthy()
    expect(queryByTestId('reset-beads')).toBeNull()
  })

  it('moves the beads under a tap', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    // 3 on the ones rod; a tap above the beam brings the heaven bead down.
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('8')
  })

  it('keeps こたえる disabled until a bead moves', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
    fireEvent.press(getByTestId('submit'))
    expect(onAttempt).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: false })
  })

  it('puts the beads back with もどす', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    fireEvent.press(getByTestId('reset-beads'))
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('3')
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('scores the value on the beads, untimed', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    answer(getByTestId, '7')
    expect(onAttempt).toHaveBeenCalledWith({ atomId: '3+4', correct: true, latencyMs: null })
  })

  it('sets the beads back to the start for the next question', () => {
    const { getByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '7')
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('2')
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('starts a borrowing subtraction at 13 and accepts 8 on the beads', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3-5')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('1')
    answer(getByTestId, '8')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ atomId: '3-5', correct: true }))
  })

  it('still names the previous problem after a wrong bead answer', () => {
    const { getByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('correction-problem').props.children).toBe('3に4をたす。')
  })
})
```

In `src/ui/session/SessionRunner.integration.test.tsx`, inside `playSession`, replace:

```tsx
    for (const digit of String(expectedFor(prompt))) fireEvent.press(getByTestId(`key-${digit}`))
    fireEvent.press(getByTestId('submit'))
```

with:

```tsx
    const value = expectedFor(prompt)
    if (queryByTestId('key-0') !== null) {
      for (const digit of String(value)) fireEvent.press(getByTestId(`key-${digit}`))
    } else {
      // F0–F2: set the beads through each rod's VoiceOver adjust action.
      const digits = [Math.floor(value / 10), value % 10]
      digits.forEach((digit, rodIndex) => {
        const shown = () => Number(getByTestId(`rod-${rodIndex}`).props.accessibilityValue.text)
        const adjust = (actionName: string) =>
          fireEvent(getByTestId(`rod-${rodIndex}`), 'accessibilityAction', { nativeEvent: { actionName } })
        for (let step = 0; step < 10 && shown() < digit; step++) adjust('increment')
        for (let step = 0; step < 10 && shown() > digit; step++) adjust('decrement')
      })
    }
    fireEvent.press(getByTestId('submit'))
```

In `__tests__/session-screen.test.tsx`, in `'runs a session once hydrated'`, replace:

```tsx
    fireEvent.press(getByTestId('key-1'))
    fireEvent.press(getByTestId('submit'))
```

with:

```tsx
    // A first-day question is at F0, so it is answered on the beads.
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    fireEvent.press(getByTestId('submit'))
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx jest src/ui/kit src/ui/session __tests__/session-screen.test.tsx`
Expected: FAIL. `disabled` has no effect, `reset-beads` is not found, and `rod-1` is not adjustable in the session.

- [ ] **Step 4: Add `disabled` to Button**

In `src/ui/kit/Button.tsx`:
- Add `disabled = false,` to the destructured props, and `disabled?: boolean` to the prop type.
- On the `Pressable`, add `disabled={disabled}` and `accessibilityState={{ disabled }}`.
- Add `disabled && styles.disabled` as the last entry in the style array.
- Add `disabled: { opacity: 0.45 },` to `StyleSheet.create`.

- [ ] **Step 5: Add bead mode to SessionRunner**

In `src/ui/session/SessionRunner.tsx`:

1. Imports. Change the fade import to `import { answerModeForFade, type FadeLevel } from '@/domain/fade'`. Change the soroban import to:

```ts
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
```

and add `import { BEAD_MODE_SCALE } from '@/ui/abacus/geometry'`.

2. State. Directly after `const [maru, setMaru] = useState(0)`, add:

```ts
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
```

3. Per-question values. Directly after the line `const expected = expectedValue(atom)`, add:

```ts
  const mode = answerModeForFade(current.fade)
  const start = setValue(emptySoroban(2), startValue(atom))
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn one of the atom's attempts.
  const moved = readValue(shownBeads) !== startValue(atom)
```

4. In `submit()`, replace:

```ts
    const given = parseAnswer(answer)
    if (given === null) return

    const t = now()
    const latencyMs = Math.max(0, t - shownAt.current)
```

with:

```ts
    const given = mode === 'beads' ? (moved ? readValue(shownBeads) : null) : parseAnswer(answer)
    if (given === null) return

    const t = now()
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt.current)
```

and replace the line `setAnswer('')` with:

```ts
    setAnswer('')
    setBeads(null)
```

5. Rendering. Replace everything from the practice `return (` (the one that renders `<View style={styles.practice}>`) to the end of the component with:

```tsx
  const demonstration =
    current.coaching === 'demo' ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss.
      <Text testID="demonstration" style={styles.demonstration}>
        {strings.coaching(atom)}
      </Text>
    ) : null
  const correctionCard =
    correction !== null ? (
      <CorrectionCard atom={correction.atom} expected={correction.expected} />
    ) : null
  const track = (
    <SessionTrack
      segments={segments}
      label={strings.blockLabel(block.kind)}
      quitLabel={strings.quitLabel}
      onQuit={onQuit}
    />
  )

  if (mode === 'beads') {
    // Layout A: the soroban takes the keypad's place, enlarged and within
    // thumb reach. Only the text above it scrolls, so the soroban and both
    // buttons stay on screen even on a 375 × 667 phone.
    return (
      <View style={styles.practice}>
        {track}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text testID="prompt" style={styles.prompt}>
            {strings.prompt(atom)}
          </Text>
          {demonstration}
          {correctionCard}
        </ScrollView>
        <View style={styles.sorobanWrap}>
          <Abacus
            soroban={shownBeads}
            fade={current.fade}
            scale={BEAD_MODE_SCALE}
            onTapBead={(rodIndex, bead) => setBeads((previous) => tapSoroban(previous ?? start, rodIndex, bead))}
            onAdjustRod={(rodIndex, delta) => setBeads((previous) => adjustRod(previous ?? start, rodIndex, delta))}
          />
          {maru > 0 ? (
            <View style={styles.beadMaru}>
              <Maru key={maru} />
            </View>
          ) : null}
        </View>
        <Text style={styles.hint}>{strings.beadHint}</Text>
        <View style={styles.beadButtons}>
          <View style={styles.resetSlot}>
            <Button
              testID="reset-beads"
              variant="outline"
              label={strings.resetBeads}
              onPress={() => setBeads(null)}
            />
          </View>
          <View style={styles.submitSlot}>
            <Button testID="submit" label={strings.answer} disabled={!moved} onPress={submit} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.practice}>
      {track}
      {/* R9: the keypad below is always fully visible, pinned at the bottom.
          Everything here that can grow scrolls instead of pushing the keypad
          off a short screen. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.soroban}>
          <Abacus soroban={start} fade={current.fade} />
        </View>
        <Text testID="prompt" style={styles.prompt}>
          {strings.prompt(atom)}
        </Text>
        {demonstration}
        {correctionCard}
      </ScrollView>
      <AnswerPad
        value={answer}
        onChange={setAnswer}
        onSubmit={submit}
        submitLabel={strings.answer}
        submitTestID="submit"
        adornment={maru > 0 ? <Maru key={maru} /> : null}
      />
    </View>
  )
}
```

6. Styles. Add these entries to `StyleSheet.create`, leaving the existing ones unchanged:

```ts
  sorobanWrap: { alignSelf: 'center', marginTop: space.sm },
  beadMaru: { position: 'absolute', top: -space.sm, right: -space.md },
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  beadButtons: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx jest src/ui/kit src/ui/session __tests__/session-screen.test.tsx`
Expected: PASS, with no `act(...)` warnings from the runner tests (they already use fake timers).

- [ ] **Step 7: Full checks, commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass.

```bash
git add src/ui/kit/Button.tsx src/ui/kit/kit.test.tsx src/ui/session __tests__/session-screen.test.tsx
git commit -m "feat: answer with the beads while they are solid

At F0–F2 the keypad gives way to an enlarged soroban with もどす and
こたえる; the value on the beads is the answer, untimed.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 6: Check on the simulator, then TestFlight build 4

**Files:**
- Modify: `app.json` (`ios.buildNumber` → `"4"`), `docs/superpowers/specs/2026-09-22-bead-interaction-design.md` (Status line)
- Scratch only, not committed: `$SCRATCH=/private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/bead`

**Interfaces:**
- Consumes: the whole app. Simulators: iPhone 17 Pro `F04F4F02-42DD-4A32-828E-C06E0DF317B9` and an iPhone SE (3rd generation) created earlier (`xcrun simctl list devices | grep "SE (3rd"`). Maestro: `~/.maestro/bin/maestro`. Release process: `docs/release-ios.md`. App Store Connect polling script: `/private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/asc-builds.mjs` (`node <path>` prints `version processingState uploadedDate` for the latest builds).

- [ ] **Step 1: Full automated checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass. Record the counts.

- [ ] **Step 2: Look at bead mode on the iPhone 17 Pro**

Make sure Metro is serving this branch, then reload with `xcrun simctl openurl F04F4F02-42DD-4A32-828E-C06E0DF317B9 exp://127.0.0.1:8081`. The learner must reach a session: finish the reading drill if it shows (values 1 4 5 6 9 3 8 2 7 0), then tap `start`. Screenshot each state with `xcrun simctl io <udid> screenshot $SCRATCH/<name>.png` and Read each PNG:
1. `01-bead-start`: the first question in bead mode, with the enlarged soroban, hint, もどす and a disabled こたえる.
2. `02-bead-moved`: after tapping a bead. The bead slid, and こたえる is enabled.
3. `03-bead-reset`: after もどす. The beads are back, and こたえる is disabled again.
4. `04-bead-wrong`: after a wrong answer, with the correction card naming the previous problem.
5. `05-bead-right`: after a correct answer, with the 〇 at the soroban's top right and the next question's beads at its start value.

Maestro can drive this: `tapOn: { id: "rod-1" }` taps the middle of a rod, `tapOn: { id: "reset-beads" }`, `tapOn: { id: "submit" }`. For a specific bead, read the rod's bounds from `~/.maestro/bin/maestro hierarchy` and use `tapOn: { point: "<x>,<y>" }`. Expo Go's floating gear button can cover the top right; it is draggable.

Compare the screenshots with `docs/superpowers/specs/2026-09-22-bead-interaction-mockups/bead-layout.html` (layout A). Fix any layout mismatch in `SessionRunner.tsx` (styles) or the abacus, rerun `npx jest src/ui`, re-shoot, and commit each fix separately.

- [ ] **Step 3: Check the small screen**

Open the app on the iPhone SE simulator and screenshot `06-se-bead-mode`. Confirm the whole soroban, the hint, もどす and こたえる are on screen. (This simulator has frozen its display after taps before; if it does again, record what `maestro hierarchy` shows for `submit` and `reset-beads`, which should be in bounds.)

- [ ] **Step 4: Bump the build number and commit**

In `app.json` change `"buildNumber": "3"` to `"buildNumber": "4"`.

```bash
git add app.json
git commit -m "Bump the iOS build number to 4

TestFlight build 4: answering with the beads, from feature/bead-interaction.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 5: Build and upload, following docs/release-ios.md**

```bash
CI=1 npx expo prebuild --platform ios
git checkout package.json        # prebuild rewrites scripts.ios to "expo run:ios"; this repo uses "expo start --ios"
git status --short               # must be clean
rm -rf ios/build/DerivedData ios/build/LearningAbacus.xcarchive
```

Archive (about 15 minutes; run it in the background and capture the log in `$SCRATCH/archive.log`), using the exact `xcodebuild archive …` command from `docs/release-ios.md` step 3. Expected: `** ARCHIVE SUCCEEDED **`.

Then check the archive before uploading:

```bash
APP=ios/build/LearningAbacus.xcarchive/Products/Applications/LearningAbacus.app
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Info.plist"     # expect 4
for fw in $(otool -L "$APP/LearningAbacus" | sed -n 's|.*@rpath/\([^/]*\.framework\)/.*|\1|p'); do
  [ -d "$APP/Frameworks/$fw" ] || echo "MISSING: $fw — do not upload"
done
python3 -c "b=open('$APP/main.jsbundle','rb').read(); print('珠をタップして動かします'.encode('utf-16-le') in b)"   # expect True (Hermes stores non-ASCII as UTF-16)
```

Expected: build 4, no `MISSING`, and `True`. Then run the `xcodebuild -exportArchive …` command from `docs/release-ios.md` step 4. Expected: `Upload succeeded` and `** EXPORT SUCCEEDED **`. The three missing-dSYM warnings (React, ReactNativeDependencies, hermesvm) are expected.

- [ ] **Step 6: Wait for processing**

Poll every 45 s for up to 30 min with `node /private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/asc-builds.mjs` until the line for version `4` shows `VALID`. If it shows `INVALID` or `FAILED`, stop and report it.

- [ ] **Step 7: Mark the spec and commit**

Change the spec's Status line to `Status: Implemented on feature/bead-interaction (TestFlight build 4)`.

```bash
git add docs/superpowers/specs/2026-09-22-bead-interaction-design.md
git commit -m "docs: mark answering with the beads as implemented

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 8: Report**

Report:
- the test counts;
- each screenshot and what it shows;
- any fixes made;
- the build 4 processing state.

Do not push the branch and do not merge.
