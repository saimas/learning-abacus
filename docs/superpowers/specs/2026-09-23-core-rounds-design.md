# learning-abacus — けたの練習 at the core, with a step-by-step assistant

Date: 2026-09-23
Status: Implemented on feature/core-rounds (TestFlight build 12).

## 1. Goal and decisions

After builds 9–11 (multi-digit ＋ −, ×, the icon), the owner said: "i like this けたの練習 section. i think this should be the core feature for this app. also, i also liked the step by step explanation of movement of 珠 so we should always have this assistant when user asks for it. also user should be able to step back the move when they want to check it again."

Decisions made with the owner:
- **Home is built around けたの練習.** Home shows the ＋ − × × 1 / 2 / 3けた grid directly, each cell showing its stage, and a tap on a cell starts that round. The seal and days-practised line stay at the top.
- **The single-move daily session stays, as 基礎の練習.** It moves to a smaller card below the grid ("1けたの動き・5分", with today's 準備 / 集中 / 暗算 bar). A tap opens the existing sheet with ぜんぶ and the three parts; the sheet loses its けたの練習 section, since the grid replaces it. The はじめる button and the 180-move map leave Home; the map stays on the progress screen.
- **The assistant: 手順を見る on every question.** A 手順を見る button sits where the step lines appear once it is opened (§4), in both bead and keypad mode, in rounds and in 基礎. It opens a step panel: the explanation lines with ◀ ▶ and 最初から. The soroban shows the steps, drawn solid at any fade level, and the answer controls wait until とじる, which brings back the learner's own beads and typed answer.
- **An answer after 手順を見る counts "with help".** It counts in the round's tally and stamps the day, but it does not move the fade ladder either way: no promotion streak, no demotion, and for 基礎 no Leitner change. In the 基礎 session it also does not extend the streak that brings in new moves.
- **Stepping is manual, one bead move at a time.** ▶ plays the next bead move (the beads slide as they do now), ◀ undoes the last one, 最初から goes back to the start. The line containing the current move is highlighted, with a counter "3 / 5". No auto-play.
- **One panel everywhere.** After a miss, the same panel replaces today's auto-playing replay: it opens by itself at F0–F1 and from こたえを見る above F1, and there it also shows "こたえは …". Before an answer it never shows the answer line.
- The Home title 今日の五分 stays.

Out of scope: a recommended-next round, changing the 基礎 session's content or scheduling, the × walkthrough's paging (it keeps its own page-by-group flow), ÷.

## 2. What exists

- `src/ui/session/QuestionView.tsx`: one question. Review after a miss: `review.cardShown` (auto at non-silent coaching, else after こたえを見る), `useMoveReplay` auto-plays `exercise.states` every 900 ms, `renderCorrection(activeStep)` draws the card (`CorrectionCard` for a single move, highlighting `describeStepParts`; `ProblemCorrectionCard` for a problem, highlighting `groupOfStep`), a replay counter "k / n" (`replay-step`), and こたえを見る / もう一度見る (`review-show`) + つぎへ (`review-next`).
- `Submission = { correct, latencyMs, t }`; `SessionRunner` records via `onAttempt({ atomId, correct, latencyMs })` and keeps per-atom streaks for the reserve; `RoundRunner` records via `onAttempt({ id, correct, pace })`.
- `ProgressProvider`: `attempt` → `recordAttempt` + `markDayPracticed`; `practise` → `recordPracticeAttempt` + `markDayPracticed`.
- `app/index.tsx` (Home): title, seal, `PlanBar`, the atom-map card, はじめる / もう一度練習する → `PartChooser` (ぜんぶ, parts, and the けたの練習 section with ＋ − × pickers, a start row and やりかた).
- `src/ui/progress/PracticeTable.tsx`: the read-only ＋ − × × 1 / 2 / 3けた table on the progress screen.
- `src/ui/session/useMoveReplay.ts`: the timed replay, also used by `MultiplyIntro`.

## 3. The stepper and the step panel

### `useStepper(states: Soroban[])` (`src/ui/session/useStepper.ts`)

```ts
{ index: number | null; soroban: Soroban | null; total: number; next(): void; back(): void; restart(): void; clear(): void }
```

- `total` is `states.length − 1`, the number of bead moves.
- `index` is null when not stepping (the soroban shows whatever it showed before, so a learner sees their own beads until they start). `next()` from null goes to 0, the start, drawn solid with the counter "0 / n"; from k to k + 1, stopping at `total`. So every ▶ after the first plays exactly one move. `back()` from k goes to k − 1, stopping at 0. `restart()` goes to 0. `clear()` goes back to null.
- `soroban` is `states[index]` or null.
- No timers: the beads' own slide animation shows each move.

### `StepLines` and `StepControls` (`src/ui/session/StepPanel.tsx`)

`StepLines` is a card holding the explanation lines (passed in by the caller, rendered with the active move highlighted); it sits in the scroll area. `StepControls` is the control row, pinned in the fixed area just above the bottom buttons (in bead mode under the soroban) so it can never scroll off a small phone. VoiceOver hears each change of step. The control row: ◀ (`step-back`), the counter (`step-count`, "3 / 5", blank when `index` is null), ▶ (`step-next`), 最初から (`step-restart`), and, when opened before an answer, とじる (`steps-close`). ◀ is disabled at 0 or null, ▶ at `total`. Each control has an accessibility label.

The lines are what `renderCorrection` draws today, generalised to `renderSteps({ activeStep, showAnswer })`: `activeStep` is the move just played (`index − 1`, or undefined at 0 or null), and `showAnswer` says whether the "こたえは …" line is shown. `CorrectionCard` and `ProblemCorrectionCard` gain a `showAnswer` prop (default true).

## 4. QuestionView

- **Before an answer:** a small 手順を見る button (`steps-open`) where the step lines appear once it is opened. The owner (2026-09-24) asked for this, to keep it consistent: it first sat under the prompt while the steps showed at the bottom of the screen. In bead mode it sits below the soroban, the operand board and the hint, at the top of the flexible space the lines take, with もどす / こたえる below it; that space is kept from being shorter than the button, but the button adds nothing to its share, so the soroban does not move. In keypad mode it sits in the scroll after the prompt, the F0 demonstration line and the operand board. The F0 demonstration line stays under the prompt. It opens the panel with `showAnswer: false` and marks the question `assisted`. While open: the soroban shows `stepper.soroban ?? shownBeads`, drawn solid once stepping starts (until the first ▶ it stays as it was, at the fade level), takes no taps, and the answer controls (bead mode's もどす / こたえる, keypad mode's pad) are replaced by the panel's とじる. とじる clears the stepper and closes the panel; the learner's beads and typed answer are untouched throughout.
- **After a miss:** the panel replaces the replay. At F0–F1 it is open at once; above F1 it opens from こたえを見る (`review-show`, which no longer changes label). It shows the answer line. The review buttons are こたえを見る (until the panel is open) and つぎへ. The ✕ stays.
- `Submission` gains `assisted: boolean`: true if 手順を見る was opened before this answer.
- `useMoveReplay` is no longer used here (it stays for `MultiplyIntro`). The `replay-step` counter is replaced by the panel's `step-count`.

## 5. "With help" records

- `AttemptResult` (single moves) and `PracticeAttempt` (rounds) gain `assisted: boolean`.
- `ProgressProvider.attempt` / `practise`: an assisted attempt only marks the day practised; it does not call `recordAttempt` / `recordPracticeAttempt`.
- `SessionRunner`: an assisted answer, right or wrong, neither extends nor resets its atom's streak, and only the learner's own right answers can bring in a reserve move through the streak or retire a fade-rep move. (The refill path that brings in a newcomer only to avoid repeating the same move still runs after an assisted answer.) An assisted miss is otherwise handled like any miss (review, retry, failure count). The tally counts both. After とじる, こたえる ignores taps for the same 450 ms as つぎへ, since it reappears under とじる.
- `RoundRunner`: assisted answers count in the tally; `pace` is still computed but unused when assisted.

## 6. Home

- `app/index.tsx`, top to bottom, scrollable: the header icons, the title, the seal row, then **けたの練習** (the section title, `strings.roundSection`), the grid, a かけ算のやりかた link (`home-howto`) under it, then the **基礎の練習** card.
- **The grid** is `PracticeTable` with a new optional `onChoose(kind)` prop. With it, each cell is a button (`accessibilityRole="button"`, at least 48 pt tall, label "2けたのたし算、うすい珠" as today) that calls `onChoose`. Without it (the progress screen) it is read-only, as today. Home pushes `/round?kind=…`; the round already sends a first × round through the walkthrough.
- **The 基礎の練習 card** (`home-basics`): the title 基礎の練習, the detail 1けたの動き・5分, and `PlanBar` inside it. A tap opens `PartChooser`, built from today's plan at that moment, as はじめる does now.
- `PartChooser` drops the けたの練習 section and its props (`onChooseRound`, `onHowTo`) and state.
- The Home atom-map preview card and the はじめる / もう一度練習する button are removed. `mentalCount` / `atomStates` stay (the progress screen uses them).

## 7. Strings (both catalogues)

`stepsOpen` 手順を見る / Show the steps; `stepBack` 一つもどる / Step back; `stepNext` 一つすすむ / Next step; `stepRestart` 最初から / From the start; `stepsClose` とじる / Close; `basicsTitle` 基礎の練習 / Basics; `basicsDetail` 1けたの動き・5分 / Single-rod moves · 5 min; `homeHowTo` かけ算のやりかた / How multiplication works. `replayStep` stays as the counter format. `watchAgain`, `chooseHowTo`, `start`-button strings that fall out of use are removed only if nothing else uses them (`start` is still the walkthrough's はじめる).

## 8. Testing

- `useStepper.test.ts`: null → next → 1; back stops at 0; next stops at total; restart → 0; clear → null; soroban follows.
- `StepPanel.test.tsx`: controls disabled at the ends; the counter; the highlighted line follows `activeStep`; とじる only when given.
- `QuestionView.test.tsx`: 手順を見る opens the panel without the answer line, steps the soroban, disables answering, とじる restores the learner's beads; a submit after opening reports `assisted: true`; a miss at F0 opens the panel with the answer; at F2 こたえを見る opens it.
- `SessionRunner` / `RoundRunner` tests: replay assertions move from timers to ▶ presses; an assisted right answer does not extend the streak (no reserve join); `assisted` is passed through.
- `ProgressProvider.test.tsx`: an assisted attempt/practise changes only the day.
- Home and chooser tests: the grid starts rounds, the basics card opens the sheet, the sheet has no けたの練習 section, やりかた opens the walkthrough.
- On the simulator: Home, a round with 手順を見る before answering (step back and forth, close, answer), a miss review stepping, the basics card → sheet → session with 手順を見る.

## 9. Build order

1. `useStepper`, `StepPanel`, and the miss review moved onto them.
2. 手順を見る before answering, and "with help" through both runners and the records.
3. The new Home: the grid, the basics card, the trimmed sheet, the やりかた link.
4. Simulator check, TestFlight build 12, PR.

## 10. Addendum: colouring the operation on show (TestFlight build 14)

After build 13 the owner said: "it's bit hard to see the motion as a group … when the marble moves by multiple steps for a number like 81 with carried over, it is hard to see up to which move it belongs to a certain operation. maybe we should change the color of all marbles that are currently under operation as a group."

- While stepping (手順を見る, the miss review, the × walkthrough), every bead the current operation has moved so far is drawn red: a column for ＋ −, a 九九 (both digits and any cascade) for ×, the whole move for a single move. The beads moved by the latest step are the deepest red; earlier moves in the same operation a lighter red. A bead that moved and moved back within the operation stays coloured.
- Moving into the next operation clears the previous one's colour; ◀ colours exactly as ▶ did, because the colouring depends only on the step on show. Nothing is coloured at the start state, when not stepping, or on the learner's own soroban.
- `changedBeads` (soroban.ts), `Exercise.groupStarts` and `stepColouring` (exercise.ts) compute it; `Abacus`'s `tintedBeads` draws it (a tinted bead's testID gains `-group` / `-latest`).
