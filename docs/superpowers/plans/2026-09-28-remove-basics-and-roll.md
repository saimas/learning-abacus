# Remove 基礎の練習, and Roll From Problem to Problem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the 基礎の練習 single-move session from the app, and make every けたの練習 round show the 〇 on the answered problem, then visibly roll to the next.

**Architecture:** 基礎 is removed from the outside in: screens and routes first (Task 1), then the domain, storage and strings nothing uses any more (Task 2). `QuestionView` then drops the props only a session used and draws the 〇 on its own right answer (Task 3), and `RoundRunner` owns the roll: hold, slide out, swap, slide in, start the next problem's clock (Task 4).

**Tech Stack:** Expo SDK 57, React Native 0.86 (`Animated`), TypeScript (strict, `noUncheckedIndexedAccess`), Jest 30 with fake timers and `@testing-library/react-native` 13.

**Spec:** `docs/superpowers/specs/2026-09-28-remove-basics-and-roll-design.md` — read it first.

## Global Constraints

- House style (ESLint enforces): no semicolons, single quotes, 2-space indent. Comments say why; cite the new spec as `Spec (roll) §N` and keep existing citations.
- `src/domain/` imports nothing from React, React Native, `@/ui`, `@/storage` or `@/i18n`.
- Every task ends green on `npm test`, `npm run typecheck` and `npm run lint`.
- Kept, untouched in behaviour: the first-launch tutorial, settings (days practised, language, reset), both walkthroughs, every round, `markDayPracticed`, `calibrationMs` (stored value kept, no longer updated), the practice records and walkthrough flags. No `SCHEMA_VERSION` bump.
- Roll timings: `ROLL_HOLD_MS = 700`, `ROLL_OUT_MS = 175`, `ROLL_IN_MS = 175`. Reduce Motion (`AccessibilityInfo.isReduceMotionEnabled()`) fades instead of sliding, same durations.
- Commits end with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Quitting mid-roll** (✕ during the hold or the slide): the attempt is already recorded, nothing throws, and no timer or animation fires into the unmounted round — Task 4.
- **Pressing こたえる twice** on a right answer (double tap): one attempt, one roll — Tasks 3 and 4.
- **The last problem right**: the summary rolls in, and its おわる works — Task 4.
- **A stored document from before** (with `atoms` and `highestStage`): loads, keeps days practised, practices and calibration — Task 2.
- **The next problem's pace**: measured from when it has arrived, not from the previous answer — Task 4.

---

### Task 1: Remove 基礎の練習 from the screens

**Files:**
- Modify: `app/index.tsx`, `app/progress.tsx`, `app/_layout.tsx`, `src/ui/ProgressProvider.tsx`
- Delete: `app/session.tsx`, `src/ui/session/SessionRunner.tsx`, `src/ui/session/SessionTrack.tsx`, `src/ui/session/CorrectionCard.tsx`, `src/ui/home/PartChooser.tsx`, `src/ui/home/PlanBar.tsx`, `src/ui/progress/AtomGrid.tsx`
- Delete tests: `src/ui/session/SessionRunner.test.tsx`, `src/ui/session/SessionRunner.integration.test.tsx`, `src/ui/session/SessionTrack.test.tsx`, `src/ui/session/CorrectionCard.test.tsx`, `src/ui/home/PartChooser.test.tsx`, `src/ui/progress/AtomGrid.test.tsx`, `__tests__/session-screen.test.tsx`
- Modify tests: `__tests__/home.test.tsx`, `__tests__/progress-screen.test.tsx`, `__tests__/layout.test.tsx`, `src/ui/ProgressProvider.test.tsx`

**Interfaces:**
- Produces: `useProgress()` no longer has `attempt` (the provider's API is `progress`, `hydrated`, `practise`, `flush`, `reset`, `completeTutorial`, `completeMultiplyIntro`, `completeDivideIntro`). No `/session` route. Home has no `home-basics`; the progress screen has no `atom-map-*`.
- Leaves for Task 2: `src/domain/session.ts`, `curriculum.ts`, `recordAttempt` etc. still exist, unused by any screen.

- [ ] **Step 1: Update the tests to the new screens (they fail first)**
  - `__tests__/home.test.tsx`: delete every test about the 基礎の練習 card, its chooser sheet or its plan bar (they press or query `home-basics`, `choose-*`, `plan-*`, or expect a push to `/session`). Add:

```tsx
  // Spec (roll) §2: 基礎の練習 is gone; Home is the grid and its links.
  it('has no 基礎の練習 card', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(queryByTestId('home-basics')).toBeNull()
  })
```

  - `__tests__/progress-screen.test.tsx`: delete any assertion about the atom map (`atom-map-*`, `atom-cell-*`, `atom-summary`), and add to its `describe('ProgressScreen')`:

```tsx
  // Spec (roll) §2: the 180-move map went with 基礎の練習.
  it('shows the practice table and no 180-move map', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider>
        <ProgressScreen />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(queryByTestId('atom-map-add')).toBeNull()
  })
```
  - `__tests__/layout.test.tsx`: in `'never lets a swipe leave a session or a round'`, drop the `session` expectation and rename it `'never lets a swipe leave a round'`; add `expect(Object.keys(mockScreenOptions)).not.toContain('session')` to it.
  - `src/ui/ProgressProvider.test.tsx`: every `api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500, assisted: … })` becomes `api?.practise({ id: 'add:1', correct: true, pace: null, assisted: … })`, and assertions on `progress.atoms['1+3']` become assertions on `progress.practices['add:1']` (a correct untimed bead answer at fade 0 leaves `fade: 0`, `consecutiveCorrect: 1`). Delete `'attempt with help marks the day practised and leaves the moves as they were'` (the `practise` twin already exists).
  - Delete the seven test files listed under Files.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest __tests__/home.test.tsx __tests__/progress-screen.test.tsx __tests__/layout.test.tsx src/ui/ProgressProvider.test.tsx`
Expected: the new "no card" / "no map" / "no session route" tests FAIL (the card, map and route still exist); the rewritten provider tests pass.

- [ ] **Step 3: Remove the screens**
  - `app/index.tsx`: remove the imports of `selectSession`/`SessionPlan`, `PartChooser`/`PartChoice`, `PlanBar` and `Card`; the `chooser` state and its comment; the `setChooser(...)` line in the `AppState` listener (and its comment); `openChooser`, `closeChooser`, `choose`; the `chooser?.open ||` conditions in `startRound` and `openHowTo` (keep the `leaving` guard; update the comment above them, which mentions the sheet); the `home-basics` `Pressable`; the `<PartChooser …/>` element; the styles `basics`, `basicsPressed`, `basicsHeader`, `basicsTitle`, `basicsDetail`; and in the `scroll` style's comment, "the basics card" → "the walkthrough links". Update the component's header comment: Home is the けたの練習 grid, its walkthrough links, and the days-practised seal.
  - `app/progress.tsx`: remove the `AtomGrid` import and element.
  - `app/_layout.tsx`: remove `<Stack.Screen name="session" … />`.
  - `src/ui/ProgressProvider.tsx`: remove `attempt` (the callback, its type entry, its value entry), the `recordAttempt` import and the `AttemptResult` import.
  - Delete the seven source files listed under Files.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. (Nothing outside the deleted files imported them; if typecheck names a file that still does, remove that use.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove 基礎の練習 from the screens: Home, the chooser, /session, the map

Home is the けたの練習 grid and its walkthrough links; the progress screen
keeps the table. The session screen, its runner, track, correction card,
chooser, plan bar and the 180-move map go, with the provider's attempt.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Remove 基礎の練習 from the domain, storage and strings

**Files:**
- Delete: `src/domain/session.ts`, `src/domain/curriculum.ts`, and tests `src/domain/session.test.ts`, `src/domain/curriculum.test.ts`, `src/domain/fadeLadder.simulation.test.ts`
- Modify: `src/domain/fluency.ts` (+ `fluency.test.ts`), `src/domain/progress.ts` (+ `progress.test.ts`), `src/domain/exercise.ts` (+ `exercise.test.ts`), `src/storage/progressStore.ts` (+ `progressStore.test.ts`), `src/i18n/ja.ts`, `src/i18n/en.ts` (+ `catalogs.test.ts` and any other i18n test using a removed key), `__tests__/settings-reset.test.tsx` if it asserts on `atoms`
- Docs: `README.md`, `docs/superpowers/specs/2026-09-20-learning-abacus-curriculum-design.md`, `docs/superpowers/plans/2026-09-20-phase-1-single-rod-anzan.md`

**Interfaces:**
- Consumes: Task 1 (no screen uses the session any more).
- Produces: `Progress` = `{ schemaVersion, daysPracticed, lastSessionDay, calibrationMs, tutorialDone, practices, multiplyIntroDone, divideIntroDone }`. `fluency.ts` exports only `CLASS_TARGET_MS`, `TARGET_MARGIN`, `MIN_TARGET_MS`, `MAX_TARGET_MS`, `latencyTargetMs`. `exercise.ts` exports `Exercise`, `exerciseForProblem`, `StepColouring`, `stepColouring`.

- [ ] **Step 1: The storage test for an older document (fails first)**

In `src/storage/progressStore.test.ts` add:

```ts
// Spec (roll) §2: 基礎's fields are no longer read. A document written with
// them still loads, and keeps everything else.
it('loads a document that still has 基礎’s moves and stage, without them', async () => {
  const practices = { 'add:2': { fade: 3, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 5 } }
  mockGetItem.mockResolvedValue(
    JSON.stringify({
      ...emptyProgress(),
      atoms: { '1+3': { atomId: '1+3', box: 4, fade: 6 } },
      highestStage: 3,
      daysPracticed: 12,
      calibrationMs: 700,
      practices,
    }),
  )
  const loaded = await loadProgress()
  expect(loaded).not.toHaveProperty('atoms')
  expect(loaded).not.toHaveProperty('highestStage')
  expect(loaded.daysPracticed).toBe(12)
  expect(loaded.calibrationMs).toBe(700)
  expect(loaded.practices).toEqual(practices)
})
```

and delete this file's tests about `atoms` or `highestStage` (loading, validating or defaulting them).

Run: `npx jest src/storage/progressStore.test.ts` — Expected: the new test FAILS (`atoms` is still loaded).

- [ ] **Step 2: Remove the domain**
  - Delete `src/domain/session.ts`, `src/domain/curriculum.ts` and the three test files listed.
  - `src/domain/fluency.ts`: keep only `CLASS_TARGET_MS`, `TARGET_MARGIN` (with its comment), `MIN_SCALE`, `MIN_TARGET_MS`, `MAX_TARGET_MS`, `latencyTargetMs` and the "first estimates" note; delete `AtomRecord`, `LEITNER_MAX_BOX`, `REFLEX_MIN_BOX`, `LATENCY_WINDOW`, `MINUTE`, `BOX_INTERVAL_MS`, `newRecord`, `medianLatencyMs`, `isReflex`, `applyAttempt` and the imports they alone needed. Add a line to the file's top comment: these are the per-move time targets a round's target is built from (`problemTargetMs`); the per-move records that once used them went with 基礎 (spec (roll) §2). In `fluency.test.ts` delete the tests of removed functions; keep `latencyTargetMs`'s.
  - `src/domain/progress.ts`: remove `atoms` and `highestStage` from `Progress` and `emptyProgress`, and `higherStage`, `classFor`, `recalibrate`, `recordAttempt`, `currentStage`, `CellState`, `cellState`, `atomStates`, `mentalCount`, with the imports they alone needed. Comments that say "Added without a schema bump, like highestStage" become "Added without a schema bump". Keep `SCHEMA_VERSION`, `DEFAULT_CALIBRATION_MS`, `emptyProgress`, `dayKey`, `markDayPracticed`, `recordPracticeAttempt`. Above `calibrationMs` add: `// Measured by 基礎の練習 until it was removed (spec (roll) §2); kept as stored, it still sets a round's time targets.` In `progress.test.ts` delete the tests of removed functions and fix `emptyProgress`'s expected shape.
  - `src/domain/exercise.ts`: delete `exerciseForAtom` and the imports it alone needed. In `exercise.test.ts` delete the `exerciseForAtom` describe, and rewrite `'treats a single move as one operation'` to build its states with `moveStates(atom)` from `./atoms` and colour with `stepColouring(moveStates(atom), [0], 2)` (same expectation).
  - `src/storage/progressStore.ts`: remove `asStageIndex`, the `StageIndex` import, the `atoms` parsing and the `atoms` / `highestStage` fields of the returned object; comments that point at `highestStage` ("like highestStage") are reworded to stand alone.
  - If `__tests__/settings-reset.test.tsx` asserts on `atoms` or `highestStage`, assert on `practices` / `daysPracticed` instead.

- [ ] **Step 3: Remove the strings**

From both `src/i18n/ja.ts` and `src/i18n/en.ts` remove these members of the catalogue object: `chooseTitle`, `chooseAll`, `chooseAllDetail`, `chooseOnly`, `chooseDetail`, `chooseEmpty`, `chooseClose`, `sessionComplete`, `prompt`, `coaching`, `coachingLead`, `blockLabel`, `atomSummary`, `cellLabel`, `cellStateName`, `mapAdd`, `mapSub`, `mapAxis`, `basicsTitle`, `basicsDetail`. Then remove every module-level constant, function and type import that nothing uses any more (the linter's `no-unused-vars` names them: e.g. `BLOCK_LABEL`, `CELL_STATE`, the `BlockKind` / `PracticePart` / `CellState` imports). **Keep** the module-level functions `coaching` and `coachingLead` and the `TECHNIQUE` table: `columnLine` builds ＋ − and 見取算 lines from them. In `catalogs.test.ts` (and any other i18n test) delete the tests of removed members.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass, including Step 1's test.

- [ ] **Step 5: Docs**
  - `README.md`: rewrite for an app of one kind of practice, けたの練習. Keep: the backend-free/offline intro; the 180 moves (every problem's steps are explained as them — keep the class table); the fade ladder (now per kind of problem: five fast right answers in a row promote, two misses demote; beads F0–F2, keypad from F3); the けたの練習 section; Prerequisites, Getting started, Testing, Releasing, Docs. Remove: the 基礎の練習 session section and table, "Each session starts with at most two new atoms…", the "two kinds of practice" framing, the Progress screen's map (it shows the けたの練習 table), and "A recalibration session after a long absence" from "Not in the app yet". Screens: Tutorial, Home (seal, the けたの練習 grid, the walkthrough links), Round, Progress (the table), Settings.
  - `docs/superpowers/specs/2026-09-20-learning-abacus-curriculum-design.md` and `docs/superpowers/plans/2026-09-20-phase-1-single-rod-anzan.md`: add under the title: `> 2026-09-28: 基礎の練習 (the single-move daily session this describes) was removed from the app at the owner's request; see docs/superpowers/specs/2026-09-28-remove-basics-and-roll-design.md. Kept as history.`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove 基礎の練習 from the domain, storage and strings

The session, curriculum and per-move scheduling go, with Progress's atoms
and highestStage (no longer read or written; an older document still
loads). The per-move time targets stay, since a round's targets are built
from them, and so does the stored calibration. README rewritten for
けたの練習 alone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `QuestionView` draws the 〇 on its own right answer

**Files:**
- Modify: `src/ui/session/QuestionView.tsx`, `src/ui/session/QuestionView.test.tsx`, `src/ui/session/Maru.tsx` (comment only), `src/ui/round/RoundRunner.tsx` (call site)

**Interfaces:**
- Produces: `QuestionView` props no longer include `demonstration`, `track` or `maru`. After a right answer it shows the 〇 (`testID="maru"`) over its own soroban, locks the beads, and ignores further こたえる presses; `onSubmit` is still called once, as now.

- [ ] **Step 1: Tests (fail first)**

In `QuestionView.test.tsx`:
- In `renderView`, remove `demonstration={null}`, `track={null}` and `maru={0}`.
- Delete the tests whose subject is the demonstration line: `'offers 手順を見る with the demonstration at F0, …'`, `'keeps the demonstration line on show in bead mode while the panel is open'`, `'lets the demonstration line go in keypad mode while the panel is open'`, and any other test that asserts on `testID="demonstration"`. In tests that pass `demonstration: '385は…'` only incidentally (for example to check drawing order), remove that override and the demonstration assertions, keeping the rest.
- Delete tests that drive the 〇 through the `maru` prop, and add:

```tsx
// Spec (roll) §3: a right answer's 〇 is stamped on the answered question,
// which stays as answered, and a second こたえる does nothing.
describe('QuestionView after a right answer', () => {
  it('stamps the 〇 over its own soroban and takes no second answer', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 857, 4)
    expect(screen.queryByTestId('maru')).toBeNull()
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({ correct: true }))
    expect(screen.getByTestId('maru')).toBeTruthy()
    // The beads stay as answered, and take no taps.
    expect(rods()).toBe('0857')
    fireEvent(screen.getByTestId('rod-3'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(rods()).toBe('0857')
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('stamps nothing on a wrong answer', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('maru')).toBeNull()
  })
})
```

Run: `npx jest src/ui/session/QuestionView.test.tsx` — Expected: the new tests FAIL (no 〇 without the `maru` prop; the beads still move).

- [ ] **Step 2: Implement**

`src/ui/session/QuestionView.tsx`:
- Remove the `demonstration`, `track` and `maru` props (destructuring, types and their comments), `demonstrationLine` and its style, and `{track}` in both layouts.
- Add state beside `review`:

```ts
  // Spec (roll) §3: a right answer stays on screen under its 〇 until the
  // round rolls on, and takes no second answer meanwhile.
  const [answeredRight, setAnsweredRight] = useState(false)
```

- In `submit()`, as its first line: `if (answeredRight) return`. In its `if (correct)` branch, before the announcement: `setAnsweredRight(true)`.
- `stamp` becomes:

```tsx
  // The ✕ over a missed question under review, or the 〇 over a right one
  // until the round rolls on. Either is decoration and never takes a tap.
  const stamp = (size: number) => {
    if (review === null && !answeredRight) return null
    return (
      <View style={styles.stampOverlay} pointerEvents="none">
        {review !== null ? <Batsu size={size} /> : <Maru size={size} />}
      </View>
    )
  }
```

- Bead mode's `locked` becomes `review !== null || beforeAnswer || answeredRight`.

`src/ui/session/Maru.tsx`: the header comment becomes: `// A big vermilion 〇 stamped over the answered question's soroban, drawn and faded in ~0.8s. The round holds the answered question under it before rolling on (RoundRunner, spec (roll) §3), so the latency the next question records starts after it. Decoration only: it never intercepts a tap.`

`src/ui/round/RoundRunner.tsx`: remove the `maru` state and its comment, the `setMaru(...)` calls, and the `demonstration={null}`, `track={null}` and `maru={maru}` props. (The round still moves on at once; Task 4 adds the roll.)

- [ ] **Step 3: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Stamp the 〇 on the answered question itself

QuestionView draws the 〇 over its own soroban after a right answer,
locks the beads and takes no second answer. The props only 基礎 used
(demonstration, track, maru) go.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `RoundRunner` rolls from problem to problem

**Files:**
- Modify: `src/ui/round/RoundRunner.tsx`, `src/ui/round/RoundRunner.test.tsx`, `__tests__/round-screen.test.tsx` (only if a test there answers and then expects the next problem at once), `README.md` (one line)

**Interfaces:**
- Consumes: Task 3's `QuestionView` (the 〇 on its own right answer; `onSubmit` once; `onMoveOn` after a miss).
- Produces: exported `ROLL_HOLD_MS`, `ROLL_OUT_MS`, `ROLL_IN_MS` from `RoundRunner.tsx`; a `roll-blocker` view (testID) over the question while a roll is pending or running.

- [ ] **Step 1: Tests (fail first)**

In `src/ui/round/RoundRunner.test.tsx`:
1. Import `ROLL_HOLD_MS, ROLL_IN_MS, ROLL_OUT_MS` from `./RoundRunner`, `AccessibilityInfo` from `react-native` (add it to the existing `react-native` import) and `problemTargetMs` from `@/domain/problem` (add it to the existing import), and add helpers under `answerBeads`:

```tsx
// Spec (roll) §3: after a right answer the problem is held under its 〇,
// then rolls out and the next rolls in.
function finishRightAnswerRoll() {
  act(() => jest.advanceTimersByTime(ROLL_HOLD_MS + ROLL_OUT_MS + ROLL_IN_MS + 50))
}
// After a miss's つぎへ there is no hold, only the roll.
function finishRoll() {
  act(() => jest.advanceTimersByTime(ROLL_OUT_MS + ROLL_IN_MS + 50))
}
```

2. Every existing test that answers right and then expects the next problem (or the summary) calls `finishRightAnswerRoll()` after each such answer; every test that presses `review-next` and then expects the next problem calls `finishRoll()` after it. (For example `'plays the problems in order, counting them'`, `'ends with the summary after the last problem'`, `'reviews a miss, then moves on without repeating it'`, and the ÷ tests that answer then check the summary.) Do the same in `__tests__/round-screen.test.tsx` wherever a test answers and then expects the next problem, importing the constants from `@/ui/round/RoundRunner`.

3. Append:

```tsx
describe('RoundRunner rolling from problem to problem', () => {
  it('holds a right answer under its 〇, then rolls to the next problem', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    // Recorded at once; the answered problem stays, stamped, and cannot be
    // answered again.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    // Still there just before the hold ends.
    act(() => jest.advanceTimersByTime(ROLL_HOLD_MS - 50))
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
    expect(screen.queryByTestId('maru')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
  })

  it('rolls to the next problem after a miss’s つぎへ', () => {
    renderRound()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  it('rolls the summary in after the last problem', () => {
    const { onFinish } = renderRound({ problems: [{ op: 'add', digits: 2, a: 23, b: 58 }] })
    answerBeads(81)
    expect(screen.queryByTestId('summary-text')).toBeNull()
    finishRightAnswerRoll()
    expect(screen.getByTestId('summary-result').props.children).toBe('1問中 1問正解')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  // Review focus: the next problem's clock starts when it has arrived.
  it('times the next problem from its arrival, not from the last answer', () => {
    let clock = 0
    const onAttempt = jest.fn()
    render(
      <RoundRunner
        kind={{ op: 'add', digits: 2 }}
        problems={problems}
        fade={3}
        calibrationMs={900}
        onAttempt={onAttempt}
        onFinish={jest.fn()}
        now={() => clock}
      />,
    )
    clock = 1_000
    for (const digit of '81') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    clock = 10_000
    finishRightAnswerRoll()
    clock = 12_000
    for (const digit of '100') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    // pace is latency over the problem's target, so latency = pace × target.
    // 81 took 1 000 ms from the round's start (clock 0); 100 took 2 000 ms
    // from its arrival at 10 000 — not the 11 000 since the last answer.
    const target = (a: number, b: number) => problemTargetMs({ op: 'add', digits: 2, a, b }, 900)
    expect(onAttempt.mock.calls[0][0].pace * target(23, 58)).toBeCloseTo(1_000, 5)
    expect(onAttempt.mock.calls[1][0].pace * target(46, 54)).toBeCloseTo(2_000, 5)
  })

  // Review focus: leaving mid-roll keeps the answer and fires nothing later.
  it('keeps the answer and fires nothing once unmounted mid-roll', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledTimes(1)
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_HOLD_MS + ROLL_OUT_MS + ROLL_IN_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('fades instead of sliding with Reduce Motion on, and gets to the same place', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    renderRound()
    await act(async () => {})
    answerBeads(81)
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    spy.mockRestore()
  })
})
```

Run: `npx jest src/ui/round/RoundRunner.test.tsx` — Expected: the new tests FAIL (the next problem appears at once, there is no blocker, the summary appears at once).

- [ ] **Step 2: Implement the roll**

`src/ui/round/RoundRunner.tsx`:
- Imports: `useEffect` from `react`; `AccessibilityInfo`, `Animated`, `useWindowDimensions` from `react-native`.
- Beside the other constants (above the component):

```ts
// Spec (roll) §3: a right answer's 〇 is held on the answered problem for
// ROLL_HOLD_MS; then it rolls out and the next rolls in, so the change of
// problem is seen (the owner, 2026-09-28: "i didnt notice the problem moved
// to next … it rolled even before i see red circle").
export const ROLL_HOLD_MS = 700
export const ROLL_OUT_MS = 175
export const ROLL_IN_MS = 175
```

- In the component, with the other hooks and **above** the `problem === undefined` early return (hooks must run on every render), add:

```ts
  const { width } = useWindowDimensions()
  // While a roll is pending or running: a blocker over the question takes
  // its taps, so nothing is answered or stepped mid-roll.
  const [rolling, setRolling] = useState(false)
  const offset = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(1)).current
  // Spec (roll) §3: with Reduce Motion on, the problem fades out and in.
  const reduceMotion = useRef(false)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on
    })
    // Leaving mid-roll: nothing may fire into the unmounted round.
    return () => {
      if (hold.current !== null) clearTimeout(hold.current)
      offset.stopAnimation()
      opacity.stopAnimation()
    }
  }, [offset, opacity])

  // Rolls to problem `to` (or the summary, past the last): out, swap, in.
  // The new problem's clock starts once it has arrived (spec (roll) §3).
  function roll(to: number) {
    setRolling(true)
    const fade = reduceMotion.current
    const out = fade
      ? Animated.timing(opacity, { toValue: 0, duration: ROLL_OUT_MS, useNativeDriver: false })
      : Animated.timing(offset, { toValue: -width, duration: ROLL_OUT_MS, useNativeDriver: false })
    out.start(({ finished }) => {
      if (!finished) return
      setIndex(to)
      // The next one starts where it rolls in from: off to the right, or
      // unseen.
      if (fade) opacity.setValue(0)
      else offset.setValue(width)
      const into = fade
        ? Animated.timing(opacity, { toValue: 1, duration: ROLL_IN_MS, useNativeDriver: false })
        : Animated.timing(offset, { toValue: 0, duration: ROLL_IN_MS, useNativeDriver: false })
      into.start(({ finished: arrived }) => {
        if (!arrived) return
        setShownAt(now())
        setRolling(false)
      })
    })
  }
```

- Replace the summary early return and the final `return` so both roll inside the same animated view. The `problem === undefined` branch keeps its `SessionSummary` element but no longer returns it directly; instead:

```tsx
  const animated = { flex: 1, opacity, transform: [{ translateX: offset }] }
  const blocker = rolling ? <View testID="roll-blocker" style={StyleSheet.absoluteFill} /> : null

  if (problem === undefined) {
    return (
      <View style={styles.practice}>
        <Animated.View style={animated}>
          <SessionSummary … (unchanged props) />
        </Animated.View>
        {blocker}
      </View>
    )
  }
```

  and the practice return becomes:

```tsx
  return (
    <View style={styles.practice}>
      <RoundTrack index={index} total={problems.length} onQuit={onQuit} />
      <View style={styles.practice}>
        <Animated.View style={animated}>
          <QuestionView … (as now) />
        </Animated.View>
        {blocker}
      </View>
    </View>
  )
```

  (The track stays outside the blocker, so ✕ still works mid-roll.)
- Delete `next(t)`. In `submitted`, the `if (correct)` branch becomes:

```ts
    if (correct) {
      // Held under its 〇, then rolled away (spec (roll) §3).
      setRolling(true)
      hold.current = setTimeout(() => {
        hold.current = null
        roll(index + 1)
      }, ROLL_HOLD_MS)
    }
```

  and the `else` branch (which only reset `maru`, removed in Task 3) is dropped.
- `onMoveOn={next}` becomes `onMoveOn={() => roll(index + 1)}`.
- Update the comment above the practice return: the count sits outside the rolling view, so it stays put while the problem rolls, and changes as the next problem arrives.

- [ ] **Step 3: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 4: README**

In `README.md`'s けたの練習 section add a bullet: "- **After an answer**, a right one is stamped with a 〇 where it stands; then the problem rolls out and the next rolls in (a fade with Reduce Motion on). A miss's つぎへ rolls the same way."

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Roll from problem to problem, after the 〇 on the answered one

A right answer is held under its 〇 for 0.7 s, then the problem slides
out and the next slides in (a fade with Reduce Motion on); a miss's つぎへ
and the last problem's summary roll the same way. The attempt is
recorded at once, and the next problem's clock starts on arrival.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### After the tasks (controller)

1. Final whole-branch review.
2. Simulator check on an iPhone 17 Pro and a 375 × 667 screen: Home without the 基礎 card; the progress screen without the map; a round: a right answer → the 〇 on the answer → the roll → 2 / 10; a miss → つぎへ → the roll; the last problem → the summary rolls in.
3. Bump `ios.buildNumber` to 25, TestFlight build from the branch, push, PR.
