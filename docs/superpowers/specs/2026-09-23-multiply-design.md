# learning-abacus — Multiplication 掛算 (roadmap P2)

Date: 2026-09-23
Status: Approved design, pre-plan. Sub-project P2 of `2026-09-23-n-by-n-roadmap.md`, building on P1 (`2026-09-23-multi-digit-add-sub-design.md`).

## 1. Goal and decisions

The owner asked for N × N practice for all four operations, N up to 3. P1 shipped ＋ and − (TestFlight build 9). This spec adds ×.

Decisions made with the owner:
- **Method: 両落とし, worked from the top.** Neither number is set on the soroban. The learner reads both from the prompt and builds only the product: the multiplicand's digits from the left, each times the multiplier's digits from the left, each 九九 result added as two digits at its place. This is the method taught for the 検定 today, and it settles the roadmap's §6 rods question: the soroban shows the product only, 2N rods.
- **Sizes: 1×1, 2×2, 3×3,** on the existing 1 / 2 / 3けた control. 1×1 is the 九九 itself, so it doubles as the times-tables drill.
- **Beads at every size,** scaled to fit. 3×3 is 6 rods, about 0.8× on a 375 pt phone. If the simulator check shows 6 rods too fiddly to tap, 3×3 answers on the keypad instead (the owner's stated fallback).
- **Teaching: a walkthrough, then the miss review.** The first × round opens with a short walkthrough of one 2×2 problem, one 九九 at a time. It can be replayed from the chooser. After that, a miss's answer card lists each 九九 and the replay highlights it.
- Carried over from P1 without change: every size open from the start, rounds of 10, the speed-aware fade ladder, one record per kind, a row on the progress table.

Out of scope: ÷ (P3), N × 1 sizes, the traditional placement with the multiplicand set on the soroban, a live guided mode.

## 2. What exists (after P1)

- `src/domain/problem.ts`: `Operation = 'add' | 'sub'`, `Digits`, `PracticeKind`, `PracticeId`, `Problem = { op, digits, a, b }`, `generateProblems`, `rodsFor(digits)`, `problemSteps(problem): ColumnStep[]` (one per column, each `{ place, atom, steps, cascades }`), `problemStates`, `columnOfStep`, `problemTargetMs`, and the private `placeMove(soroban, index, atom)` that plays one of the 180 atoms on a rod with cascading carries.
- `src/domain/exercise.ts`: `exerciseForProblem` starts the soroban at `a`.
- `src/ui/session/QuestionView.tsx`: bead mode scales with `beadModeScale(rods, width)`; **keypad mode draws the soroban at scale 1**, which is 416 pt for 6 rods and overflows a phone.
- `src/ui/round/RoundRunner.tsx`, `ProblemCorrectionCard.tsx`, `app/round.tsx`: the round.
- `src/ui/home/PartChooser.tsx`: the けたの練習 section with ＋ / − and 1 / 2 / 3けた.
- `src/ui/progress/PracticeTable.tsx`: rows from `OPERATIONS`, with the row glyph hard-coded as ＋ or −.
- `app/tutorial.tsx` + `ReadingDrill` and `Progress.tutorialDone` + `completeTutorial()`: the pattern for a one-time walkthrough.

## 3. Domain (`src/domain/problem.ts`)

### Types

- `Operation = 'add' | 'sub' | 'mul'`, so `PracticeId` runs `add:1` … `mul:3` and `PRACTICE_KINDS` has nine kinds. Storage and routes pick this up through `isPracticeId`.
- `OPERATION_SYMBOL: Record<Operation, string> = { add: '＋', sub: '−', mul: '×' }`, shared by the chooser and the progress table (the symbols are the same in every language).
- `rodsFor(problem: { op, digits })`: `digits + 1` for ＋ and −, `digits × 2` for ×. Its callers pass the problem or kind.

### Generation

- × uses the same exactly-N-digits rule, except that 1×1 draws from 2–9, since × 1 teaches nothing. Pairs are distinct and ordered: 7 × 8 and 8 × 7 are different problems.
- `answerOf` gives `a × b`.

### Steps: groups

`problemSteps(problem): StepGroup[]`, replacing `ColumnStep`:

```ts
export type Move = { place: number; atom: Atom; steps: PlacedStep[]; cascades: boolean }
export type StepGroup =
  | { kind: 'column'; place: number; atom: Atom | null; steps: PlacedStep[]; cascades: boolean }
  | { kind: 'product'; x: number; y: number; place: number; moves: Move[]; steps: PlacedStep[]; cascades: boolean }
```

- ＋ and − produce the same column groups as today, now tagged `kind: 'column'`.
- × starts from an empty soroban of `rodsFor` rods. For each digit `x` of `a` from the highest place `i` down, and for each digit `y` of `b` from the highest place `j` down, the product `x × y` is added as its tens digit at place `i + j + 1`, then its ones digit at place `i + j`. A digit of 0 is not a move (7 × 0 adds nothing; 2 × 3 = 06 adds only the 6). Each digit added is the atom (that rod's value, the digit, add), played through `placeMove`, so a carry into a 9 cascades exactly as in P1. `x` or `y` of 0 still gives a group, with no moves.
- `steps` and `cascades` on every group are what the replay and the card need: `steps` is every bead step of the group in order, and `cascades` is whether any move in it cascaded.
- `groupOfStep(groups, stepIndex)` replaces `columnOfStep`.
- `problemStates(problem)` starts at `a` on the board for ＋ −, and at 0 for ×.

### Time target

`problemTargetMs`: the sum of `latencyTargetMs(classify(atom))` over every move, plus `MULTIPLY_RECALL_MS` (600 ms) for each product group (recalling the 九九), plus the typing allowance per answer digit. These are first estimates, like the rest.

### Exercise

`exerciseForProblem`: `rods: rodsFor(problem)`, `start: a` for ＋ −, `start: 0` for ×.

## 4. The walkthrough (`/multiply-intro`)

- `Progress.multiplyIntroDone: boolean`, default `false`, added without a schema bump (as `highestStage` and `practices` were). `loadProgress` reads it like `tutorialDone`. `useProgress().completeMultiplyIntro()` sets it and saves.
- `app/round.tsx`: once progress has loaded, a `mul` kind whose intro is not done redirects to `/multiply-intro?kind=mul:N`.
- `src/ui/multiply/MultiplyIntro.tsx` plays the fixed problem 47 × 36 on a 4-rod soroban, drawn solid, taking no taps:
  1. An opening page explains 両落とし: only the answer goes on the soroban, and the 九九 go from the highest places down.
  2. It explains placement: the ones digit of a 九九 goes on the place you get by adding the places of the two digits multiplied, and the tens digit one place higher.
  3. Then one page per product group (4×3, 4×6, 7×3, 7×6). The page's line is the group's card line ("4×3=12　千の位に1、百の位に2"), and its bead steps play on the soroban with the replay's timing.
  4. The last page gives the result, "47×36 = 1692".
- つぎへ advances a page. On the last page the button is はじめる when a `kind` was passed: it marks the intro done and replaces the screen with `/round?kind=…`. Opened from the chooser without a kind, the button is おわる: it marks the intro done and goes back.
- A dot track shows the page, as the reading drill's does. Edge swipe is disabled, as for `/round`.

## 5. UI changes

- **Keypad-mode scale:** `QuestionView` draws the keypad-mode soroban at `min(1, fit)`. `geometry.ts` gains `scaleToFit(rods, width, max)`, and `beadModeScale` becomes `scaleToFit(rods, width, BEAD_MODE_SCALE)`.
- **Prompt:** "47に36をかける。" (en: "Multiply 47 by 36.").
- **Answer card:** `ProblemCorrectionCard` renders one line per group. Column groups are unchanged; groups without a move get no line. A product group's line is `productLine(x, y, place, cascades)`, for example "4×3=12　千の位に1、百の位に2" or "2×3=06　百の位に6". Only the non-zero digits are listed, and the same cascade note as P1 is added when a carry cascades. A product group with no moves still gets a line ("5×0=00"), since the 九九 was still done. The replay highlights the active group.
- **Place names** extend to six rods: 一の位, 十の位, 百の位, 千の位, 万の位, 十万の位 (en: ones … hundred-thousands). This changes the rod labels too.
- **Chooser:** the operation control is ＋ たし算 / − ひき算 / × かけ算, with symbols from `OPERATION_SYMBOL`. The examples are 7 × 8, 47 × 36 and 472 × 385. When × is selected, a small やりかた link under the controls opens `/multiply-intro`. The controls may wrap to two rows on a narrow phone.
- **Progress table:** gains a × row; each row's glyph comes from `OPERATION_SYMBOL`.
- **Strings** (both catalogues): `opName('mul')` かけ算 / Multiplication; the examples; `problemPrompt` for ×; `productLine`; the walkthrough's texts (title, opening, placement, result, はじめる / おわる); `chooseHowTo` やりかた.

## 6. Testing

- `problem.test.ts`: × generation (sizes, 2–9 for 1×1, distinct); every 1×1 and 2×2 pair replays to `a × b` with every rod in 0–9, plus 500 sampled 3×3 problems. Named cases: 47 × 36 has groups in the order (4,3) (4,6) (7,3) (7,6), with places 2, 1, 1, 0; 2 × 3 has only the 6; 5 × 4 has only the 2; 99 × 99 = 9801; at least one 2×2 problem cascades. The existing ＋ − tests are updated for `StepGroup` (`kind: 'column'`) and `groupOfStep`.
- `exercise.test.ts`: × starts at 0 on 2N rods.
- `geometry.test.ts`: `scaleToFit`. `QuestionView.test.tsx`: a 6-rod keypad soroban is scaled below 1.
- `ProblemCorrectionCard.test.tsx`: product lines, a zero digit omitted, the active group.
- `progress` / `progressStore` / `ProgressProvider` tests: `multiplyIntroDone` defaults, loads and is set by `completeMultiplyIntro`.
- `MultiplyIntro.test.tsx`: the pages in order, bead steps played per group, and the final button's two behaviours. `round-screen.test.tsx`: a × kind redirects to the intro until it is done.
- The chooser offers ×, the やりかた link appears only for ×, and the progress table has a × row; `catalogs.test.ts` covers the new strings.
- On the simulator: the walkthrough, a 3×3 round on 6 rods (are the beads tappable?), a miss review.

## 7. Build order

1. Domain: `mul`, groups, targets, exercise.
2. `scaleToFit` and the keypad-mode scale; the × answer card and strings.
3. `multiplyIntroDone`, the walkthrough and the `/round` redirect.
4. The chooser (× and やりかた) and the progress table's × row.
5. Simulator check (6-rod tap test; fall back to keypad for 3×3 if it fails); TestFlight build 10; PR.
