# Reviewing a Wrong Answer (✕ and the correct bead moves) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a wrong answer the question stays on screen under a big ✕. The learner can press こたえを見る to watch the correct bead moves play on the same soroban, then presses つぎへ to move on. TestFlight build 7 ships from the feature branch.

**Architecture:** Two pure domain functions supply the replay: `moveStates` (the soroban after each step) and `describeStepParts` (the text of each step). Three small UI units sit on top: `Batsu` (the ✕, sharing its animation with `Maru` through `useStamp`), `useMoveReplay` (the step timer) and an answer card whose steps are separate spans. `SessionRunner.submit()` is split in two. Scoring runs on every answer. Advancing runs at once after a correct answer, and from つぎへ after a miss.

**Tech Stack:** Expo SDK 57, React Native 0.86 (`Animated`), TypeScript strict (`noUncheckedIndexedAccess`), Jest via jest-expo with @testing-library/react-native 13.3 (`renderHook` and `act` are available). The release uses the Xcode CLI and an App Store Connect API key.

**Spec:** `docs/superpowers/specs/2026-09-22-miss-review-design.md`. The approved mockup is `docs/superpowers/specs/2026-09-22-miss-review-mockups/miss-review.html`.

**Interface refinements from the spec (decided while planning):**
- `useMoveReplay()` takes no argument and returns `{ soroban, step, play(states), stop() }`.
  - `play` receives the states, so nothing depends on array identity between renders.
  - `stop` lets つぎへ cut a replay short.
  - The spec's `playing` flag is left out because nothing reads it.
- The runner's review state is `{ cardShown: boolean }`. The question under review is still `state.queue[0]`, so the atom and expected value come from there, and the replay lives in the hook.
- The `n / total` counter is a catalog string, `replayStep(step, total)`, because every user-visible string comes from the catalogs.
- The step highlight colour is a new theme token, `accentSoft` (`#F6DDD6`, taken from the mockup).

## Global Constraints

- **House style, enforced by ESLint:** no semicolons; single quotes (double quotes only to avoid escaping an apostrophe); 2-space indent. No statement may start with `[` or `(`; put the value in a `const` first.
- **Domain:** `src/domain/` changes only in the functions this plan names. `src/domain/purity.test.ts` must keep passing, so domain files import no React, React Native, `@/ui`, `@/storage` or `@/i18n`.
- **Colours and strings:**
  - Every colour comes from `src/ui/theme.ts`; components contain no hex literals.
  - Every user-visible string comes from both `src/i18n/ja.ts` and `src/i18n/en.ts` (`Strings = typeof ja`; `catalogs.test.ts` checks parity).
- **Render rules:**
  - No `Date.now()` during render (`react-hooks/purity`); the runner's `now()` is called only in handlers.
  - Create Animated values with `useState(() => new Animated.Value(x))`, never with `useRef(...).current`.
  - Set no state synchronously inside an effect body.
  - `useNativeDriver: false`.
- **Behaviour that must not change:**
  - `onAttempt` is called exactly once per answer, at submit, and never at つぎへ.
  - Scoring, fluency, stored progress, the reserve join, deadlines, the bead/keypad split (`answerModeForFade`), the three-failure cap, and the F4+ one-level-lower retry.
  - A correct answer still shows the 〇 and the next question at once.
  - The reading drill is untouched.
- **Exact values:**
  - Replay step: 900 ms.
  - Stamp timing: pop 120 ms, hold 450 ms, fade 250 ms.
  - Stamp stroke: `Math.round(size * 0.07)`.
  - Stamp size: 140 in bead mode, 110 in keypad mode.
  - ✕ tilt: `-6deg`, with strokes at ±45°. 〇 tilt: `-8deg` (unchanged).
- **Strings** (exact):

  | Key | ja | en |
  |---|---|---|
  | `showAnswer` | `こたえを見る` | `Show the answer` |
  | `watchAgain` | `もう一度見る` | `Watch again` |
  | `next` | `つぎへ` | `Next` |
  | `wrong` | `ちがいます` | `Not quite` |
  | `replayStep(step, total)` | `` `${step} / ${total}` `` | `` `${step} / ${total}` `` |
  | `coachingLead(atom)` | e.g. `十の繰上：8をたす = ` | e.g. `Add 8 = ` |

  `previousProblem` is removed (Task 5).
- **testIDs:**
  - These survive: `prompt`, `demonstration`, `correction`, `correction-answer`, `correction-coaching`, `submit`, `reset-beads`, `soroban-wrap`, `maru`, `session-summary`, `summary-text`, `summary-result`, `finish-button`, `fade-layer`, `abacus-frame`, `abacus-blank`, `rod-<n>` (it keeps `accessibilityValue`), `key-0`…`key-9`, `key-delete`, `quit`, `block-label`, `track-segment-<i>`.
  - Removed: `correction-problem`.
  - New: `batsu`, `batsu-stroke`, `review-show`, `review-next`, `replay-step`, `correction-step-<i>`.
- **Tests:**
  - Test files that render SessionRunner, `Maru`, `Batsu` or anything animated use `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`. (A probe confirmed that `Animated.timing` settles under fake timers here.)
  - A pre-existing `act(...)` warning from `src/ui/ProgressProvider.tsx` in some `__tests__` files is not new.
- **Commits:** every commit message ends with a `Co-Authored-By:` line naming the model that wrote the commit.
- **Branch:** work on `feature/miss-review`, which already exists and holds the spec and this plan. Do not push, do not merge, and do not touch simulators (Task 6 is the controller's). Metro may be running from this checkout; leave it running.
- **Commands:** run one test file with `npx jest <path>` and the whole suite with `npm test`. Also run `npm run typecheck` and `npm run lint`. Lint has one known warning in `src/ui/kit/kit.test.tsx`.

---

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `src/domain/atoms.ts` (+ test) | modify | `moveStates(atom)`: the soroban at the start and after each step |
| `src/domain/explain.ts` (+ test) | modify | `describeStepParts(atom)`; `describeSteps` joins it |
| `src/i18n/ja.ts`, `src/i18n/en.ts` (+ `catalogs.test.ts`) | modify | `coachingLead`, `showAnswer`, `watchAgain`, `next`, `wrong`, `replayStep`; `previousProblem` removed in Task 5 |
| `src/ui/session/useStamp.ts` | create | the shared pop/hold/fade of the 〇 and ✕ |
| `src/ui/session/Maru.tsx` | modify | uses `useStamp` (no visible change) |
| `src/ui/session/Batsu.tsx` (+ test) | create | the ✕ stamp |
| `src/ui/session/useMoveReplay.ts` (+ test) | create | steps through a move's states every 900 ms |
| `src/ui/theme.ts` | modify | `accentSoft` |
| `src/ui/session/testing.ts` | modify | `textOf(node)` for tests |
| `src/ui/session/CorrectionCard.tsx` (+ new test) | modify | steps as separate spans with `activeStep`; header removed in Task 5 |
| `src/ui/session/SessionRunner.tsx` (+ test) | modify | scoring/advance split; the review state and its UI |
| `app.json`, the spec | modify | build 7; Status line |

---

### Task 1: The move, state by state and step by step (domain)

**Files:**
- Modify: `src/domain/atoms.ts`
- Modify: `src/domain/explain.ts`
- Test: `src/domain/atoms.test.ts`, `src/domain/explain.test.ts`

**Interfaces:**
- Consumes: `decompose(atom): RodStep[]`, `startValue(atom)`, `expectedValue(atom)` (atoms.ts); `applyStep(s, step, workingIndex)`, `setValue(s, n)`, `emptySoroban(n)`, `readValue(s)` (soroban.ts).
- Produces:
  - `moveStates(atom: Atom): Soroban[]` exported from `src/domain/atoms.ts`. It returns `decompose(atom).length + 1` two-rod sorobans. The first reads `startValue(atom)` and the last reads `expectedValue(atom)`.
  - `describeStepParts(atom: Atom): string[]` exported from `src/domain/explain.ts`, with one entry per `decompose` step, e.g. `['+10', '− 2']`.
  - `describeSteps(atom)` keeps its signature and output.

- [ ] **Step 1: Write the failing tests**

In `src/domain/atoms.test.ts`, change the first import line to add `moveStates`:

```ts
import { ATOMS, atomId, classify, decompose, expectedValue, moveStates, startValue, type Atom, type Direction } from './atoms'
```

Then append at the end of the file:

```ts
// Spec (miss review) §3: what こたえを見る plays on the soroban.
describe('moveStates', () => {
  const values = (a: Atom) => moveStates(a).map(readValue)

  it('plays a direct move in one step', () => {
    expect(values(atomOf(1, 3, 'add'))).toEqual([1, 4])
  })

  it("plays a 5's complement as its two steps", () => {
    expect(values(atomOf(3, 4, 'add'))).toEqual([3, 8, 7])
  })

  it('carries onto the tens rod before correcting the ones rod', () => {
    expect(values(atomOf(7, 8, 'add'))).toEqual([7, 17, 15])
  })

  it('borrows from the tens rod of a subtraction set at 13', () => {
    expect(values(atomOf(3, 5, 'sub'))).toEqual([13, 3, 8])
  })

  it('has the start, one state per step, and ends on the answer, for every atom', () => {
    for (const atom of ATOMS) {
      const states = moveStates(atom)
      expect(states).toHaveLength(decompose(atom).length + 1)
      const shown = states.map(readValue)
      expect(shown[0]).toBe(startValue(atom))
      expect(shown[shown.length - 1]).toBe(expectedValue(atom))
      for (const state of states) expect(state.rods).toHaveLength(2)
    }
  })
})
```

In `src/domain/explain.test.ts`, replace the two import lines with:

```ts
import { ATOMS, atomId, classify, decompose, type Atom, type Direction } from './atoms'
import { describeStepParts, describeSteps } from './explain'
```

Then append at the end of the file:

```ts
describe('describeStepParts', () => {
  it('gives each step its own part, signed as describeSteps reads it', () => {
    expect(describeStepParts(atom(1, 3, 'add'))).toEqual(['+3'])
    expect(describeStepParts(atom(7, 8, 'add'))).toEqual(['+10', '− 2'])
    expect(describeStepParts(atom(2, 6, 'sub'))).toEqual(['−10', '+ 5', '− 1'])
  })

  it('has one part per step of the move, for every atom', () => {
    for (const a of ATOMS) {
      expect(describeStepParts(a)).toHaveLength(decompose(a).length)
    }
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/domain/atoms.test.ts src/domain/explain.test.ts`
Expected: FAIL, because `moveStates` and `describeStepParts` are not exported (TypeScript error, or "is not a function").

- [ ] **Step 3: Implement `moveStates`**

In `src/domain/atoms.ts`, replace the first line

```ts
import type { RodStep } from './soroban'
```

with

```ts
import { applyStep, emptySoroban, setValue, type RodStep, type Soroban } from './soroban'
```

and append at the end of the file:

```ts
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
```

- [ ] **Step 4: Implement `describeStepParts`**

In `src/domain/explain.ts`, replace everything from the comment `// Reads as arithmetic does:` to the end of the file with:

```ts
// One part per step, so a replay can point at the step it has just played.
// Reads as arithmetic does: the first term carries its sign, and every step
// after it is an operator applied to what came before — "+10", "− 2", not
// "+10", "-2".
export function describeStepParts(atom: Atom): string[] {
  return decompose(atom)
    .map(amountOf)
    .map((amount, index) =>
      index === 0
        ? `${sign(amount)}${Math.abs(amount)}`
        : `${sign(amount)} ${Math.abs(amount)}`,
    )
}

// The whole move on one line: "+10 − 2".
export function describeSteps(atom: Atom): string {
  return describeStepParts(atom).join(' ')
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx jest src/domain`
Expected: PASS. This includes the existing `describeSteps` tests (output unchanged) and `purity.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/domain/atoms.ts src/domain/atoms.test.ts src/domain/explain.ts src/domain/explain.test.ts
git commit -m "feat: break a move into its soroban states and step texts

moveStates(atom) is what こたえを見る will replay; describeStepParts(atom)
is the text of each step, so the card can highlight the one just played.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 2: Strings for the review step

**Files:**
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`
- Test: `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes: `describeSteps(atom)` (unchanged output).
- Produces, in both catalogs:
  - `coachingLead(atom: Atom): string`, such that `coachingLead(atom) + describeSteps(atom) === coaching(atom)`;
  - `showAnswer`, `watchAgain`, `next`, `wrong` (strings);
  - `replayStep(step: number, total: number): string`.
  - `previousProblem` stays until Task 5.

- [ ] **Step 1: Write the failing tests**

In `src/i18n/catalogs.test.ts`, add this import after the first import line:

```ts
import { describeSteps } from '@/domain/explain'
```

and append at the end of the file:

```ts
// Spec (miss review) §5: the answer card prints the lead, then each step as
// its own span, and has to read exactly as the coaching sentence does.
describe('coachingLead', () => {
  it('is the coaching sentence up to its steps, for all 180 atoms in both locales', () => {
    for (const a of ATOMS) {
      expect(`${ja.coachingLead(a)}${describeSteps(a)}`).toBe(ja.coaching(a))
      expect(`${en.coachingLead(a)}${describeSteps(a)}`).toBe(en.coaching(a))
    }
  })

  it('names the technique and the move', () => {
    expect(ja.coachingLead(atom(7, 8, 'add'))).toBe('十の繰上：8をたす = ')
    expect(ja.coachingLead(atom(1, 3, 'add'))).toBe('3をたす = ')
    expect(en.coachingLead(atom(7, 8, 'add'))).toBe('Add 8 = ')
  })
})

describe('the review step', () => {
  it('labels its buttons and announces a miss', () => {
    expect(ja.showAnswer).toBe('こたえを見る')
    expect(ja.watchAgain).toBe('もう一度見る')
    expect(ja.next).toBe('つぎへ')
    expect(ja.wrong).toBe('ちがいます')
    expect(en.showAnswer).toBe('Show the answer')
    expect(en.watchAgain).toBe('Watch again')
    expect(en.next).toBe('Next')
    expect(en.wrong).toBe('Not quite')
  })

  it('counts the steps of a replay', () => {
    expect(ja.replayStep(1, 2)).toBe('1 / 2')
    expect(en.replayStep(1, 2)).toBe('1 / 2')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/i18n/catalogs.test.ts`
Expected: FAIL, because `coachingLead` is not a function and `showAnswer` is undefined.

- [ ] **Step 3: Implement in `src/i18n/ja.ts`**

Replace the existing `coaching` function (from `function coaching(atom: Atom): string {` to its closing `}`) with:

```ts
// Everything in the coaching sentence before the steps themselves, so the
// answer card can set each step apart and highlight the one being replayed.
function coachingLead(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction]
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = `
  return name === '' ? move : `${name}：${move}`
}

function coaching(atom: Atom): string {
  return `${coachingLead(atom)}${describeSteps(atom)}`
}
```

The comment above it, `// Declared as a function rather than inline on the object: …`, stays where it is, above `coachingLead`.

In the `ja` object:
- after the line `  coaching,` add `  coachingLead,`;
- after the line `  correct: '正解',` add `  wrong: 'ちがいます',`;
- after the line `  resetBeads: 'もどす',` add:

```ts
  showAnswer: 'こたえを見る',
  watchAgain: 'もう一度見る',
  next: 'つぎへ',
  replayStep: (step: number, total: number) => `${step} / ${total}`,
```

- [ ] **Step 4: Implement in `src/i18n/en.ts`**

Replace the existing `coaching` function with:

```ts
function coachingLead(atom: Atom): string {
  const verb = atom.direction === 'add' ? 'Add' : 'Subtract'
  return `${verb} ${atom.operand} = `
}

function coaching(atom: Atom): string {
  return `${coachingLead(atom)}${describeSteps(atom)}`
}
```

Keep the comment above it (`// English names no technique: …`).

In the `en` object:
- after `  coaching,` add `  coachingLead,`;
- after `  correct: 'Correct',` add `  wrong: 'Not quite',`;
- after `  resetBeads: 'Reset',` add:

```ts
  showAnswer: 'Show the answer',
  watchAgain: 'Watch again',
  next: 'Next',
  replayStep: (step, total) => `${step} / ${total}`,
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx jest src/i18n && npm run typecheck`
Expected: PASS. Parity and arity tests included; the existing `coaching` tests are unchanged and pass.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/ja.ts src/i18n/en.ts src/i18n/catalogs.test.ts
git commit -m "feat: add the strings for reviewing a wrong answer

こたえを見る / もう一度見る / つぎへ / ちがいます, the replay step counter, and
coachingLead, the coaching sentence before its steps.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 3: The ✕ stamp and the replay timer

**Files:**
- Create: `src/ui/session/useStamp.ts`, `src/ui/session/Batsu.tsx`, `src/ui/session/useMoveReplay.ts`
- Modify: `src/ui/session/Maru.tsx`
- Test: `src/ui/session/Batsu.test.tsx`, `src/ui/session/useMoveReplay.test.ts`

**Interfaces:**
- Consumes: `colors.accent` (theme); `Soroban` (domain type); `setValue`, `emptySoroban`, `readValue` in tests.
- Produces:
  - `useStamp(): { scale: Animated.Value; opacity: Animated.Value }` and `STAMP_STROKE_RATIO = 0.07` from `./useStamp`;
  - `Batsu({ size = 140 }: { size?: number })` from `./Batsu`, with `testID="batsu"` on the outer view, `testID="batsu-stroke"` on each of the two strokes, and `pointerEvents="none"`;
  - `REPLAY_STEP_MS = 900` and `useMoveReplay(): { soroban: Soroban | null; step: number | null; play: (states: Soroban[]) => void; stop: () => void }` from `./useMoveReplay`.
  - `Maru`'s props, testID and look are unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/session/Batsu.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { Batsu } from './Batsu'

// Batsu runs a real Animated.timing on mount; fake timers keep its frames
// from firing between tests.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('Batsu', () => {
  it('is as big as the 〇 by default', () => {
    render(<Batsu />)
    const flat = StyleSheet.flatten(screen.getByTestId('batsu').props.style)
    expect(flat.width).toBe(140)
    expect(flat.height).toBe(140)
  })

  it('crosses two vermilion strokes about 7% of its size', () => {
    render(<Batsu size={110} />)
    const strokes = screen.getAllByTestId('batsu-stroke').map((stroke) => StyleSheet.flatten(stroke.props.style))
    expect(strokes).toHaveLength(2)
    for (const stroke of strokes) {
      expect(stroke.width).toBe(8)
      expect(stroke.height).toBe(110)
      expect(stroke.backgroundColor).toBe(colors.accent)
    }
  })

  it('never takes a tap', () => {
    render(<Batsu />)
    expect(screen.getByTestId('batsu').props.pointerEvents).toBe('none')
  })

  it('is gone within a second, like the 〇', () => {
    render(<Batsu />)
    act(() => jest.advanceTimersByTime(1_000))
    expect(StyleSheet.flatten(screen.getByTestId('batsu').props.style).opacity).toBe(0)
  })
})
```

Create `src/ui/session/useMoveReplay.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native'
import { emptySoroban, readValue, setValue } from '@/domain/soroban'
import { REPLAY_STEP_MS, useMoveReplay } from './useMoveReplay'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// 7 + 8 on the session soroban: 07, then +10, then − 2.
const states = [7, 17, 15].map((n) => setValue(emptySoroban(2), n))

function render() {
  const hook = renderHook(() => useMoveReplay())
  const shown = () => {
    const soroban = hook.result.current.soroban
    return soroban === null ? null : readValue(soroban)
  }
  return { ...hook, shown }
}

describe('useMoveReplay', () => {
  it('shows nothing until played', () => {
    const { result, shown } = render()
    expect(shown()).toBeNull()
    expect(result.current.step).toBeNull()
  })

  it('starts on the first state and steps every 900 ms to the last', () => {
    const { result, shown } = render()
    expect(REPLAY_STEP_MS).toBe(900)
    act(() => result.current.play(states))
    expect(shown()).toBe(7)
    expect(result.current.step).toBe(0)

    act(() => jest.advanceTimersByTime(899))
    expect(shown()).toBe(7)
    act(() => jest.advanceTimersByTime(1))
    expect(shown()).toBe(17)
    expect(result.current.step).toBe(1)

    act(() => jest.advanceTimersByTime(900))
    expect(shown()).toBe(15)
    expect(result.current.step).toBe(2)
  })

  it('stays on the last state, with nothing left pending', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(10 * 900))
    expect(shown()).toBe(15)
    expect(result.current.step).toBe(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('starts over when played again mid-replay', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(900 + 600))
    expect(shown()).toBe(17)

    act(() => result.current.play(states))
    expect(shown()).toBe(7)
    // The step the first play had pending must not fire.
    act(() => jest.advanceTimersByTime(600))
    expect(shown()).toBe(7)
    act(() => jest.advanceTimersByTime(300))
    expect(shown()).toBe(17)
  })

  it('shows nothing once stopped, and stays stopped', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(900))
    act(() => result.current.stop())
    expect(shown()).toBeNull()
    expect(result.current.step).toBeNull()
    act(() => jest.advanceTimersByTime(5_000))
    expect(shown()).toBeNull()
  })

  it('leaves no timer behind when unmounted mid-replay', () => {
    const { result, unmount } = render()
    act(() => result.current.play(states))
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/ui/session/Batsu.test.tsx src/ui/session/useMoveReplay.test.ts`
Expected: FAIL with "Cannot find module './Batsu'" and "Cannot find module './useMoveReplay'".

- [ ] **Step 3: Create `src/ui/session/useStamp.ts`**

```ts
import { useEffect, useState } from 'react'
import { Animated } from 'react-native'

// The shared life of the 〇 and ✕ stamps: pop in, hold, fade, about 0.8 s
// in all. Decoration only: whatever is under a stamp keeps taking input.
const POP_IN_MS = 120
const HOLD_MS = 450
const FADE_OUT_MS = 250

// A stamp's stroke width as a share of its size: about 10 pt at 140.
export const STAMP_STROKE_RATIO = 0.07

export function useStamp(): { scale: Animated.Value; opacity: Animated.Value } {
  const [scale] = useState(() => new Animated.Value(0.6))
  const [opacity] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: false }),
    ]).start()
  }, [opacity, scale])

  return { scale, opacity }
}
```

- [ ] **Step 4: Make `Maru` use it**

Replace the whole of `src/ui/session/Maru.tsx` with:

```tsx
import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// A big vermilion 〇 stamped over the soroban, drawn and gone in ~0.8s.
// Decoration only: the next question is already on screen and taking
// input while it animates, so the latency the fluency model records is
// untouched, and it never intercepts a tap.
export function Maru({ size = 140 }: { size?: number }) {
  const { scale, opacity } = useStamp()

  return (
    <Animated.View
      testID="maru"
      pointerEvents="none"
      style={[
        styles.maru,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.round(size * STAMP_STROKE_RATIO),
          opacity,
          transform: [{ rotate: '-8deg' }, { scale }],
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  maru: {
    borderColor: colors.accent,
  },
})
```

- [ ] **Step 5: Create `src/ui/session/Batsu.tsx`**

```tsx
import { Animated, StyleSheet, View } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// The 〇's counterpart for a miss: a big vermilion ✕ over the soroban, the
// same size and timing as the 〇. The missed question stays on screen for
// review underneath it, and it never intercepts a tap.
export function Batsu({ size = 140 }: { size?: number }) {
  const { scale, opacity } = useStamp()
  const stroke = Math.round(size * STAMP_STROKE_RATIO)
  // Each stroke is a bar down the middle of the square, turned ±45°.
  const bar = { left: (size - stroke) / 2, width: stroke, height: size, borderRadius: stroke / 2 }

  return (
    <Animated.View
      testID="batsu"
      pointerEvents="none"
      style={{ width: size, height: size, opacity, transform: [{ rotate: '-6deg' }, { scale }] }}
    >
      <View testID="batsu-stroke" style={[styles.stroke, bar, styles.forward]} />
      <View testID="batsu-stroke" style={[styles.stroke, bar, styles.back]} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  stroke: { position: 'absolute', top: 0, backgroundColor: colors.accent },
  forward: { transform: [{ rotate: '45deg' }] },
  back: { transform: [{ rotate: '-45deg' }] },
})
```

- [ ] **Step 6: Create `src/ui/session/useMoveReplay.ts`**

```ts
import { useEffect, useState } from 'react'
import type { Soroban } from '@/domain/soroban'

// Spec (miss review) §4: slow enough to watch each bead slide and read the
// step it made.
export const REPLAY_STEP_MS = 900

type Shown = { states: Soroban[]; step: number }

// Plays a move on the soroban: the first state at once, then the next one
// every REPLAY_STEP_MS until the last, where it stays. `step` indexes the
// state on show; both it and `soroban` are null when nothing has been played
// or the replay was stopped.
export function useMoveReplay(): {
  soroban: Soroban | null
  step: number | null
  play: (states: Soroban[]) => void
  stop: () => void
} {
  const [shown, setShown] = useState<Shown | null>(null)

  // Whichever state is on show schedules the next one. A new play or a stop
  // replaces `shown`, which clears the step still pending; so does unmounting.
  useEffect(() => {
    if (shown === null || shown.step >= shown.states.length - 1) return
    const timer = setTimeout(() => setShown({ states: shown.states, step: shown.step + 1 }), REPLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [shown])

  return {
    soroban: shown === null ? null : (shown.states[shown.step] ?? null),
    step: shown === null ? null : shown.step,
    play: (states) => setShown({ states, step: 0 }),
    stop: () => setShown(null),
  }
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx jest src/ui/session && npm run typecheck && npm run lint`
Expected: PASS. The existing runner test `stamps a big 〇 centred over the soroban in bead mode` still passes (Maru is unchanged on screen).

- [ ] **Step 8: Commit**

```bash
git add src/ui/session/useStamp.ts src/ui/session/Maru.tsx src/ui/session/Batsu.tsx src/ui/session/Batsu.test.tsx src/ui/session/useMoveReplay.ts src/ui/session/useMoveReplay.test.ts
git commit -m "feat: add the ✕ stamp and a step-by-step replay timer

Batsu shares the 〇's size and timing through useStamp. useMoveReplay steps
through a move's soroban states every 900 ms.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 4: An answer card that can point at a step

**Files:**
- Modify: `src/ui/session/CorrectionCard.tsx`, `src/ui/theme.ts`, `src/ui/session/testing.ts`
- Modify: `src/ui/session/SessionRunner.test.tsx` (one assertion, see Step 5)
- Test: `src/ui/session/CorrectionCard.test.tsx` (new)

**Interfaces:**
- Consumes: `describeStepParts(atom)` (Task 1); `strings.coachingLead(atom)` (Task 2).
- Produces:
  - `CorrectionCard({ atom, expected, activeStep }: { atom: Atom; expected: number; activeStep?: number })`. `activeStep` is the index into `describeStepParts(atom)` of the part to highlight.
  - Each part renders as a nested `<Text testID="correction-step-<i>">`. `correction-coaching` still reads, as a whole, exactly `strings.coaching(atom)`.
  - `colors.accentSoft`.
  - `textOf(node)` exported from `src/ui/session/testing.ts`.
  - The card's header (`previousProblem` + `correction-problem`) stays until Task 5.

- [ ] **Step 1: Add the test helper**

Append to `src/ui/session/testing.ts`:

```ts
type Node = ReturnType<GetByTestId>

// What a Text element reads out, nested Text included: the line the learner
// sees, where props.children would be a list of pieces.
export function textOf(node: Node): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('')
}
```

- [ ] **Step 2: Write the failing test**

Create `src/ui/session/CorrectionCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { atomId, type Atom, type Direction } from '@/domain/atoms'
import { colors } from '@/ui/theme'
import { CorrectionCard } from './CorrectionCard'
import { textOf } from './testing'

function atom(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

const colorOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)?.color

describe('CorrectionCard', () => {
  it('reads the answer, and the substitution as one sentence', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 15')
    expect(textOf(screen.getByTestId('correction-coaching'))).toBe('十の繰上：8をたす = +10 − 2')
  })

  it('sets each step apart', () => {
    render(<CorrectionCard atom={atom(7, 6, 'add')} expected={13} />)
    expect(textOf(screen.getByTestId('correction-step-0'))).toBe('+10')
    expect(textOf(screen.getByTestId('correction-step-1'))).toBe('− 5')
    expect(textOf(screen.getByTestId('correction-step-2'))).toBe('+ 1')
  })

  it('highlights only the active step', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} activeStep={1} />)
    expect(colorOf('correction-step-1')).toBe(colors.accent)
    expect(colorOf('correction-step-0')).not.toBe(colors.accent)
  })

  it('highlights nothing when no step is active', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(colorOf('correction-step-0')).not.toBe(colors.accent)
    expect(colorOf('correction-step-1')).not.toBe(colors.accent)
  })
})
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx jest src/ui/session/CorrectionCard.test.tsx`
Expected: FAIL with "Unable to find an element with testID: correction-step-0".

- [ ] **Step 4: Implement**

In `src/ui/theme.ts`, add after the `accentShadow` line in `colors`:

```ts
  // Behind the step of a correction that a replay has just played.
  accentSoft: '#F6DDD6',
```

Replace the whole of `src/ui/session/CorrectionCard.tsx` with:

```tsx
import { Fragment } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { describeStepParts } from '@/domain/explain'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// The runner re-queues a miss at the back of the block, so this card is on
// screen under a *different* question. It has to say which one it corrects.
// `activeStep` indexes describeStepParts(atom): the step to highlight.
export function CorrectionCard({
  atom,
  expected,
  activeStep,
}: {
  atom: Atom
  expected: number
  activeStep?: number
}) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tag}>{strings.previousProblem}</Text>
        <Text testID="correction-problem" style={styles.problem}>
          {strings.prompt(atom)}
        </Text>
      </View>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      {/* Reads exactly as strings.coaching(atom); each step is its own span
          so a replay can point at the one it has just played. */}
      <Text testID="correction-coaching" style={styles.coaching}>
        {strings.coachingLead(atom)}
        {describeStepParts(atom).map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? ' ' : null}
            <Text
              testID={`correction-step-${index}`}
              style={index === activeStep ? styles.activeStep : undefined}
            >
              {part}
            </Text>
          </Fragment>
        ))}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  header: { flexDirection: 'row', gap: space.sm, alignItems: 'baseline' },
  tag: { fontSize: fontSizes.caption, color: colors.accent, fontWeight: '600' },
  problem: { fontSize: fontSizes.caption, color: colors.muted },
  answer: { marginTop: 2, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  coaching: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeStep: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
```

- [ ] **Step 5: Keep the runner test that reads the coaching line**

`correction-coaching` now has nested children, so `props.children` is no longer one string. In `src/ui/session/SessionRunner.test.tsx`:
- change the import `import { setBeads } from './testing'` to `import { setBeads, textOf } from './testing'`;
- in the test `corrects a wrong answer with the method, not only the number`, replace

```ts
    expect(getByTestId('correction-coaching').props.children).toContain('+5 − 1')
```

with

```ts
    expect(textOf(getByTestId('correction-coaching'))).toContain('+5 − 1')
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx jest src/ui/session && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/theme.ts src/ui/session/CorrectionCard.tsx src/ui/session/CorrectionCard.test.tsx src/ui/session/testing.ts src/ui/session/SessionRunner.test.tsx
git commit -m "feat: let the answer card highlight one step of the move

Each step of the substitution is its own span, so a replay can point at
the step it has just played. The line still reads as the coaching sentence.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 5: Hold a missed question for review

**Files:**
- Modify: `src/ui/session/SessionRunner.tsx`
- Modify: `src/ui/session/CorrectionCard.tsx` (remove the header), `src/i18n/ja.ts`, `src/i18n/en.ts` (remove `previousProblem`)
- Test: `src/ui/session/SessionRunner.test.tsx`, `src/ui/session/CorrectionCard.test.tsx`

**Interfaces:**
- Consumes:
  - `decompose`, `moveStates` (atoms, Task 1);
  - `strings.showAnswer`, `watchAgain`, `next`, `wrong`, `replayStep` (Task 2);
  - `Batsu`, `useMoveReplay` (Task 3);
  - `CorrectionCard`'s `activeStep`, and `textOf` (Task 4).
- Produces the on-screen behaviour of spec §4:
  - After a miss, `review-show` and `review-next` replace the answer controls, and `batsu` sits over the soroban.
  - `replay-step` shows under the soroban while a replay has moved past its start.
  - `SessionRunner`'s props and `AttemptResult` are unchanged.

- [ ] **Step 1: Write the failing tests**

In `src/ui/session/SessionRunner.test.tsx`:

(a) Replace the first two import lines with:

```ts
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
```

and add after the `import { SessionRunner } from './SessionRunner'` line:

```ts
import { colors } from '@/ui/theme'
```

(b) After the `answerCorrectly` function, add:

```ts
// After a miss the question stays on screen for review until つぎへ. Tests
// about what comes after a wrong answer press it, as the learner would.
function moveOn() {
  fireEvent.press(screen.getByTestId('review-next'))
}
```

(c) Replace the whole test `names the problem a correction belongs to, since it shows under the next one` with:

```ts
  it('keeps a missed question on screen, with its answer card, until つぎへ', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    expect(getByTestId('correction-answer').props.children).toBe('こたえは 7')
    // The card is about the question on screen, so it names no other one.
    expect(queryByTestId('correction-problem')).toBeNull()

    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(queryByTestId('correction')).toBeNull()
  })
```

(d) In `drops one fade level on a silent wrong answer at fade >= 4, revealing beads for the retry`, change

```ts
    answer(getByTestId, '9')
    const after = getByTestId('fade-layer').props.style.opacity as number
```

to

```ts
    answer(getByTestId, '9')
    moveOn()
    const after = getByTestId('fade-layer').props.style.opacity as number
```

(e) In `drops an atom after three failures and it never reappears via cycling`, change the loop body line

```ts
      answer(getByTestId, showsDroppedAtom ? '0' : '5')
```

to

```ts
      answer(getByTestId, showsDroppedAtom ? '0' : '5')
      if (queryByTestId('review-next') !== null) moveOn()
```

(f) In `reports the session result on the close screen`, change

```ts
    answer(getByTestId, '99')
```

to

```ts
    answer(getByTestId, '99')
    moveOn()
```

(g) In `ends a block early if every item in it fails out before the deadline`, change the loop body

```ts
      answer(getByTestId, '0')
```

to

```ts
      answer(getByTestId, '0')
      moveOn()
```

(h) Replace the whole test `still names the previous problem after a wrong bead answer` with:

```ts
  it('keeps the beads as the learner set them, and locks them, while a miss is reviewed', () => {
    const { getByTestId, queryByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('9')
    expect(getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    expect(queryByTestId('reset-beads')).toBeNull()
    expect(queryByTestId('submit')).toBeNull()
  })
```

(i) In `resets a reserve atom on a wrong answer, delaying it joining`, change

```ts
    answer(getByTestId, '99')
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')
```

to

```ts
    answer(getByTestId, '99')
    moveOn()
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')
```

(j) In `still retries a missed warm-up move before the block ends`, change

```ts
    answer(getByTestId, '9') // wrong: expected 7
```

to

```ts
    answer(getByTestId, '9') // wrong: expected 7
    moveOn()
```

(k) In `does not ask the just-retried item again right after its retry (rotation)`, change

```ts
    answer(getByTestId, '0') // wrong: 3+4 requeued at the back -> [2+3, 3+4]
```

to

```ts
    answer(getByTestId, '0') // wrong: 3+4 requeued at the back -> [2+3, 3+4]
    moveOn()
```

(l) Append at the end of the file:

```ts
// Spec (miss review) §4: a miss holds its question for review. The ✕ stamps
// over it, こたえを見る plays the move on the soroban, and つぎへ moves on.
describe('SessionRunner reviewing a miss', () => {
  const beadPlan: SessionPlan = {
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }
  // F3: keypad answers, a dimmed soroban, silent coaching.
  const keypadPlan: SessionPlan = {
    blocks: [
      {
        kind: 'focus',
        seconds: 120,
        items: [item('7+8', { fade: 3, coaching: 'silent' }), item('2+3', { fade: 3, coaching: 'silent' })],
      },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }

  // Tens then ones, as the soroban reads.
  const rods = () => [0, 1].map((index) => screen.getByTestId(`rod-${index}`).props.accessibilityValue.text).join('')
  const opacity = () => screen.getByTestId('fade-layer').props.style.opacity as number
  const highlighted = () =>
    [0, 1].filter(
      (index) => StyleSheet.flatten(screen.getByTestId(`correction-step-${index}`).props.style)?.color === colors.accent,
    )

  it('stamps a big ✕ over the soroban and offers こたえを見る and つぎへ', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    const batsu = within(getByTestId('soroban-wrap')).getByTestId('batsu')
    expect(StyleSheet.flatten(batsu.props.style).width).toBe(140)
    expect(queryByTestId('maru')).toBeNull()
    expect(within(getByTestId('review-show')).getByText('こたえを見る')).toBeTruthy()
    expect(within(getByTestId('review-next')).getByText('つぎへ')).toBeTruthy()
    expect(announce).toHaveBeenCalledWith('ちがいます')
    announce.mockRestore()
  })

  it('hides the keypad while a keypad answer is reviewed', () => {
    const { getByTestId, queryByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('prompt').props.children).toBe('7に8をたす。')
    expect(queryByTestId('key-0')).toBeNull()
    expect(queryByTestId('submit')).toBeNull()
    expect(StyleSheet.flatten(getByTestId('batsu').props.style).width).toBe(110)
  })

  it('shows the answer card at once where coaching still speaks, in place of the demonstration', () => {
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    expect(getByTestId('demonstration')).toBeTruthy()
    answer(getByTestId, '9')
    expect(getByTestId('correction')).toBeTruthy()
    expect(queryByTestId('demonstration')).toBeNull()
  })

  it('holds the card back at a silent level until こたえを見る', () => {
    const plan: SessionPlan = {
      blocks: [
        {
          kind: 'focus',
          seconds: 120,
          items: [item('3+4', { fade: 2, coaching: 'silent' }), item('2+3', { fade: 2, coaching: 'silent' })],
        },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(queryByTestId('correction')).toBeNull()
    fireEvent.press(getByTestId('review-show'))
    expect(getByTestId('correction-answer').props.children).toBe('こたえは 7')
  })

  it('replays the move on the soroban, drawn solid, one step every 900 ms', () => {
    const { getByTestId, queryByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    expect(opacity()).toBe(0.35)

    fireEvent.press(getByTestId('review-show'))
    expect(rods()).toBe('07')
    expect(opacity()).toBe(1)
    expect(queryByTestId('replay-step')).toBeNull()

    act(() => jest.advanceTimersByTime(899))
    expect(rods()).toBe('07')
    act(() => jest.advanceTimersByTime(1))
    expect(rods()).toBe('17')
    expect(getByTestId('replay-step').props.children).toBe('1 / 2')

    act(() => jest.advanceTimersByTime(900))
    expect(rods()).toBe('15')
    expect(getByTestId('replay-step').props.children).toBe('2 / 2')

    act(() => jest.advanceTimersByTime(5_000))
    expect(rods()).toBe('15')
  })

  it('highlights the step just played, then offers もう一度見る', () => {
    const { getByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    fireEvent.press(getByTestId('review-show'))
    expect(highlighted()).toEqual([])
    act(() => jest.advanceTimersByTime(900))
    expect(highlighted()).toEqual([0])
    act(() => jest.advanceTimersByTime(900))
    expect(highlighted()).toEqual([1])
    expect(within(getByTestId('review-show')).getByText('もう一度見る')).toBeTruthy()

    fireEvent.press(getByTestId('review-show'))
    expect(rods()).toBe('07')
    expect(highlighted()).toEqual([])
  })

  it('moves on with つぎへ and brings the missed move back later in the block', () => {
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(queryByTestId('batsu')).toBeNull()
    expect(queryByTestId('review-next')).toBeNull()
    expect(getByTestId('rod-1').props.accessibilityRole).toBe('adjustable')
    answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
  })

  it('scores a miss once, at the answer, and not again at つぎへ', () => {
    const { getByTestId, onAttempt } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith({ atomId: '3+4', correct: false, latencyMs: null })
    moveOn()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it("leaves the time spent reviewing out of the next answer's latency", () => {
    const clock = manualClock(0)
    const { getByTestId, onAttempt } = renderRunner(keypadPlan, clock.now)
    clock.set(1_000)
    answer(getByTestId, '9')
    clock.set(61_000)
    moveOn()
    clock.set(64_000)
    answer(getByTestId, '5')
    expect(onAttempt).toHaveBeenLastCalledWith({ atomId: '2+3', correct: true, latencyMs: 3_000 })
  })

  it('ends the block at つぎへ when its time ran out during the review', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 10, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 40,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)
    clock.set(5_000)
    answer(getByTestId, '9')
    clock.set(15_000)
    expect(onBlockEnd).not.toHaveBeenCalled()
    moveOn()
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('cuts a replay short at つぎへ', () => {
    const { getByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    fireEvent.press(getByTestId('review-show'))
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(rods()).toBe('02')
    expect(opacity()).toBe(0.35)
    act(() => jest.advanceTimersByTime(3_000))
    expect(rods()).toBe('02')
  })

  it('leaves a correct answer as it was: 〇 and the next question at once', () => {
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '7')
    expect(getByTestId('maru')).toBeTruthy()
    expect(queryByTestId('batsu')).toBeNull()
    expect(queryByTestId('review-next')).toBeNull()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })
})
```

In `src/ui/session/CorrectionCard.test.tsx`, append inside the `describe('CorrectionCard', …)` block:

```ts
  it('names no other problem: it sits under the question it corrects', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(screen.queryByTestId('correction-problem')).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/ui/session`
Expected: FAIL. `review-next`, `batsu` and `replay-step` are not found, the prompt advances on a miss, and `correction-problem` is still rendered. The pre-existing tests that were not edited still pass.

- [ ] **Step 3: Remove the card's header and `previousProblem`**

Replace the whole of `src/ui/session/CorrectionCard.tsx` with:

```tsx
import { Fragment } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { describeStepParts } from '@/domain/explain'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// The answer card for the missed question still on screen: the answer, and
// the substitution that reaches it. `activeStep` indexes
// describeStepParts(atom): the step a replay has just played.
export function CorrectionCard({
  atom,
  expected,
  activeStep,
}: {
  atom: Atom
  expected: number
  activeStep?: number
}) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      {/* Reads exactly as strings.coaching(atom); each step is its own span
          so a replay can point at the one it has just played. */}
      <Text testID="correction-coaching" style={styles.coaching}>
        {strings.coachingLead(atom)}
        {describeStepParts(atom).map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? ' ' : null}
            <Text
              testID={`correction-step-${index}`}
              style={index === activeStep ? styles.activeStep : undefined}
            >
              {part}
            </Text>
          </Fragment>
        ))}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  coaching: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeStep: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
```

Delete the line `  previousProblem: 'さっきの問題',` from `src/i18n/ja.ts` and the line `  previousProblem: 'Previous problem',` from `src/i18n/en.ts`.

- [ ] **Step 4: Split `submit()` and add the review to `SessionRunner.tsx`**

At the top of `src/ui/session/SessionRunner.tsx`:
- change `import { expectedValue, startValue, type Atom } from '@/domain/atoms'` to

```ts
import { decompose, expectedValue, moveStates, startValue, type Atom } from '@/domain/atoms'
```

- change the three local imports at the end of the import block to

```ts
import { Batsu } from './Batsu'
import { CorrectionCard } from './CorrectionCard'
import { Maru } from './Maru'
import { SessionTrack } from './SessionTrack'
import { useMoveReplay } from './useMoveReplay'
```

- replace

```ts
// What a correction card needs. Kept as data rather than a finished sentence
// so the card can name the problem as well as its answer.
type Correction = { atom: Atom; expected: number }
```

with

```ts
// A missed question held on screen until つぎへ. It is still state.queue[0],
// so only whether its answer card is up needs keeping: up at once where
// coaching still speaks (F0–F1), and after こたえを見る at silent levels.
type Review = { cardShown: boolean }
```

Then replace everything from the line `export function SessionRunner({` to the end of the file with:

```tsx
export function SessionRunner({
  plan,
  onAttempt,
  onBlockEnd,
  onFinish,
  onQuit,
  now = Date.now,
}: {
  plan: SessionPlan
  onAttempt: (result: AttemptResult) => void
  onBlockEnd: (kind: BlockKind) => void
  onFinish: () => void
  onQuit?: () => void
  now?: () => number
}) {
  const strings = useStrings()
  const [sessionStartedAt] = useState(() => now())
  const [state, setState] = useState<RunnerState>(
    () => findActiveBlock(plan.blocks, 0, {}) ?? { blockIndex: plan.blocks.length, queue: [] },
  )
  const [answer, setAnswer] = useState('')
  // Non-null while a missed question is held on screen for review.
  const [review, setReview] = useState<Review | null>(null)
  // こたえを見る's step-by-step replay of the move, on the same soroban.
  const replay = useMoveReplay()
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  // Counts correct answers, so each one remounts the 〇 and replays its fade.
  // 0 means the last answer was wrong, or there has not been one.
  const [maru, setMaru] = useState(0)
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  const failures = useRef<Record<string, number>>({})
  // Consecutive-correct streak per atom this session, independent of the
  // Leitner box and fade ladder — it only gates when the next reserve atom
  // is secure enough to join. A wrong answer resets its atom's streak.
  const streaks = useRef<Record<string, number>>({})
  // Reserve atoms that have joined the focus block so far, in join order.
  // Only the focus block's refill ever reads this; warm-up and fade rep are
  // untouched by it.
  const [joined, setJoined] = useState<SessionItem[]>([])
  const shownAt = useRef<number>(sessionStartedAt)
  const finished = useRef(false)

  const deadlines = useMemo(
    () => cumulativeDeadlines(plan.blocks, sessionStartedAt),
    [plan, sessionStartedAt],
  )

  // The practice blocks' seconds, for the time track. Close is a summary that
  // waits for おわる, not a timed stretch, so it gets no segment.
  const segments = useMemo(
    () => plan.blocks.filter((b) => b.kind !== 'close' && b.seconds > 0).map((b) => b.seconds),
    [plan],
  )

  const block = plan.blocks[state.blockIndex]

  // Defensive fallback: only reachable if a plan has no terminal close block
  // (every plan produced by selectSession, and every plan in tests, has one).
  useEffect(() => {
    if (block === undefined && !finished.current) {
      finished.current = true
      onFinish()
    }
  }, [block, onFinish])

  if (block === undefined) {
    // Distinct testID from the real close screen: this branch means the
    // plan had no terminal close block, which is a dead end, not a summary.
    return <View testID="session-no-close-block" />
  }

  if (block.kind === 'close') {
    return (
      <View testID="session-summary" style={styles.summary}>
        <View style={styles.summaryBody}>
          <Seal text={strings.sealDone} state="stamped" size={118} animateIn />
          <Text testID="summary-text" style={styles.summaryTitle}>
            {strings.sessionComplete}
          </Text>
          {/* Spec §6: the close block reports the result. Atoms mastered and
              tomorrow's preview still belong here and are not built yet. */}
          <Text testID="summary-result" style={styles.summaryResult}>
            {strings.sessionResult(tally.answered, tally.correct)}
          </Text>
        </View>
        <Button
          testID="finish-button"
          label={strings.done}
          onPress={() => {
            if (finished.current) return
            finished.current = true
            onFinish()
          }}
        />
      </View>
    )
  }

  const current = state.queue[0]
  if (current === undefined) {
    // Invariant: findActiveBlock and the refill below never leave a
    // non-close block active with an empty queue. Distinct testID from the
    // real close screen so a broken invariant fails loudly instead of
    // looking like a legitimate session end.
    return <View testID="session-empty-queue" />
  }

  const { rodValue, operand, sign } = parseAtomId(current.atomId)
  const atom: Atom = {
    id: current.atomId,
    rodValue,
    operand,
    direction: sign === 1 ? 'add' : 'sub',
  }
  const expected = expectedValue(atom)
  const mode = answerModeForFade(current.fade)
  const start = setValue(emptySoroban(2), startValue(atom))
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn one of the atom's attempts.
  const moved = readValue(shownBeads) !== startValue(atom)

  // Scores the answer. A right one moves straight on; a miss holds the
  // question for review, and advance() runs later, from つぎへ.
  function submit() {
    // Re-narrowed here rather than relied on from the enclosing scope: TS
    // does not carry a const's narrowing into a nested closure.
    if (block === undefined || current === undefined) return

    // A blank or unparseable field is not an answer. Scoring it would mark
    // every n−n atom correct, and scoring it wrong would burn an attempt for
    // a mistap, so nothing happens at all.
    const given = mode === 'beads' ? (moved ? readValue(shownBeads) : null) : parseAnswer(answer)
    if (given === null) return

    const t = now()
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt.current)
    const correct = given === expected

    onAttempt({ atomId: current.atomId, correct, latencyMs })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))

    // Extends the atom's streak on a right answer, breaks it on a wrong one.
    streaks.current[current.atomId] = correct ? (streaks.current[current.atomId] ?? 0) + 1 : 0

    if (correct) {
      setMaru((previous) => previous + 1)
      AccessibilityInfo.announceForAccessibility(strings.correct)
      advance(true, t)
      return
    }

    failures.current[current.atomId] = (failures.current[current.atomId] ?? 0) + 1
    setMaru(0)
    AccessibilityInfo.announceForAccessibility(strings.wrong)
    // The number alone teaches nothing. Where coaching still speaks, the
    // card with the substitution comes up with the ✕; at silent levels it
    // waits to be asked for.
    setReview({ cardShown: current.coaching !== 'silent' })
  }

  // Moves the session on from the question just answered: requeue, joins,
  // refill, block end. A right answer runs it straight from submit(); a miss
  // runs it from つぎへ, with `t` the moment つぎへ was pressed, so the
  // deadline is checked then and the review never counts toward the next
  // answer's latency.
  function advance(correct: boolean, t: number) {
    if (block === undefined || current === undefined) return

    let queue = state.queue.slice(1)

    // submit() has already counted this failure.
    if (!correct && (failures.current[current.atomId] ?? 0) < MAX_ATTEMPTS_PER_ATOM) {
      // A high-fade miss reveals one level for the retry, so the learner
      // sees what they should have been imagining.
      const fade = (current.coaching === 'silent' && current.fade >= 4
        ? current.fade - 1
        : current.fade) as FadeLevel
      queue = [...queue, { ...current, fade }]
    }
    // At MAX_ATTEMPTS_PER_ATOM a missed item is simply not requeued — dropped.

    // Bring in the next reserve atom once every atom currently in the focus
    // block — including this one, just answered — has a full streak. One at
    // a time: the item after this one only becomes "in play" once this one
    // has joined, so it cannot join in the same submit.
    let joinedNow = joined
    if (correct && block.kind === 'focus') {
      const inPlay = dedupeByAtomId(liveItems([...block.items, ...joined], failures.current))
      const secure = inPlay.length > 0 && inPlay.every((it) => (streaks.current[it.atomId] ?? 0) >= FADE_PROMOTE_STREAK)
      const newcomer = plan.reserve?.[joined.length]
      if (secure && newcomer !== undefined) {
        joinedNow = [...joined, newcomer]
        // The learner meets it with its demonstration right away, not
        // somewhere later in the cycle.
        queue = [newcomer, ...queue]
      }
    }
    const deadline = effectiveDeadline(plan.blocks, deadlines, state.blockIndex, failures.current)
    const timeUp = deadline !== undefined && t >= deadline

    // Warm-up makes a single pass and is never refilled: once its queue
    // drains the block simply ends below, and its remaining time rolls into
    // whatever comes next (the cumulative deadlines already do that). Focus
    // and fade rep refill from their live items as before, but never into a
    // cycle that would put the move just answered straight back in front of
    // the learner — that is filler, not practice, and it is the TestFlight
    // repeat bug.
    if (!timeUp && queue.length === 0 && block.kind !== 'warmup') {
      // The focus block's candidates include whatever has joined from the
      // reserve so far; other blocks never gain items, so they still draw
      // from their own items exactly as before.
      const candidates =
        block.kind === 'focus'
          ? liveItems([...block.items, ...joinedNow], failures.current)
          : liveItems(block.items, failures.current)
      if (candidates.length === 1 && candidates[0]?.atomId === current.atomId) {
        // Refilling here would only ever hand back the move just answered —
        // a repeat, not a refill. A focus block still has somewhere to go if
        // the reserve has a newcomer left; fade rep, and focus with nothing
        // left in reserve, end the block instead (below).
        const newcomer = block.kind === 'focus' ? plan.reserve?.[joinedNow.length] : undefined
        if (newcomer !== undefined) {
          joinedNow = [...joinedNow, newcomer]
          queue = [newcomer, ...candidates]
        }
      } else {
        // Rotate a leading repeat to the end. This only bites right after a
        // missed item's retry lands last in the drained queue: without it,
        // a plain refill would put that same item straight back in front.
        const [first, ...rest] = candidates
        queue = first !== undefined && first.atomId === current.atomId ? [...rest, first] : candidates
      }
    }

    if (joinedNow !== joined) setJoined(joinedNow)

    setAnswer('')
    setBeads(null)
    setReview(null)
    replay.stop()

    if (timeUp || queue.length === 0) {
      // Either the deadline passed, or every item in the block has now
      // failed out — either way there is nothing left to show here.
      onBlockEnd(block.kind)
      const next = findActiveBlock(plan.blocks, state.blockIndex + 1, failures.current)
      setState(next ?? { blockIndex: plan.blocks.length, queue: [] })
    } else {
      setState({ blockIndex: state.blockIndex, queue })
    }
    shownAt.current = t
  }

  function showAnswer() {
    setReview({ cardShown: true })
    replay.play(moveStates(atom))
  }

  function moveOn() {
    advance(false, now())
  }

  const demonstration =
    current.coaching === 'demo' && review === null ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss. Under
      // review the answer card says it instead.
      <Text testID="demonstration" style={styles.demonstration}>
        {strings.coaching(atom)}
      </Text>
    ) : null
  // The step a replay has just played: state k of moveStates is the one
  // after step k − 1, and the start (k = 0) has played nothing yet.
  const played = replay.step !== null && replay.step > 0 ? replay.step : null
  const correctionCard =
    review !== null && review.cardShown ? (
      <CorrectionCard
        atom={atom}
        expected={expected}
        activeStep={played === null ? undefined : played - 1}
      />
    ) : null
  const replayStep =
    played !== null ? (
      <Text testID="replay-step" style={styles.hint}>
        {strings.replayStep(played, decompose(atom).length)}
      </Text>
    ) : null
  // A replay takes the soroban over, drawn solid whatever the fade level, so
  // there is something to watch at F3+.
  const replayFade = replay.soroban !== null ? 0 : current.fade
  const track = (
    <SessionTrack
      segments={segments}
      label={strings.blockLabel(block.kind)}
      quitLabel={strings.quitLabel}
      onQuit={onQuit}
    />
  )
  // The 〇 over the next question after a right answer, or the ✕ over a
  // missed one under review. Either is decoration and never takes a tap.
  const stamp = (size: number) => {
    if (review !== null) {
      return (
        <View style={styles.stampOverlay} pointerEvents="none">
          <Batsu size={size} />
        </View>
      )
    }
    if (maru > 0) {
      return (
        <View style={styles.stampOverlay} pointerEvents="none">
          <Maru key={maru} size={size} />
        </View>
      )
    }
    return null
  }
  const reviewButtons = (
    <View style={styles.buttonRow}>
      <View style={styles.reviewSlot}>
        <Button
          testID="review-show"
          variant="outline"
          label={replay.step === null ? strings.showAnswer : strings.watchAgain}
          onPress={showAnswer}
        />
      </View>
      <View style={styles.reviewSlot}>
        <Button testID="review-next" label={strings.next} onPress={moveOn} />
      </View>
    </View>
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
        <View style={styles.sorobanWrap} testID="soroban-wrap">
          {/* `previous ?? start` relies on `start` staying constant for the
              presented question: advance() is the only path that changes the
              question, and it resets `beads` to null first. Under review the
              beads stay as the learner left them and take no taps: the
              answer is in. */}
          <Abacus
            soroban={replay.soroban ?? shownBeads}
            fade={replayFade}
            scale={BEAD_MODE_SCALE}
            onTapBead={
              review !== null
                ? undefined
                : (rodIndex, bead) => setBeads((previous) => tapSoroban(previous ?? start, rodIndex, bead))
            }
            onAdjustRod={
              review !== null
                ? undefined
                : (rodIndex, delta) => setBeads((previous) => adjustRod(previous ?? start, rodIndex, delta))
            }
          />
          {stamp(140)}
        </View>
        {review === null ? <Text style={styles.hint}>{strings.beadHint}</Text> : replayStep}
        {/* Layout A puts a flexible gap on both sides of the soroban+hint
            block (mockup: a flex spacer before it, another after). The
            scroll above already absorbs the top gap; this one balances it
            below so spare height on a tall phone doesn't all pile up above
            the soroban. Both share `scroll`'s flexShrink:1, so on a short
            screen this collapses to 0 first and the scroll area is what
            gives way, keeping the soroban, hint and buttons on screen. */}
        <View style={styles.beadSpacer} />
        {review !== null ? (
          reviewButtons
        ) : (
          <View style={styles.buttonRow}>
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
        )}
      </View>
    )
  }

  return (
    <View style={styles.practice}>
      {track}
      {/* R9: the keypad below is always fully visible, pinned at the bottom.
          Everything here that can grow scrolls instead of pushing the keypad
          off a short screen. Under review the review buttons take its place. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.soroban}>
          <Abacus soroban={replay.soroban ?? start} fade={replayFade} />
          {stamp(110)}
        </View>
        {replayStep}
        <Text testID="prompt" style={styles.prompt}>
          {strings.prompt(atom)}
        </Text>
        {demonstration}
        {correctionCard}
      </ScrollView>
      {review !== null ? (
        reviewButtons
      ) : (
        <AnswerPad
          value={answer}
          onChange={setAnswer}
          onSubmit={submit}
          submitLabel={strings.answer}
          submitTestID="submit"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
  soroban: { marginTop: space.md, position: 'relative' },
  prompt: {
    marginTop: space.lg,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.prompt,
    color: colors.ink,
    letterSpacing: 1,
  },
  demonstration: {
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: 7,
    paddingHorizontal: space.md,
    borderRadius: radius.panel,
    overflow: 'hidden',
    backgroundColor: colors.soft,
    color: colors.muted,
    fontSize: fontSizes.small,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
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
  sorobanWrap: { alignSelf: 'center', marginTop: space.sm, position: 'relative' },
  // Centred over whichever soroban it is placed inside (bead mode's
  // sorobanWrap, or keypad mode's soroban view) — that view must itself be
  // position:'relative' for this to fill and centre over it.
  stampOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  beadSpacer: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
  // こたえを見る and つぎへ share the row equally (mockup).
  reviewSlot: { flex: 1 },
})
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx jest src/ui/session`
Expected: PASS, including the new `SessionRunner reviewing a miss` block, the edited tests, and the integration test.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected:
- all suites pass (566 before this plan, plus the new tests);
- typecheck is clean;
- lint shows 0 errors and only the known `kit.test.tsx` warning.

`__tests__/session-screen.test.tsx` passes unchanged: its bead tap may give a wrong answer, and the prompt it checks stays on screen either way.

- [ ] **Step 7: Commit**

```bash
git add src/ui/session/SessionRunner.tsx src/ui/session/SessionRunner.test.tsx src/ui/session/CorrectionCard.tsx src/ui/session/CorrectionCard.test.tsx src/i18n/ja.ts src/i18n/en.ts
git commit -m "feat: hold a missed question for review with a ✕ and a replay

After a miss the question stays under a big ✕. こたえを見る plays the move
on the soroban step by step, and つぎへ moves on. The card now belongs to
the question on screen, so it no longer names a previous one. Scoring is
unchanged, and review time is kept out of the next answer's latency.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 6: Check on the simulator, then TestFlight build 7

**Files:**
- Modify: `app.json` (`ios.buildNumber` `"6"` → `"7"`) and `docs/superpowers/specs/2026-09-22-miss-review-design.md` (the Status line).
- Scratch only, not committed: `$SCRATCH=/private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/miss-review`.

**Interfaces:**
- Consumes: the whole app.
- Simulator: iPhone 17 Pro `F04F4F02-42DD-4A32-828E-C06E0DF317B9`. "IR Refactor Check" is not ours; never touch it.
- Maestro: `~/.maestro/bin/maestro --device <udid>`.
- Release process: `docs/release-ios.md`.
- Polling script: `node /private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/asc-builds.mjs`. It prints `version processingState uploadedDate`.

- [ ] **Step 1: Full automated checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass. Record the counts.

- [ ] **Step 2: Look at a miss in bead mode**

Metro serves this checkout. Reload with `xcrun simctl openurl F04F4F02-42DD-4A32-828E-C06E0DF317B9 exp://127.0.0.1:8081` and start a session.
- Set a wrong value on the beads, for example by tapping the heaven bead of `rod-1`; take its bounds from `maestro hierarchy`. Tap `submit`.
- Screenshot each state with `xcrun simctl io <udid> screenshot $SCRATCH/<name>.png` and Read each PNG:
  1. `01-bead-miss`, within 0.5 s of the tap: the ✕ over the soroban, the beads as entered, the card (the question is at F0/F1), and こたえを見る / つぎへ.
  2. `02-bead-replay`, about 1.2 s after tapping `review-show`: the soroban partway through the move, the step highlighted in the card, the `1 / n` counter, and the button reading もう一度見る.
  3. `03-bead-replayed`, after the replay: the soroban on the answer.
  4. `04-bead-next`, after tapping `review-next`: the next question, with beads at its start, もどす / こたえる, and no ✕ or card.

Compare them with `docs/superpowers/specs/2026-09-22-miss-review-mockups/miss-review.html`. Fix any layout mismatch in the styles, rerun `npx jest src/ui`, re-shoot, and commit each fix separately.

If the simulator display freezes, check `maestro hierarchy`, then reboot the simulator.

- [ ] **Step 3: Look at a miss in keypad mode**

A fresh learner does not reach F3 quickly, so force keypad mode temporarily. Do not commit this.
1. In `src/domain/fade.ts`, change the body of `answerModeForFade` to `return 'keypad'`, then reload.
2. Answer a question wrong on the keypad, then screenshot `05-keypad-miss`: the ✕ at 110 over the soroban, and the keypad replaced by こたえを見る / つぎへ.
3. Tap `review-show` and screenshot `06-keypad-replay`.
4. Run `git checkout src/domain/fade.ts` and reload. `git status --short` must show nothing.

- [ ] **Step 4: Bump the build number and commit**

In `app.json`, change `"buildNumber": "6"` to `"buildNumber": "7"`.

```bash
git add app.json
git commit -m "Bump the iOS build number to 7

TestFlight build 7: reviewing a wrong answer, from feature/miss-review.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 5: Build and upload, following docs/release-ios.md**

```bash
CI=1 npx expo prebuild --platform ios
git checkout package.json        # prebuild rewrites scripts.ios to "expo run:ios"; this repo uses "expo start --ios"
git status --short               # must be clean
rm -rf ios/build/DerivedData ios/build/LearningAbacus.xcarchive
```

Archive with the exact `xcodebuild archive …` command from `docs/release-ios.md` step 3. It takes about 15 minutes; run it in the background and capture the log to `$SCRATCH/archive.log`. Expected: `** ARCHIVE SUCCEEDED **`.

Check the archive before uploading:

```bash
APP=ios/build/LearningAbacus.xcarchive/Products/Applications/LearningAbacus.app
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Info.plist"     # expect 7
for fw in $(otool -L "$APP/LearningAbacus" | sed -n 's|.*@rpath/\([^/]*\.framework\)/.*|\1|p'); do
  [ -d "$APP/Frameworks/$fw" ] || echo "MISSING: $fw — do not upload"
done
python3 -c "b=open('$APP/main.jsbundle','rb').read(); print('こたえを見る'.encode('utf-16-le') in b, b'review-next' in b)"   # expect True True
```

Expected: build 7, no `MISSING`, and `True True`. Then run the `xcodebuild -exportArchive …` command from `docs/release-ios.md` step 4. Expected: `Upload succeeded` and `** EXPORT SUCCEEDED **`. Three missing-dSYM warnings are expected (React, ReactNativeDependencies, hermesvm).

- [ ] **Step 6: Wait for processing**

Poll every 45 s, for up to 30 min, with the polling script until the line for version `7` shows `VALID`. If it shows `INVALID` or `FAILED`, stop and report it.

- [ ] **Step 7: Mark the spec and commit**

Change the spec's Status line to `Status: Implemented on feature/miss-review (TestFlight build 7)`.

```bash
git add docs/superpowers/specs/2026-09-22-miss-review-design.md
git commit -m "docs: mark reviewing a wrong answer as implemented

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 8: Report**

Report the following. Do not merge.
- the test counts;
- each screenshot and what it shows;
- any fixes made;
- build 7's processing state.
