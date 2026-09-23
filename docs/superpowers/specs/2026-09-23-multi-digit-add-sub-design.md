# learning-abacus — Multi-digit ＋ and − (roadmap P1)

Date: 2026-09-23
Status: Approved design, pre-plan. Sub-project P1 of `2026-09-23-n-by-n-roadmap.md`.

## 1. Goal and decisions

The owner asked for practice of N × N calculations, N up to 3, for all four operations. The roadmap splits that into P1 (＋ −), P2 (×) and P3 (÷). This spec is P1 only: practising addition and subtraction of two numbers of 1, 2 or 3 digits, for example 472 + 385.

Decisions made with the owner:
- **A separate practice mode, offered in the chooser.** Below today's rows, a けたの練習 section with two segmented controls (＋ / −, 1 / 2 / 3 けた) and one start row. The daily session is unchanged.
- **Every size is open from the start.** Nothing is locked; this is practice the learner picks on purpose.
- **Answering works as today.** The soroban opens with the first operand set. At F0–F2 the learner moves the beads to the answer and presses こたえる; from F3 the beads fade and the answer is typed.
- **A round is 10 problems,** then the summary.
- **Fade is speed-aware,** as for single moves: 5 correct in a row, each within a time target, promotes one level; 2 wrong in a row demotes one. The target comes from the per-move targets the app already calibrates.
- **Progress appears on the progress screen** as a small table below the 180-move map. Home is unchanged.
- **Architecture A:** a shared `Exercise` and an extracted `QuestionView`, played by the existing `SessionRunner` and a new `RoundRunner` (§5).

Out of scope: × and ÷ (P2, P3), 見取算 (more than two terms), feeding multi-digit practice into the daily session, crediting single moves on the 180-move map from multi-digit answers.

## 2. What exists

- `src/domain/soroban.ts` is rod-count agnostic: `emptySoroban(n)`, `setValue`, `readValue`, `applyStep(s, step, workingIndex)`, where a `RodStep` is `{ rod: 'working' | 'carry', delta }` and `'carry'` means the rod to the left of the working one.
- `src/domain/atoms.ts`: the 180 atoms (rod value 0–9, operand 1–9, add or sub). `decompose(atom)` gives the rod steps of one move, including a carry or borrow step on the rod to the left. `classify`, `startValue`, `expectedValue` and `moveStates` build on it. `moveStates` hard-codes a 2-rod soroban.
- `src/domain/fluency.ts`: `AtomRecord` (box, fade, streaks, recent latencies, due date), `latencyTargetMs(class, calibrationMs)`, `applyAttempt`. The bead rule: at F0–F2 an answer is untimed and a correct one counts on accuracy alone.
- `src/domain/fade.ts`: fade F0–F6, `nextFadeLevel`, `coachingForFade`, `answerModeForFade`.
- `src/domain/progress.ts`: `Progress` with `atoms`, `calibrationMs`, `highestStage` (added without a schema bump), `recordAttempt`, `markDayPracticed`.
- `src/ui/session/SessionRunner.tsx` (650 lines) plays a `SessionPlan`. It rebuilds the atom by parsing the item's atom id and sets up `emptySoroban(2)`. It owns both the plan logic (blocks, retries, reserve, fade rep) and everything about one question (prompt, soroban or keypad, こたえる, ✕ and the miss review with `CorrectionCard` and the replay, the 〇).
- `src/ui/home/PartChooser.tsx`: the sheet the start button opens, with ぜんぶ and one row per part. `app/session.tsx` reads `?part=`.
- `app/progress.tsx`: the progress screen, showing `AtomGrid`.

## 3. Domain: problems (`src/domain/problem.ts`)

```ts
export type Operation = 'add' | 'sub'
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`   // 'add:1' … 'sub:3'
export type Problem = { op: Operation; a: number; b: number }
```

- `PRACTICE_KINDS`: the six kinds. `practiceId(kind)`, and `parsePracticeId(value: unknown): PracticeKind | null` for route parameters.
- `answerOf(problem)`: `a + b` or `a − b`.
- `rodsFor(digits)`: `digits + 1`. One rod beyond the operands holds a carry, so 1-digit problems use today's 2-rod board and 3-digit problems use 4 rods (999 + 999 = 1998).

### Generation

`generateProblems(kind, count, random: () => number): Problem[]`

- Both operands have exactly `digits` digits: 1–9, 10–99 or 100–999.
- Subtraction: `a ≥ b`, so the answer is never negative. `a = b` is excluded (the answer 0 teaches nothing and reads as a blank soroban).
- The problems in one call are distinct.
- `random` is injected so tests are deterministic. The app passes `Math.random`.
- Problems are uniform over the allowed pairs. Nothing tries to balance carries; a uniform draw already gives most 2- and 3-digit problems at least one carry or borrow.

### Steps: working from the left

A soroban adds from the highest place down. 472 + 385 is worked 4 + 3 on the hundreds rod, then 7 + 8 on the tens rod (carrying into the hundreds rod), then 2 + 5 on the ones rod.

`problemSteps(problem): ColumnStep[]`

```ts
export type ColumnStep = {
  place: number          // 0 = ones, 1 = tens, 2 = hundreds
  atom: Atom | null      // null when b's digit here is 0: nothing moves
  steps: PlacedStep[]    // rod steps with absolute rod indexes, cascades included
}
export type PlacedStep = { rodIndex: number; delta: number }
```

- Columns run from `b`'s highest digit to its ones digit. For each, the atom is (the rod's value at that moment, `b`'s digit, the operation), and its steps come from `decompose(atom)`.
- A `'carry'` step lands on the rod to the left. If that rod shows 9 (adding) or 0 (subtracting), the step cannot be a single bead move: it becomes that rod's own 10's complement, one more carry further left. This repeats until a rod can take it. The cascade's steps come from `decompose` too, as the atom (that rod's value, 1, the operation), so they read the same way the learner already knows.
- Subtraction never borrows past the leftmost rod, because `a ≥ b`. Addition never carries past it, because there is one spare rod.
- `applyPlacedStep(soroban, step)` applies one step. `problemStates(problem)` is the soroban at the start (`a` set on `rodsFor(digits)` rods) and after each step, for the replay.

## 4. Domain: exercises (`src/domain/exercise.ts`)

What one question needs, whether it came from an atom or a problem:

```ts
export type Exercise = {
  rods: number
  start: number
  expected: number
  states: Soroban[]      // start, then after each step
  targetMs: number       // the time target for one timed answer
}
```

- `exerciseForAtom(atom, calibrationMs)`: 2 rods, `startValue`, `expectedValue`, `moveStates`, and `latencyTargetMs(classify(atom), calibrationMs)`. It must match today's behaviour exactly for all 180 atoms.
- `exerciseForProblem(problem, calibrationMs)`: `rodsFor(digits)`, `a`, `answerOf`, `problemStates`, and a target of the sum of `latencyTargetMs` for each column's atom (columns with no atom add nothing), plus `TYPING_ALLOWANCE_MS` (400 ms, a first estimate) per digit of the answer. Like the single-move targets, the numbers are first estimates to be tuned with real use.

The prompt and the correction card's text are not in `Exercise`: they are strings, and they come from the i18n catalogues, which take the atom or the problem (§7).

## 5. Records (`src/domain/practice.ts`, `progress.ts`, `progressStore.ts`)

One record per practice kind. Problems are fresh each time, so what improves is "2-digit addition", not a particular sum.

```ts
export type PracticeRecord = {
  fade: FadeLevel
  consecutiveCorrect: number
  consecutiveWrong: number
  recentPace: number[]      // latency ÷ that problem's targetMs, last LATENCY_WINDOW
  lastPractisedAt: number
}
```

- `Progress` gains `practices: Partial<Record<PracticeId, PracticeRecord>>`, default `{}`. As with `highestStage`, there is no schema bump: a stored document without the field loads with `{}`. `loadProgress` keeps only entries whose key is a known `PracticeId` and whose value has the expected shape; anything else is dropped rather than discarding the whole document.
- `applyPracticeAttempt(record, correct, pace: number | null, now)`: `pace` is null for an untimed (bead) answer. The rule mirrors `applyAttempt`: fast enough means correct and (`pace < 1`, or untimed while the record's own fade is a bead level); `nextFadeLevel` decides the level; a fade change restarts the streaks and the recent pace.
- `recordPracticeAttempt(progress, id, correct, pace, now)` updates `progress.practices[id]`, creating the record at F0 if needed. It does not touch `atoms`, `calibrationMs` or `highestStage`.
- There is no Leitner box or due date: those schedule material, and this mode is chosen, not scheduled.
- A round's fade is read when the round starts and held for all 10 problems, as a session plan holds its items' fade. A promotion earned during a round shows from the next round.
- A round that records at least one answer marks the day as practised (the seal), as a session does.

## 6. UI

### QuestionView (`src/ui/session/QuestionView.tsx`), extracted from SessionRunner

Everything about one question, driven by an `Exercise` plus its fade, coaching, prompt text and correction content. It owns the bead state, the answer, the ✕ and the review, the replay (`useMoveReplay` over `exercise.states`) and the 〇, and reports `{ correct, latencyMs }` when the learner moves on. Latency is measured as today.

`SessionRunner` keeps its plan logic (blocks, the time track, retries, the reserve, fade rep, the summary) and renders `QuestionView` for its current atom via `exerciseForAtom`. The extraction changes nothing the learner sees: `SessionRunner`'s existing tests must pass without edits to what they assert.

The bead-mode scale is no longer the fixed `BEAD_MODE_SCALE`. It is the largest scale up to 1.38 at which `exercise.rods` rods fit the screen's usable width. On a 375 pt screen this gives 1.38 for 2 rods and about 1.3 for 4.

### RoundRunner (`src/ui/round/RoundRunner.tsx`) and the `/round` route

- `app/round.tsx` reads `?kind=add:2` with `parsePracticeId`. A missing, unknown or repeated `kind` goes back to Home. At mount it generates 10 problems and reads the kind's fade from progress, once.
- `RoundRunner` plays them in order through `QuestionView`. A missed problem gets the usual review, then the round moves on; it does not come back. Each answer calls `recordPracticeAttempt` with `pace = latencyMs / targetMs` (null for untimed answers).
- The track at the top shows the count, "3 / 10", in place of the time track, with the same quit button and confirmation.
- After the tenth problem: the existing summary, with the seal and "10問中 8問正解", and おわる.

### Problem prompt and correction card

- Prompt: "472に385をたす。" / "472から385をひく。" (en: "Add 385 to 472." / "Subtract 385 from 472.").
- F0 has no demonstration before the answer: for a problem it would be a sentence per column. As today, F0–F1 show the correction card automatically after a miss, and F2+ after こたえを見る.
- The correction card for a problem gives the answer, then one line per column, highest place first, for example "十のくらい：7に8をたす → …", with the same step wording as the single-move card (`describeStepParts`) and a cascade described as its own carry. The replay highlights the line of the column whose steps it is playing. A column with no atom (a 0 digit in `b`) gets no line.
- The replay counter reads as today ("3 / 9").

### Chooser

Below the existing rows of `PartChooser`: a divider labelled けたの練習, a `SegmentedControl` for ＋ / −, one for 1けた / 2けた / 3けた, and a start row whose name says what it is and whose detail gives an example and the count, for example "2けたのたし算" and "23 + 58 など・10問". The example is fixed per kind, not generated.

The selection starts at ＋ 1けた and is remembered by Home while the app runs (not stored). The start row pushes `/round?kind=…` with the same double-tap guard as the other rows.

### Progress screen

Below `AtomGrid`, a `PracticeTable`: title けたの練習, rows ＋ and −, columns 1けた, 2けた, 3けた. Each cell shows the kind's fade level in the same visual language as the atom map's cells, or a not-yet-tried mark. Each cell has an accessibility label such as "2けたのたし算、うすさ 3".

### Strings

All new text goes in both `ja.ts` and `en.ts`, and `catalogs.test.ts` keeps them in step.

## 7. Testing

- `problem.test.ts`: operand digit counts; no negative or zero answers for subtraction; distinct problems for a fixed seed. Exhaustively for every 1- and 2-digit pair, and for a large seeded sample of 3-digit pairs: `problemStates` ends at `answerOf`, and every step keeps each rod within 0–9. Named cascade cases: 95 + 15 (carry into a 9), 999 + 999 (carries into a 9 twice), 102 − 13 (borrow through a 0), 500 − 499 (a borrow chain across two 0s).
- `exercise.test.ts`: `exerciseForAtom` agrees with `startValue`, `expectedValue`, `moveStates` and `latencyTargetMs` for all 180 atoms. `exerciseForProblem` target arithmetic.
- `practice.test.ts` / `progress.test.ts`: promotion after 5 fast correct, demotion after 2 wrong, the untimed bead rule, streak reset on a fade change; `recordPracticeAttempt` leaves `atoms`, `calibrationMs` and `highestStage` unchanged.
- `progressStore.test.ts`: a document without `practices` loads with `{}`; unknown ids and malformed records are dropped.
- `SessionRunner` tests pass unchanged after the extraction. New `QuestionView` tests for the problem card and a 4-rod soroban. `RoundRunner` tests: 10 problems, count track, miss review then move on, summary, quit.
- `PartChooser` and `PracticeTable` component tests; `catalogs.test.ts`.
- On the simulator (Maestro): start ＋ 2けた from the chooser, answer on the beads, finish a round, see the progress table.

## 8. Build order

Each step leaves the app working.

1. `problem.ts`: types, generation, `problemSteps`, `problemStates`.
2. `exercise.ts`; extract `QuestionView` from `SessionRunner` with no visible change.
3. `PracticeRecord`, `recordPracticeAttempt`, storage.
4. `RoundRunner`, `/round`, prompt and correction card for problems.
5. The chooser section. **Then check on the simulator that a 4-rod soroban at the computed scale is comfortable to tap** before going further; if it is not, revisit the scale rule here.
6. The progress-screen table.
7. Simulator check, TestFlight build 9, PR.
