# learning-abacus — remove 基礎の練習, and roll from problem to problem

Date: 2026-09-28
Status: Approved scope, spec pending review.

## 1. Why, and what the owner chose

Two things came up together on 2026-09-28.

- **Stuck, but not stuck.** In a 2けた ＋ round the owner answered correctly, saw the 〇, and thought the app had frozen: "i answered this correctly but i am stuck on the screen. nowhere to go." It had moved on. A correct answer swaps in the next problem at once, and the 〇 (by design, `Maru.tsx`) plays over that *next* problem; the next problem's soroban happened to open at 65, which looked like the answer. The owner: "i didnt notice the problem moved to next … we should make animation effect that user can actually see the problem rolls. also the timing of rolling is too faster. it rolled even before i see red circle."
- **基礎の練習 goes.** "i am thinking of removing this feature. it is not much useful for me. i just want keep repeating the calculation by various 桁数 so けたの練習 might suffice." Told what it still did (targeting weak single moves, the 180-move map, calibrating speed targets), the owner chose: "delete 基礎 and add the roll animation."

## 2. Removing 基礎の練習

What the learner sees:
- **Home** keeps the seal and days practised, the けたの練習 grid and the やりかた links. The 基礎の練習 card, its chooser sheet (ぜんぶ / 準備 / 集中 / 暗算) and its plan bar go. The title 今日の五分 stays.
- **The progress screen** keeps the けたの練習 table; the 180-move map goes.
- **Unchanged:** the first-launch tutorial (reading the soroban), settings (days practised, language, reset), both walkthroughs, every round.

What goes from the code:
- The `/session` route and its screen entry in `app/_layout.tsx`.
- `src/domain/session.ts` and `src/domain/curriculum.ts`, with their tests and `fadeLadder.simulation.test.ts`.
- From `src/domain/fluency.ts`: the per-move record and its scheduling (`AtomRecord`, `newRecord`, `applyAttempt`, `isReflex`, the Leitner box and latency window). The time targets stay (`latencyTargetMs` and its constants), since `problemTargetMs` builds a round's targets from them.
- From `src/domain/progress.ts`: `recordAttempt`, `currentStage`, the map's `cellState` / `atomStates` / `mentalCount`, recalibration, and the `atoms` and `highestStage` fields.
- `exerciseForAtom` (exercise.ts).
- UI: `SessionRunner`, `SessionTrack`, the single-move `CorrectionCard`, `PartChooser`, `PlanBar`, `AtomGrid`, and the provider's `record`. `QuestionView` loses the props only a session used (`demonstration`, `track`).
- Strings used only by these: blocks, parts, the plan, the map, single-move correction and demonstration lines. The move wording that ＋ − and 見取算 lines are built from (`coaching`, the technique names) stays.

What stays in the domain: the 180 moves themselves (`atoms.ts`, `explain.ts`) — every problem's steps are still explained as those moves — `fade.ts`, `soroban.ts`, `practice.ts`, `problem.ts`, `exercise.ts` for problems, and `markDayPracticed`.

**Stored progress.**
- `atoms` (each move's record) and `highestStage` are no longer read or written. A phone's move history is dropped at its next save and cannot be brought back; the owner chose deletion knowing 基礎's records go with it.
- `calibrationMs` is kept as stored: the speed measured in 基礎 keeps setting けたの練習's time targets. It no longer changes (a later, separate change could let rounds calibrate it).
- Everything else is unchanged: days practised, the last day practised, `tutorialDone`, the practice records, the walkthrough flags. No schema bump; an older document loads as before, its extra fields ignored.

Docs: the README is rewritten around けたの練習; the curriculum design and the Phase 1 plan get a status line saying 基礎 was removed on 2026-09-28 (they stay as history).

## 3. Rolling from one problem to the next

In every けたの練習 round:

1. **The 〇 on the answer.** After a correct answer the problem stays as answered — the learner's beads, or the typed answer — and the 〇 stamps over the soroban. Input is locked from that moment.
2. **The roll.** `ROLL_HOLD_MS` (700 ms) after the answer, the problem slides out to the left (`ROLL_OUT_MS`, 175 ms) and the next slides in from the right (`ROLL_IN_MS`, 175 ms). The count (1 / 10 → 2 / 10) changes as the new problem arrives. The 〇 goes out with its problem.
3. **After a miss**, つぎへ rolls to the next problem the same way, with no hold.
4. **After the last problem** the summary rolls in the same way.
5. **Timing stays fair.** The attempt is recorded when こたえる is pressed, so leaving mid-roll keeps it. The next problem's clock (`shownAt`) starts when it has finished arriving, so the hold and the roll never count against its pace.
6. **Reduce Motion.** With iOS Reduce Motion on (`AccessibilityInfo.isReduceMotionEnabled`), the problem fades out and the next fades in over the same durations instead of sliding.

How:
- `QuestionView` draws the 〇 itself, on its own answered state, as it draws the ✕ for a miss; the `maru` counter prop goes. `Maru`'s comment about playing over the next question is updated.
- `RoundRunner` wraps the question in an animated view (the round track stays still above it) and owns the roll: hold → out → swap to the next index → in → arrived (sets `shownAt`). The roll's constants live beside it.

## 4. Testing

- **Roll** (`RoundRunner.test.tsx`, fake timers):
  - after a correct answer the same problem stays, with the 〇 and no way to answer again, and the attempt is already recorded;
  - after the hold and the roll the next problem is on screen and the count reads 2 / 10, and not before;
  - a keypad answer's pace on the next problem is measured from its arrival;
  - a miss's つぎへ rolls to the next problem;
  - the last correct answer rolls in the summary;
  - with Reduce Motion on, the same sequence completes (fade in place of slide).
- **Removal:** the deleted modules' suites go with them; typecheck finds nothing left pointing at them. A stored document with `atoms` and `highestStage` still loads; Home has no 基礎 card; the progress screen has no map; `/session` is gone from the stack.
- **Simulator** (iPhone 17 Pro and a 375 × 667 screen): Home without the card; a round: correct → 〇 on the answer → the roll; a miss → つぎへ → the roll; the progress screen without the map.
- Then TestFlight build 25 and a PR.

## 5. Out of scope

Letting rounds calibrate the speed targets; renaming the app or the Home title; changing the walkthroughs' own paging.
