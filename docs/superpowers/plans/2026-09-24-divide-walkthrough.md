# Division walkthrough, guess by guess — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace わり算のやりかた's text pages with a bead-by-bead walkthrough of 1692 ÷ 36 that shows each 九九 guess being tried, getting stuck, and being fixed; and give かけ算のやりかた a ◀ back button.

**Architecture:** A pure domain walk (`src/domain/divisionWalk.ts`, done) gives the steps, their bead steps and frames. Its captions come from the i18n catalogues (`divideWalk`, done). A new screen component, `DivideWalkthrough`, steps through the frames with ◀ ▶. `IntroScreen` takes the walkthrough as a render function, so `/divide-intro` renders the new component and `/multiply-intro` keeps `MethodIntro`.

**Tech Stack:** Expo 57 / React Native 0.86, expo-router, TypeScript 6, Jest 30 with @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-09-24-divide-walkthrough-design.md`

## Global Constraints

- **Style:** no semicolons, single quotes, 2-space indent, lines up to 120 columns (the `@stylistic` rules in `eslint.config.js`). Never run `prettier`: it has no config here and rewrites files in a foreign style. Use `npx eslint --fix <files>` only.
- **Comments** explain *why*, in the surrounding files' density and voice, citing the owner and a date where a choice is theirs (e.g. "The owner (2026-09-24) …").
- **No non-null assertions** (`!`); guard `undefined` from indexing (`noUncheckedIndexedAccess` is on).
- **React Compiler lint rules:** no reading `ref.current` during render.
- `npm test && npm run typecheck && npm run lint` must pass, with no new warnings. The baseline is 1 lint warning in `src/ui/kit/kit.test.tsx` and 2 act() warnings in `__tests__/home.test.tsx`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Unchanged:** ＋ − × rounds, 基礎, and the ÷ rounds (their 手順を見る still plays the right digit directly).

---

### Task 1: Domain walk — DONE (controller, commit 542fe3b)

`src/domain/divisionWalk.ts` exports:
- `WalkStep`, a union over `kind`: `set | guess | try | take | stuck | fix | done`. Every step has `steps: PlacedStep[]`, `cascades`, `left`, `focus: number[]` (rod indices), `marks: { rodIndex, amount }[]`, `divisorPlaces: number[]` and `answer: ({ digit, trial } | null)[]`.
- `divisionWalk(problem)`, `walkStates(problem, walk)`, and `walkFrames(walk) → { frames: { step, state }[], groupStarts: number[] }`.

`playDigits` and `productDigits` are now exported from `problem.ts`. For 1692 ÷ 36 the walk has 14 steps, 17 bead steps and 23 frames (tests in `divisionWalk.test.ts`).

### Task 2: Captions — DONE (controller, commit 0125c57)

`ja` and `en` gain:
- `divideWalk(problem, step) → WalkCaption { what, math, note, rods }`, with an empty string where a step has none. `WalkCaption` is exported from `ja.ts`.
- `divideWalkLeft` (のこり / left) and `divideWalkAnswer` (答え / Answer).
- `rodShortName(place)` (一 十 百 千 万 … / 1 10 100 1000 10k …).

Tests are in `src/i18n/divideWalk.test.ts`.

---

### Task 3: The `DivideWalkthrough` component

**Files:**
- Create: `src/ui/intro/DivideWalkthrough.tsx`
- Create: `src/ui/intro/DivideWalkthrough.test.tsx`
- Modify: `src/ui/session/StepPanel.tsx` (export `StepButton`, `BACK_GLYPH`, `NEXT_GLYPH`; no behaviour change)
- Modify: `src/ui/theme.ts` (add `ok: '#3F7D4E'` to `colors`, with a comment: a sum that comes off shows ✓ in it; the app had no green)

**Interfaces:**
- Consumes the Task 1 and Task 2 exports above, plus the existing `Abacus`, `tintsFor` (`@/ui/abacus/Abacus`), `stepColouring` (`@/domain/exercise`), `beadModeScale` and `geometryFor` (`@/ui/abacus/geometry`), `readRod` (`@/domain/soroban`), `Button` (`@/ui/kit/Button`), `OPERATION_SYMBOL` and `rodsFor` (`@/domain/problem`), and `strings.divideIntroTitle`, `strings.stepBack`, `strings.stepNext` and `strings.replayStep`.
- Produces `export function DivideWalkthrough({ problem, finishLabel, onFinish }: { problem: Problem; finishLabel: string; onFinish: () => void })`. It does not guard against a second finish tap; `IntroScreen` does that in Task 4.

**What it renders** (spec §4), top to bottom inside `<View style={{ flex: 1 }}>`:

1. **Header row** (as `MethodIntro`'s):
   - the title `strings.divideIntroTitle` (`accessibilityRole="header"`);
   - one dot per walk step (not per frame), testID `walk-dot-<i>`;
   - a dot `i <= frame.step` is filled with `colors.accent`, others `colors.track`;
   - a `stuck` step's dot is also outlined in `colors.accent` (1.5 pt border), whether reached or not.
2. **`ScrollView`** (`flex: 1`), so a short phone reaches the note while the controls stay pinned. It holds:
   - **Problem row**, space-between:
     - Left: `1692 ÷ 36` in `fonts.display`, `fontSizes.prompt`, built as a `Text` containing `${a} ${OPERATION_SYMBOL[op]} ` plus one nested `Text` per divisor digit, testID `walk-divisor-<place>` (place 0 = ones). A digit whose place is in `step.divisorPlaces` is `colors.accent` with `textDecorationLine: 'underline'`. Give the outer `Text` `accessibilityLabel` `${a} ÷ ${b}`.
     - Right: `strings.divideWalkAnswer`, then one box per `step.answer` entry, testID `walk-answer-<k>` (k = 0 is the highest digit), about 34×40 pt:
       - `null`: a dashed `colors.cardLine` border, empty;
       - trial: a `colors.accent` border, text `${digit}?` in the accent;
       - settled: a `colors.ink` border, text `${digit}`.
       - The box's `Text` child is the string, so tests can read `props.children`.
       - Give the row an `accessibilityLabel`: the label and the digits joined by spaces, with `?` on trial ones.
   - **Rod readings row** (a small `RodRow` helper in the same file), aligned with the soroban's rods. Given `g = geometryFor(scale)`, it is a `View` with `alignSelf: 'center'`, `flexDirection: 'row'` and `paddingHorizontal: g.framePadding + g.deckPadding`, holding one cell per rod, each `width: g.rodWidth` and centred. `Abacus` centres itself the same way, so the columns line up.
     - Each cell shows the rod's digit (`readRod`) in `fonts.display` at about 22 pt, testID `walk-reading-<i>`: `colors.accent` if `i` is in `step.focus`, else `colors.ink`.
     - Under it is a badge slot of fixed height, so nothing jumps when badges come and go. If `step.marks` has this rod, it shows a small pill, testID `walk-mark-<i>`: `colors.accentSoft` background, `colors.accent` text, `fontSizes.small`, bold.
     - The label comes from a `markLabel(step, amount)` helper:
       - `try` → `${amount}?` (`5?`);
       - `stuck` → signed with `?` (`−3?`);
       - otherwise signed (`−1`, `+3`), with U+2212 for minus.
   - **Soroban:** `<Abacus soroban={states[frame.state]} fade={0} scale={scale} highlightRods={step.focus} tintedBeads={tinted} />` in a `View` with testID `walk-soroban`.
     - `scale = beadModeScale(rodsFor(problem), width - 2 * space.xl)`, as `MethodIntro` does.
     - `tinted`: when `step.steps.length > 0`, `tintsFor(stepColouring(states, groupStarts, frame.state))`; otherwise `undefined`. A step without beads colours nothing.
   - **Rod names row:** `RodRow` again, with `strings.rodShortName(rods − 1 − i)` in `colors.muted`, `fontSizes.small`, and no badges.
   - **Explanation**, with `caption = strings.divideWalk(problem, step)`:
     - `caption.what` bold, `fontSizes.body + 2`, testID `walk-what`;
     - a row with `strings.divideWalkLeft` (muted, small), then `step.left` in `fonts.display` at about 24 pt (testID `walk-left`), then `caption.math` if non-empty (testID `walk-math`, `fonts.display` at about 18 pt): `colors.ok` if it ends with `✓`, `colors.accent` if it ends with `✗`, else `colors.ink`;
     - `caption.note` if non-empty (testID `walk-note`, `fontSizes.body`, lineHeight 22);
     - `caption.rods` if non-empty (testID `walk-rods`, `fontSizes.small`, `colors.muted`).
3. **Controls row, pinned below the scroll:**
   - `StepButton` ◀ (testID `walk-back`, label `strings.stepBack`, disabled on frame 0);
   - the count `strings.replayStep(index + 1, frames.length)` (testID `walk-count`, `flex: 1`, centred, tabular figures);
   - then either `StepButton` ▶ (testID `walk-next`, label `strings.stepNext`), or, on the last frame, `<Button testID="intro-finish" label={finishLabel} onPress={onFinish} />` in a `View` with `minWidth: 140`.

**State:** `const [index, setIndex] = useState(0)`. `frame = frames[index]`, `step = walk[frame.step]` and `soroban = states[frame.state]`, each with a safe fallback: the walk, frames and states are never empty, but indexing is typed as possibly undefined. ◀ is `setIndex(index − 1)` and ▶ is `setIndex(index + 1)`. `walk`, `states` and the frames are computed from `problem` each render (cheap, as `MethodIntro` does).

**VoiceOver:** the beads' slide is silent, so a change of frame is announced with `AccessibilityInfo.announceForAccessibility`:
- the new `what` and `math` (joined with `、`, skipping empties) when `frame.step` changed;
- otherwise the count.

Keep the last announced index in a ref read only inside the effect, as `StepControls` does. Nothing is announced on mount.

- [ ] **Step 1: Write the failing tests** (`src/ui/intro/DivideWalkthrough.test.tsx`). Render `<DivideWalkthrough problem={{ op: 'div', digits: 2, a: 1692, b: 36 }} finishLabel="はじめる" onFinish={onFinish} />`; the app's default locale in tests is ja, as in `MethodIntro.test.tsx`, so check how that file renders and follow it. Use `fireEvent.press(screen.getByTestId('walk-next'))` to step. Cover:
  - **Frame 1:**
    - `walk-what` reads `1692をそろばんに置く`, `walk-left` reads `1692`, `walk-count` reads `1 / 23`;
    - `walk-back` is disabled (`accessibilityState.disabled`);
    - `walk-answer-0` and `-1` are empty;
    - the readings are `0 1 6 9 2`.
  - **Frame 2 (the guess):**
    - `walk-math` reads `見当 16÷3 → 5`;
    - `walk-divisor-1` is accent and underlined, and `walk-divisor-0` is not (use `StyleSheet.flatten`);
    - `walk-reading-1` to `-3` are accent.
  - **Frame 3 (the try):** `walk-answer-0` reads `5?`, `walk-mark-0` reads `5?`, `walk-reading-0` reads `5`.
  - **Frames 4 and 5 (the first take):**
    - both show `walk-what` `50×30=1500を引く`;
    - frame 4 has `walk-reading-1` `0` and `walk-reading-2` `6`;
    - frame 5 has `walk-reading-2` `1`;
    - the marks read `−1` and `−5`.
  - **Frame 6 (stuck):** `walk-math` reads `192−300 ✗` and `walk-mark-2` reads `−3?`.
  - **Frame 9 (the fix's last bead):**
    - `walk-what` reads `戻す：5を4にして、300を足し戻す`, `walk-left` reads `492`, `walk-answer-0` reads `4?`;
    - the readings are `4 0 4 9 2`.
  - **Back:** from frame 7, ◀ returns to frame 6 (`walk-what` is the stuck line).
  - **Frame 11 (the 4 settled):** `walk-answer-0` reads `4`.
  - **Frame 23:**
    - `walk-what` reads `答えを読む`, and `walk-next` is gone;
    - pressing `intro-finish` calls `onFinish` once;
    - the answers read `4` and `7`.
  - **Dots:** 14 dots; `walk-dot-4` and `walk-dot-10` (the stuck steps) have an accent border.
- [ ] **Step 2: Run** `npx jest src/ui/intro/DivideWalkthrough` and see it fail.
- [ ] **Step 3: Implement** the component as described.
- [ ] **Step 4: Run** the tests again, then `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 5: Commit** (`git add` the four files) with a message that says why (the owner's request).

---

### Task 4: Wire the ÷ route to the new walkthrough and remove the old ÷ pages

**Files:**
- Modify: `src/ui/intro/IntroScreen.tsx`
  - replace the `problem` and `intro` props with `op: Operation` and `children: (finishLabel: string, onFinish: () => void) => ReactNode`;
  - move the once-only finish guard (a `useRef(false)` checked and set in `finish`, today in `MethodIntro`) here, so a second tap while the screen is leaving cannot save twice;
  - the kind check uses `op` where it used `problem.op`.
- Modify: `app/divide-intro.tsx`: `<IntroScreen op="div" complete={completeDivideIntro}>{(finishLabel, onFinish) => <DivideWalkthrough problem={EXAMPLE} finishLabel={finishLabel} onFinish={onFinish} />}</IntroScreen>`. Update the file's comments; the example stays 1692 ÷ 36.
- Modify: `app/multiply-intro.tsx`: the same shape, rendering `MethodIntro` with its current `intro` texts.
- Modify: `src/ui/intro/MethodIntro.tsx`:
  - remove `guess?` from `IntroTexts`, the `'guess'` page kind and its branch (× never had one; ÷ no longer uses `MethodIntro`);
  - remove the `finished` ref guard (now in `IntroScreen`);
  - update the comments that mention ÷ (it is now the × walkthrough, though still generic over the problem).
- Modify: `src/i18n/ja.ts` and `src/i18n/en.ts`: delete `divideIntroMethod`, `divideIntroGuess`, `divideIntroPlacement` and `divideIntroResult`, and the comment block about them. Keep `divideIntroTitle`, with a one-line comment.
- Modify tests:
  - `src/ui/intro/MethodIntro.test.tsx`: drop the ÷ cases and the ÷ texts at the top. Keep every × assertion. The double-tap test moves to the route tests, since the guard moved.
  - `__tests__/divide-intro-screen.test.tsx`: step through the new walkthrough with `walk-next` (22 presses reach frame 23, where `intro-finish` shows). Replace the "walks through 1692 ÷ 36 by 商除法" test with one that checks the title, `1692 ÷ 36` (`walk-divisor` digits inside the problem text), the first `walk-what`, and `答えを読む` at the end. Keep the hydrating, round-start, go-back and go-Home tests. Add: pressing `intro-finish` twice saves once.
  - `__tests__/multiply-intro-screen.test.tsx`: unchanged behaviour. Add the same double-tap test.
- Modify: `docs/superpowers/specs/2026-09-24-divide-design.md` §3 "Walkthrough": replace its text-page list with one line pointing to `2026-09-24-divide-walkthrough-design.md`, and keep the route and flag facts.

- [ ] **Step 1:** Update the tests first (route tests with the new controls, double-tap tests); run them and see them fail.
- [ ] **Step 2:** Make the changes above.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint`. Search for leftovers: `grep -rn "divideIntroMethod\|divideIntroGuess\|divideIntroPlacement\|divideIntroResult\|intro.guess\|kind: 'guess'" src app __tests__` must find nothing outside `divisionWalk`.
- [ ] **Step 4:** Commit.

---

### Task 5: ◀ in the × walkthrough

**Files:**
- Modify: `src/ui/intro/MethodIntro.tsx`
- Modify: `src/ui/intro/MethodIntro.test.tsx`
- Modify: `src/i18n/ja.ts` and `src/i18n/en.ts`: add `introBack` (ja `もどる`, en `Back`).

**What:** the owner (2026-09-24) asked for a way back through the walkthroughs. The pinned bottom button becomes a row:
- an outline `Button` (testID `intro-back`, label `strings.introBack`), not rendered on the first page;
- then the existing primary button (`intro-next`, or `intro-finish` on the result page), `flex: 1`.

Give both a `space.sm` gap. `back()`:
- sets `page − 1`;
- if the page it lands on is a group page, `replay.play(groupStates(index))`, so the group plays again;
- otherwise `replay.stop()`, so the soroban shows that page's start (`states[0]` for method and placement).

- [ ] **Step 1: Failing tests** in `MethodIntro.test.tsx`, using the existing × setup:
  - no `intro-back` on the method page;
  - from the placement page, ◀ returns to the method page's text;
  - from the first group page, after its replay has played out (advance the fake timers), ◀ to the placement page shows the empty soroban again (as the tests read the soroban today);
  - from the second group page, ◀ to the first group page replays it: its first state shows, then after `REPLAY_STEP_MS` the next.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm test && npm run typecheck && npm run lint`.
- [ ] **Step 4:** Commit.

---

### After the tasks (controller)

1. Final whole-branch review.
2. Simulator check on an iPhone 17 Pro (the ÷ walkthrough from Home's わり算のやりかた link, all 23 frames; the × walkthrough's ◀), and the note reachable on a short window.
3. TestFlight build 21, then a PR. Merge only when the owner says so.
