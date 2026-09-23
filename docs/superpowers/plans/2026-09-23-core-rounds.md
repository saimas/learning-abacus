# けたの練習 at the Core, with a Step-by-Step Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ＋ − × × 1 / 2 / 3けた grid the centre of Home, keep the single-move session as a 基礎の練習 card, and give every question a 手順を見る assistant whose steps the learner moves through with ◀ ▶.

**Architecture:** A timer-free `useStepper` over an `Exercise`'s states, and a `StepPanel` that shows the explanation lines with ◀ ▶ 最初から. `QuestionView` uses them both before an answer (手順を見る, marking the answer "assisted") and in the miss review (replacing the timed replay). "Assisted" flows through `Submission` → runners → `ProgressProvider`, which then only marks the day. Home renders `PracticeTable` as a tappable grid and moves the session behind a card.

**Tech Stack:** Expo 57 / React Native 0.86, expo-router, TypeScript 6, Jest 30 + @testing-library/react-native, Maestro.

**Spec:** `docs/superpowers/specs/2026-09-23-core-rounds-design.md`

## Global Constraints

- `src/domain/**` stays pure.
- No schema bump; no change to stored progress.
- Behaviour that the spec does not change stays the same: scoring, the fade ladder for unassisted answers, rounds, the session's blocks and deadlines, the × walkthrough (it keeps `useMoveReplay`).
- Tests whose assertions describe the old replay (timers advancing `replay-step`, `review-show` changing to もう一度見る) or the old Home (はじめる, the map preview, the chooser's けたの練習 section) are updated to the new behaviour; all other assertions are kept.
- Every new string in both `src/i18n/ja.ts` and `src/i18n/en.ts` with the same arity (`catalogs.test.ts`). Strings: `stepsOpen` 手順を見る / Show the steps; `stepBack` 一つもどる / Step back; `stepNext` 一つすすむ / Next step; `stepRestart` 最初から / From the start; `stepsClose` とじる / Close; `basicsTitle` 基礎の練習 / Basics; `basicsDetail` 1けたの動き・5分 / Single-rod moves · 5 min; `homeHowTo` かけ算のやりかた / How multiplication works. The counter uses the existing `replayStep(step, total)`.
- testIDs: `steps-open`, `step-panel`, `step-back`, `step-next`, `step-restart`, `step-count`, `steps-close`, `home-basics`, `home-howto`, grid cells `practice-cell-<id>` (unchanged).
- Comments explain *why*, in full sentences, matching the surrounding code's density.
- Before finishing a task: `npm test && npm run typecheck && npm run lint`, no new warnings (baseline: 1 lint warning in `kit.test.tsx`, 2 act() warnings in `__tests__/home.test.tsx`; if Task 3's Home rewrite removes the cause of those act() warnings, fewer is fine).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: The stepper, the step panel, and the miss review on them

**Files:**
- Create: `src/ui/session/useStepper.ts`, `src/ui/session/useStepper.test.ts`
- Create: `src/ui/session/StepPanel.tsx`, `src/ui/session/StepPanel.test.tsx`
- Modify: `src/ui/session/QuestionView.tsx`, `src/ui/session/QuestionView.test.tsx`
- Modify: `src/ui/session/CorrectionCard.tsx` (+ test), `src/ui/round/ProblemCorrectionCard.tsx` (+ test): `showAnswer` prop
- Modify: `src/ui/session/SessionRunner.tsx`, `src/ui/round/RoundRunner.tsx` (`renderCorrection` → `renderSteps`), and their tests where they assert the old replay
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`

**Interfaces:**
- Produces:
  - `useStepper(states: Soroban[]): { index: number | null; soroban: Soroban | null; total: number; next(): void; back(): void; restart(): void; clear(): void }`
  - `StepPanel({ lines: ReactNode; index: number | null; total: number; onBack; onNext; onRestart; onClose?: () => void })`
  - `QuestionView` prop `renderSteps: (options: { activeStep: number | undefined; showAnswer: boolean }) => ReactNode` replacing `renderCorrection`
  - `CorrectionCard` / `ProblemCorrectionCard` prop `showAnswer?: boolean` (default `true`)

- [ ] **Step 1: `useStepper` (test first)**

`src/ui/session/useStepper.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStepper } from './useStepper'

const states = [0, 5, 3, 13].map((n) => setValue(emptySoroban(2), n))

describe('useStepper', () => {
  it('starts not stepping, then walks the moves one at a time', () => {
    const { result } = renderHook(() => useStepper(states))
    expect(result.current.index).toBeNull()
    expect(result.current.soroban).toBeNull()
    expect(result.current.total).toBe(3)
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    expect(result.current.soroban).toEqual(states[1])
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.index).toBe(3)
  })

  it('steps back to the start and no further', () => {
    const { result } = renderHook(() => useStepper(states))
    act(() => result.current.next())
    act(() => result.current.back())
    expect(result.current.index).toBe(0)
    act(() => result.current.back())
    expect(result.current.index).toBe(0)
    expect(result.current.soroban).toEqual(states[0])
  })

  it('restarts at the start and clears to not stepping', () => {
    const { result } = renderHook(() => useStepper(states))
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.restart())
    expect(result.current.index).toBe(0)
    act(() => result.current.clear())
    expect(result.current.index).toBeNull()
  })
})
```

`src/ui/session/useStepper.ts`:

```ts
import { useState } from 'react'
import type { Soroban } from '@/domain/soroban'

// Spec (core rounds) §3: the learner walks a move one bead step at a time,
// forward and back, at their own pace. `index` is which of `states` is on
// show: state k is the soroban after k bead moves. null means not stepping,
// so the soroban shows whatever it showed before. There are no timers: the
// beads' own slide shows each move.
export function useStepper(states: Soroban[]): {
  index: number | null
  soroban: Soroban | null
  total: number
  next: () => void
  back: () => void
  restart: () => void
  clear: () => void
} {
  const [index, setIndex] = useState<number | null>(null)
  const total = Math.max(0, states.length - 1)
  return {
    index,
    soroban: index === null ? null : (states[index] ?? null),
    total,
    next: () => setIndex((i) => Math.min(total, (i ?? 0) + 1)),
    back: () => setIndex((i) => Math.max(0, (i ?? 0) - 1)),
    restart: () => setIndex(0),
    clear: () => setIndex(null),
  }
}
```

Run: `npx jest src/ui/session/useStepper.test.ts` — FAIL first (no module), then PASS.

- [ ] **Step 2: Strings**

Add to both catalogues exactly the strings listed in Global Constraints (all constants). Add a `catalogs.test.ts` case pinning `ja.stepsOpen` = '手順を見る' and `en.stepRestart` = 'From the start'.

- [ ] **Step 3: `StepPanel` (test first)**

`src/ui/session/StepPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StepPanel } from './StepPanel'

function renderPanel(overrides: Partial<Parameters<typeof StepPanel>[0]> = {}) {
  const handlers = { onBack: jest.fn(), onNext: jest.fn(), onRestart: jest.fn() }
  render(<StepPanel lines={<Text>lines</Text>} index={null} total={5} {...handlers} {...overrides} />)
  return handlers
}

const disabled = (id: string) => screen.getByTestId(id).props.accessibilityState?.disabled === true

describe('StepPanel', () => {
  it('shows the lines and a blank counter before the first step', () => {
    renderPanel()
    expect(screen.getByText('lines')).toBeTruthy()
    expect(screen.getByTestId('step-count').props.children).toBe(' ')
    expect(disabled('step-back')).toBe(true)
    expect(disabled('step-next')).toBe(false)
  })

  it('counts the move on show and stops ▶ at the last', () => {
    renderPanel({ index: 5 })
    expect(screen.getByTestId('step-count').props.children).toBe('5 / 5')
    expect(disabled('step-next')).toBe(true)
    expect(disabled('step-back')).toBe(false)
  })

  it('calls its handlers', () => {
    const h = renderPanel({ index: 2 })
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-back'))
    fireEvent.press(screen.getByTestId('step-restart'))
    expect(h.onNext).toHaveBeenCalledTimes(1)
    expect(h.onBack).toHaveBeenCalledTimes(1)
    expect(h.onRestart).toHaveBeenCalledTimes(1)
  })

  it('offers とじる only when it can be closed', () => {
    renderPanel()
    expect(screen.queryByTestId('steps-close')).toBeNull()
    const onClose = jest.fn()
    renderPanel({ onClose })
    fireEvent.press(screen.getAllByTestId('steps-close')[0]!)
    expect(onClose).toHaveBeenCalled()
  })
})
```

(Replace the `!` with an explicit check if lint flags it.)

`src/ui/session/StepPanel.tsx`: a `Card` (`testID="step-panel"`, accent like the correction card) containing `lines`, then a row: an `IconButton`-style or small `Pressable` ◀ (`step-back`, `accessibilityLabel={strings.stepBack}`, `accessibilityState={{ disabled }}`, disabled when `index === null || index === 0`), the counter `Text` (`step-count`, `index === null ? ' ' : strings.replayStep(index, total)`, keeping its width so the row doesn't jump), ▶ (`step-next`, label `strings.stepNext`, disabled when `index === total`), a text button 最初から (`step-restart`), and when `onClose` is given a text button とじる (`steps-close`). Use the app's theme tokens (`colors`, `space`, `fontSizes`, `radius`) and the existing `Icon` component if it has left/right chevrons (check `src/ui/kit/Icon.tsx`); otherwise ◀ ▶ glyphs in `Text`. Controls are at least 44 pt tall. A leading comment explains the panel's role (spec §3).

- [ ] **Step 4: Cards gain `showAnswer`**

`CorrectionCard` and `ProblemCorrectionCard`: `showAnswer = true` prop; when false, the `correction-answer` line is not rendered. One test each for `showAnswer={false}`.

- [ ] **Step 5: QuestionView's review on the stepper**

In `QuestionView.tsx`:
- Replace `useMoveReplay` with `const stepper = useStepper(exercise.states)`.
- Rename the prop `renderCorrection` to `renderSteps: (options: { activeStep: number | undefined; showAnswer: boolean }) => ReactNode`, with its comment updated.
- Keep `Review = { cardShown: boolean }`. `showAnswer()` (こたえを見る) now only announces and sets `cardShown: true`; it no longer starts a replay. `review-show`'s label is always `strings.showAnswer`, and it is only shown while the panel is not yet open; once open, the review row is just つぎへ (full width).
- The panel under review:

```tsx
  // The move just played: state k is the soroban after k moves, so after
  // stepping to k the highlighted move is k − 1. At the start or before the
  // first step nothing is highlighted.
  const activeStep = stepper.index !== null && stepper.index > 0 ? stepper.index - 1 : undefined
  const reviewPanel =
    review !== null && review.cardShown ? (
      <StepPanel
        lines={renderSteps({ activeStep, showAnswer: true })}
        index={stepper.index}
        total={stepper.total}
        onBack={stepper.back}
        onNext={stepper.next}
        onRestart={stepper.restart}
      />
    ) : null
```

  placed where `correctionCard` was, in both layouts.
- The soroban shows `stepper.soroban ?? shownBeads` (bead mode) / `stepper.soroban ?? start` (keypad mode), at fade 0 while `stepper.soroban !== null` (replacing `replayFade`).
- Remove the `replayStep` line (the panel's counter replaces it); in bead mode under review show a blank hint line of the same height so the layout doesn't jump.
- Update the file's comments that describe the replay.

Update `QuestionView.test.tsx`: the replay test becomes "steps through every move of the problem": miss, press `review-show` (fade F2+) or rely on the auto-open (F0), press `step-next` and assert `step-count` reads '1 / 5' for 472 + 385 and the soroban changed; `step-back` returns to '0 / 5'.

- [ ] **Step 6: Runners pass `renderSteps`**

`SessionRunner`: `renderSteps={({ activeStep, showAnswer }) => <CorrectionCard atom={atom} expected={exercise.expected} activeStep={activeStep} showAnswer={showAnswer} />}`. `RoundRunner`: the same with `ProblemCorrectionCard` and `activeGroup={activeStep === undefined ? undefined : groupOfStep(groups, activeStep)}`.

In `SessionRunner.test.tsx` (and any other test found by `grep -n "replay-step\|watchAgain\|もう一度見る" -r src __tests__`), rewrite only the replay assertions: timers advancing `replay-step` become `step-next` presses asserting `step-count`, and the もう一度見る label assertions are removed (the label no longer changes). Keep every other assertion.

- [ ] **Step 7: Full check, commit**

`npm test && npm run typecheck && npm run lint`.

```bash
git add src
git commit -m "Step through a move with ◀ ▶ in the miss review

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 手順を見る before answering, and "with help" records

**Files:**
- Modify: `src/ui/session/QuestionView.tsx`, `src/ui/session/QuestionView.test.tsx`
- Modify: `src/ui/session/SessionRunner.tsx`, `src/ui/session/SessionRunner.test.tsx`
- Modify: `src/ui/round/RoundRunner.tsx`, `src/ui/round/RoundRunner.test.tsx`
- Modify: `src/domain/practice.ts` (`PracticeAttempt.assisted`)
- Modify: `src/ui/ProgressProvider.tsx`, `src/ui/ProgressProvider.test.tsx`

**Interfaces:**
- Consumes: Task 1's `useStepper`, `StepPanel`, `renderSteps`.
- Produces: `Submission = { correct: boolean; latencyMs: number | null; t: number; assisted: boolean }`; `AttemptResult = { atomId; correct; latencyMs; assisted: boolean }`; `PracticeAttempt = { id; correct; pace; assisted: boolean }`.

- [ ] **Step 1: Failing tests**

`QuestionView.test.tsx`:
- "opens the steps before answering, without the answer": press `steps-open`; `step-panel` shows; `correction-answer` absent; `submit` and `reset-beads` absent (bead mode) / `key-1` absent (keypad mode); press `step-next` → the soroban's rod values change to state 1.
- "closes the steps and gives back the learner's beads": set beads to some value, open, step twice, press `steps-close`; the rods read the learner's value again and `submit` is back.
- "marks an answer after 手順を見る as with help": open, close, answer correctly → `onSubmit` called with `assisted: true`; a fresh render answered without opening → `assisted: false`.

`SessionRunner.test.tsx`: an assisted right answer is passed to `onAttempt` with `assisted: true` and does not count toward bringing in a reserve atom. Build it on an existing reserve-join test: where five right answers in a row bring in the next reserve atom, make one of them assisted and assert the newcomer has not joined after the fifth.

`RoundRunner.test.tsx`: `onAttempt` receives `assisted: true` after 手順を見る.

`ProgressProvider.test.tsx`: `attempt({ …, assisted: true })` leaves `progress.atoms` unchanged but marks the day; `practise({ …, assisted: true })` leaves `progress.practices` unchanged but marks the day.

Run them: FAIL.

- [ ] **Step 2: Implement**

`QuestionView.tsx`:
- State: `const [stepsOpen, setStepsOpen] = useState(false)` and `const assisted = useRef(false)`.
- Under the prompt (and the demonstration line), when `review === null && !stepsOpen`, a small outline button `steps-open` labelled `strings.stepsOpen` that sets `assisted.current = true` and `setStepsOpen(true)`.
- While `stepsOpen` (and `review === null`): render

```tsx
      <StepPanel
        lines={renderSteps({ activeStep, showAnswer: false })}
        index={stepper.index}
        total={stepper.total}
        onBack={stepper.back}
        onNext={stepper.next}
        onRestart={stepper.restart}
        onClose={() => {
          stepper.clear()
          setStepsOpen(false)
        }}
      />
```

  in the same place as the review panel; the soroban shows `stepper.soroban ?? shownBeads` (bead) / `stepper.soroban ?? start` (keypad) at fade 0 while stepping and takes no taps while `stepsOpen`; the answer controls (bead mode's もどす / こたえる row, keypad mode's `AnswerPad`) are not rendered while `stepsOpen`. `beads` and `answer` state are never touched by the panel, so closing restores them.
- `submit` reports `assisted: assisted.current`. If a miss follows, `stepper.clear()` so the review starts from the learner's beads.
- Comment the "with help" rule at the flag (spec §5).

`src/domain/practice.ts`: `PracticeAttempt` gains `assisted: boolean`, with a comment that an assisted answer is not evidence of fluency.

`SessionRunner.tsx`: `AttemptResult` gains `assisted`; `submitted` passes it to `onAttempt`, and the streak line becomes:

```ts
    // Spec (core rounds) §5: an answer after 手順を見る is not the learner's
    // own, so it neither extends nor breaks the streak that brings in new
    // moves and retires fade-rep moves.
    if (!assisted) {
      streaks.current[current.atomId] = correct ? (streaks.current[current.atomId] ?? 0) + 1 : 0
    }
```

`RoundRunner.tsx`: passes `assisted` in `onAttempt`.

`ProgressProvider.tsx`: in `attempt` and `practise`, `const withAttempt = result.assisted ? latest.current : recordAttempt(…)` (and the `practise` equivalent), each with a one-line comment pointing at spec §5; `markDayPracticed` still runs.

Fix every other construction of `AttemptResult` / `PracticeAttempt` in tests and code that typecheck flags by adding `assisted: false`.

- [ ] **Step 3: Pass, full check, commit**

```bash
git add src
git commit -m "Offer 手順を見る on every question; answers after it count as with help

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Home built around けたの練習

**Files:**
- Modify: `src/ui/progress/PracticeTable.tsx`, `src/ui/progress/PracticeTable.test.tsx`
- Modify: `app/index.tsx`, `__tests__/home.test.tsx`
- Modify: `src/ui/home/PartChooser.tsx`, `src/ui/home/PartChooser.test.tsx`
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts` (remove strings that fall out of use; add none beyond Global Constraints)

**Interfaces:**
- Consumes: the strings `basicsTitle`, `basicsDetail`, `homeHowTo` (added in Task 1 Step 2).
- Produces: `PracticeTable({ progress, onChoose?: (kind: PracticeKind) => void })`; `PartChooser({ plan, visible, onChoose, onClose })`.

- [ ] **Step 1: Failing tests**

`PracticeTable.test.tsx`: with `onChoose`, pressing `practice-cell-sub:2` calls it with `{ op: 'sub', digits: 2 }` and the cell has `accessibilityRole="button"`; without it, the cell is not a button.

`PartChooser.test.tsx`: the sheet has no `round-section`, `round-op-*`, `choose-round` or `choose-howto`; remove the tests for them and the `onChooseRound` / `onHowTo` props from every render.

`__tests__/home.test.tsx`, replacing the tests about はじめる, the map preview and the chooser's けたの練習 row with:
- Home shows the grid (`practice-table`) with a cell per kind, and no `start` button and no `atom-preview`.
- Pressing `practice-cell-add:2` pushes `{ pathname: '/round', params: { kind: 'add:2' } }`.
- Pressing `home-howto` pushes `/multiply-intro`.
- Pressing `home-basics` opens the sheet (`part-chooser`); ぜんぶ and a part still start the session as before (keep those existing tests, opening the sheet from `home-basics` instead of `start`); closing starts nothing.
- The seal and days-practised tests stay as they are.

- [ ] **Step 2: Implement**

`PracticeTable.tsx`: optional `onChoose`. When given, each cell is a `Pressable` (`accessibilityRole="button"`, `onPress={() => onChoose(kind)}`, `pressed` opacity like the chooser rows, `minHeight: 48`) with the same testID, label, colours and stage text; otherwise the current `View`. A comment says Home uses it as the practice grid (spec §6).

`app/index.tsx`:
- Wrap the content below the header in a `ScrollView` (so a small phone can reach the basics card).
- Replace `PlanBar`, the map-preview `Link`/`Card` and the spacer + はじめる/もう一度練習する button with:

```tsx
      <PracticeTable progress={progress} onChoose={startRound} />
      <Pressable testID="home-howto" accessibilityRole="link" onPress={openHowTo} hitSlop={12} style={styles.howTo}>
        <Text style={styles.howToText}>{strings.homeHowTo}</Text>
      </Pressable>
      <Pressable testID="home-basics" accessibilityRole="button" onPress={openChooser} style={styles.basics}>
        <Card>
          <View style={styles.basicsHeader}>
            <Text style={styles.basicsTitle}>{strings.basicsTitle}</Text>
            <Text style={styles.basicsDetail}>{strings.basicsDetail}</Text>
          </View>
          <PlanBar />
        </Card>
      </Pressable>
```

  where `startRound(kind)` is `router.push({ pathname: '/round', params: { kind: practiceId(kind) } })` and `openHowTo` is `router.push('/multiply-intro')`. Neither needs the chooser's open-sheet guard, since no sheet is fading out; guard only against the sheet being open (`chooser?.open`), in which case do nothing. `openChooser`, `closeChooser` and `choose` stay as they are. Remove `chooseRound`, the old `openHowTo`, and imports that fall out of use (`ATOMS`, `AtomGrid`, `atomStates`, `mentalCount`, `Button` if unused, `Link` only if unused — the header links still use it). Move `PlanBar`'s top margin into the card if it looks cramped (PlanBar has `marginTop: space.xl`; pass a style or accept it).
- Update Home's leading comments: Home is built around けたの練習 (spec §6); the session is behind the 基礎の練習 card.

`PartChooser.tsx`: remove the けたの練習 section, its state (`op`, `digits`), `DIGIT_OPTIONS`, the props `onChooseRound` / `onHowTo`, the unused imports and styles, and the comments about them.

Strings: remove `chooseHowTo` and any other key that no longer has a caller (`grep` each before removing; `roundSection`, `digitsName`, `opName`, `roundName`, `roundDetail`, `start` are still used — `roundDetail` only if a caller remains; remove it if not). Keep `mapPreviewTitle` only if still used.

- [ ] **Step 3: Pass, full check, commit**

```bash
git add src app __tests__
git commit -m "Build Home around けたの練習, with 基礎の練習 as a card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Simulator check, TestFlight build 12, PR (controller)

- [ ] `CI=1 npx expo start --ios`; Maestro on the iPhone 17 Pro simulator: Home (grid, やりかた, basics card); a ＋ 2けた round: 手順を見る, ▶ ▶ ◀, とじる restores the beads, answer; a miss at F0 steps through with the answer line; basics card → sheet → ぜんぶ → a question with 手順を見る. Screenshots.
- [ ] Mark the spec implemented; bump `ios.buildNumber` to 12; commit; release per `docs/release-ios.md` (revert prebuild's `package.json` change); wait for VALID; push; PR.
