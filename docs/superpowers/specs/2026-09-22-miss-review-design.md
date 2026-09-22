# learning-abacus — Reviewing a wrong answer (✕ and the correct bead moves)

Date: 2026-09-22
Status: Implemented on feature/miss-review (TestFlight build 7)

## 1. Goal and decisions

After TestFlight build 6 the owner asked for two things:
- a wrong answer should show a big ✕, the way a correct one shows the 〇;
- the learner should be able to see the correct bead (珠) moves when they want the answer.

Decisions made with the owner:
- **After a miss, the question stays.** A ✕ stamps on the soroban and the question does not advance. The bottom row becomes **こたえを見る** (show the answer) and **つぎへ** (next). The learner moves on when ready.
- **Silent levels stay silent unless asked.** At F0–F1 the answer card appears straight away, as corrections do today. At F2 and above only the ✕ shows, with こたえを見る available on request.
- **こたえを見る plays the move on the same soroban,** step by step, from the starting number to the answer.

The approved mockup is `2026-09-22-miss-review-mockups/miss-review.html`.

## 2. What exists

- `SessionRunner.submit()` scores an answer and immediately advances. It takes the queue, requeues a miss at the back (at F4+ one level lower), handles the reserve join, refills or ends the block, and records deadlines. On a miss at F0–F1 it sets `correction = { atom, expected }`, and `CorrectionCard` shows it under the *next* question with a さっきの問題 header. A correct answer bumps `maru` (the 〇 stamp) and announces 正解.
- The domain can already break a move into steps: `decompose(atom): RodStep[]` (in `atoms.ts`), `applyStep(soroban, step, workingIndex)` (in `soroban.ts`), and `describeSteps(atom)` ("+10 − 2", in `explain.ts`).
- The catalogs' `coaching(atom)` returns "十の繰上：8をたす = +10 − 2".
- `Maru` is the 〇 stamp. It is 140 pt in bead mode and 110 pt in keypad mode, centred on the soroban, and pops, holds and fades in about 0.8 s with `pointerEvents="none"`.

## 3. Domain (pure, in `src/domain/`)

- **`moveStates(atom): Soroban[]`** (`atoms.ts` or `soroban.ts`): the two-rod soroban at `startValue(atom)`, followed by the soroban after each `decompose(atom)` step, applied with `applyStep(…, workingIndex 1)`. The last state reads `expectedValue(atom)`.
  - 7+8 → 07, 17, 15
  - 3+4 → 03, 08, 07
  - 13−5 → 13, 03, 08
  - 1+3 → 01, 04
- **`describeStepParts(atom): string[]`** (`explain.ts`): the parts that `describeSteps` joins, with one part per step. For 7+8 that is `['+10', '− 2']`. `describeSteps` becomes `parts.join(' ')` and its output is unchanged.

## 4. The runner

`submit()` is split into two parts:
- **scoring**: parse the answer, `onAttempt`, tally, the per-session streak, failures, 〇 or ✕;
- **advance**: dequeue and requeue, the reserve join, refill or end the block, and the deadline check using the time the advance happens.

A **correct** answer runs both at once, exactly as today. A **miss** runs scoring only and enters **review** for the same question.

**Review state:** `{ atom, expected, coaching, cardShown, replay }`.
- The prompt stays.
- In bead mode the soroban keeps showing what the learner entered. Taps and VoiceOver adjust are disabled.
- In keypad mode the keypad is hidden.
- The bottom row is **こたえを見る / つぎへ** (testIDs `review-show`, `review-next`).
- A big **✕** (`Batsu`) stamps over the soroban, with the same size and timing rules as the 〇. VoiceOver announces ちがいます.
- The answer card shows when `coaching !== 'silent'`, immediately; otherwise only after こたえを見る. It is about *this* problem: こたえは N plus the substitution, with no さっきの問題 header.

**こたえを見る** shows the card if it was hidden, then plays `moveStates(atom)`:
- The soroban jumps to the start state, then advances one state every **900 ms** until the answer. The beads slide as they already do.
- The card highlights the step part (from `describeStepParts`) that was just played, and a small `n / total` counter shows under the soroban.
- While the replay shows, the soroban is drawn solid (fade 0) and at the layout's scale, so there is something to see at F3+.
- When it finishes, the button reads **もう一度見る**, which plays it again.

**つぎへ** runs the advance, using `now()` at that moment for the deadline. It clears the review, and sets the next question's `shownAt` to that moment, so the review never counts toward the next answer's latency. A missed item is still requeued at the back, as today, including the F4+ one-level-lower retry. If the block's time ran out during the review, the advance ends the block as usual.

**Unchanged:**
- a correct answer (〇, next question at once);
- scoring, fluency and stored progress: `onAttempt` is still called once per answer, at submit;
- the reserve join, deadlines, the bead/keypad split, the three-failure cap;
- the reading drill, which keeps its own wrong-answer card.

## 5. UI pieces

- **`Batsu`** (`src/ui/session/Batsu.tsx`): a vermilion ✕ made of two thick strokes (~7% of `size`) at ±45°, with a slight tilt. It uses `size` (140 bead / 110 keypad), the same pop 120 ms / hold 450 ms / fade 250 ms as `Maru`, `pointerEvents="none"` and `testID="batsu"`. It is keyed per miss so it replays.
- **Replay hook** (`src/ui/session/useMoveReplay.ts`): given `states: Soroban[]`, it returns `{ soroban, step, playing, play }`. It uses a `setTimeout` chain, cleared on unmount and when a new play starts. Tests drive it with fake timers.
- **`CorrectionCard`** takes `activeStep?: number`. It renders the coaching lead (new catalog key `coachingLead(atom)` = "十の繰上：8をたす = ") and then the parts, highlighting the active one. `coaching(atom)` stays equal to lead + parts.
- **Strings** (both catalogs):

  | Key | ja | en |
  |---|---|---|
  | `showAnswer` | こたえを見る | Show the answer |
  | `watchAgain` | もう一度見る | Watch again |
  | `next` | つぎへ | Next |
  | `wrong` | ちがいます | Not quite |
  | `coachingLead(atom)` | e.g. 十の繰上：8をたす = | e.g. Add 8 = |

  `previousProblem` is removed.

## 6. Testing

- **Domain:**
  - `moveStates` for a direct move (1+3), a five-complement (3+4), a carry (7+8) and a borrow (13−5): the first state is the start and the last reads `expectedValue`;
  - over all 180 atoms, the length is `decompose(atom).length + 1` and the last value is `expectedValue`;
  - `describeStepParts` joined equals `describeSteps`.
- **Runner:**
  - after a miss, the prompt stays, `batsu` is rendered, `review-next` and `review-show` are shown, and the keypad or bead taps are disabled;
  - F0/F1 shows the card at once; F2+ shows it only after `review-show`;
  - `review-show` steps the soroban through each state every 900 ms (fake timers) and ends on the answer, and the active step highlight follows;
  - `review-next` advances: the next prompt appears, the missed item comes back later in the block, and the next attempt's `latencyMs` excludes review time;
  - a correct answer is unchanged (no review, 〇, next question at once);
  - existing tests that answer wrong and expect the next question immediately are updated to press `review-next`, keeping their intent.
- **Catalogs:** parity covers the new keys; `coachingLead(atom) + describeSteps(atom)` equals `coaching(atom)` for all 180 atoms in both locales.
- **On device:** a simulator check of a miss in bead mode and in keypad mode, the replay and つぎへ. Then TestFlight build 7.

## 7. Out of scope

- A ✕ or replay in the reading drill.
- Checking each bead move as it is made.
- Automatically replaying on a miss without being asked. At F0–F1 the card is automatic but the replay is not.
