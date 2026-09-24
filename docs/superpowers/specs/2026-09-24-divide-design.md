# learning-abacus — Division 割算 (roadmap P3)

Date: 2026-09-24
Status: Implemented on feature/divide (TestFlight build 19). Sub-project P3 of `2026-09-23-n-by-n-roadmap.md`, after P1 (＋ −), P2 (×) and the core-rounds work (grid Home, 手順を見る, colouring, the operand board).

## 1. Goal and decisions

The owner asked for N × N practice for all four operations. This adds ÷.

Decisions made with the owner:
- **Sizes are × run backwards, always exact.** 1けた is 2 digits ÷ 1 digit (56 ÷ 8 = 7), 2けた is 4 ÷ 2 (1692 ÷ 36 = 47), 3けた is 6 ÷ 3 (202032 ÷ 976 = 207). The quotient has N digits and there is no remainder.
- **Method: 商除法** (the method taught for the 検定 today). The dividend is set on the soroban. For each quotient digit the learner 商を立てる (places it to the left of the dividend by the 割れる / 割れない rule), then subtracts each 九九 of quotient digit × divisor digit from the dividend. The quotient is left on the soroban.
- **The divisor sits on a read-only board** beneath the soroban (the × operand board's idea), with the digit being multiplied highlighted.
- **Beads at every size, scaled to fit**, including 3けた's 7 rods (about 0.70× on a 375 pt phone). If the simulator shows 7 rods too fiddly, 3けた falls back to the keypad.
- Carried over: every size open, rounds of 10, the speed-aware fade ladder, one record per kind, a ÷ row on the Home grid, 手順を見る with ◀ ▶, group colouring, the walkthrough-before-the-first-round pattern.

Out of scope: remainders, N ÷ 1 sizes, 帰除法, a quotient-only mode, landscape.

## 2. Domain (`src/domain/problem.ts`)

### Types and sizes
- `Operation` gains `'div'`; `OPERATION_SYMBOL.div = '÷'` (U+00F7). `Problem = { op, digits, a, b }` with `a` the dividend and `b` the divisor for ÷.
- `answerOf`: `a / b` for ÷ (always an integer).
- `rodsFor`: `2N + 1` for ÷ (3 / 5 / 7). `startOf`: `a` for ÷ (the dividend is set on the soroban).
- Generation: draw an N-digit quotient q and an N-digit divisor d (2–9 for N = 1), `a = q × d`, `b = d`; distinct `(a, b)` pairs.

### Steps
The soroban shows one number. The dividend is set right-aligned, so its digits sit at their own place values. For each quotient place p from N − 1 down to 0 with digit q (the quotient's digit at p):
1. **商を立てる** — a group `{ kind: 'quotient', q, place: p + N + 1, lead, split, partial, guess, moves, steps, cascades }`: add q (atom `(0, q, add)`) on the rod at place `p + N + 1`. That rod is always empty then (the remainder is below `d × 10^(p+1) ≤ 10^(p+N+1)`). `lead` is the remainder's leading N digits and `split` is whether the quotient lands two rods left of the remainder's head (`lead ≥ b`, 割れる) or one (割れない). A digit of 0 is a group with no moves (nothing is placed).
   - **The guess (仮商), added after build 19.** The owner: "it says 商4を立てる but I have no idea where that 4 comes from." Real 商除法 needs only the 九九: `partial = ⌊remainder / 10^(p+N−1)⌋` (the head of what is left, one or two digits) and `guess = min(9, ⌊partial / d0⌋)`, d0 being the divisor's first digit (`divisorFirstDigit`). d0 alone underestimates the divisor, so `guess ≥ q` always; when it is bigger, the subtraction would not go and the learner lowers it. 1692 ÷ 36: 16 ÷ 3 → 5 (q 4), then 25 ÷ 3 → 8 (q 7); 432 ÷ 36: 1 then 2, both right; 202032 ÷ 976: 2, 0, 7. A 1-digit divisor's guess is always q. The owner chose to explain the guess in words only: the beads still play q directly (no undo steps).
2. **引く** — for each divisor digit y at divisor place j from N − 1 down to 0: a group `{ kind: 'subtract', q, y, yPlace: j, place: p + j, moves, steps, cascades }` subtracting the 九九 `q × y`: its tens digit at place `p + j + 1`, then its ones digit at place `p + j`, each a subtraction atom played through `placeMove`, so borrows cascade the way P1's carries do. A zero digit is not a move.

Invariants, tested exhaustively:
- The remainder never goes negative.
- A borrow never reaches the quotient's rods.
- The final soroban reads `q × 10^(N+1)`: the quotient on the left, zeros to its right.

`groupOfStep`, `problemStates`, `stepColouring` and `groupStarts` work unchanged on the new group kinds, since every group has `steps` and `cascades`.

### Answer and target
- `Exercise` gains `expectedBeads?: number`. For ÷ it is `q × 10^(N+1)`, the final soroban reading. `expected` stays the typed answer (q). Bead answers are checked against `expectedBeads ?? expected`.
- `problemTargetMs` for ÷: the move targets, plus `MULTIPLY_RECALL_MS` per subtract group, plus `DIVIDE_ESTIMATE_MS` (1500 ms, a first estimate) per non-zero quotient digit, plus typing q.

## 3. Screens

- **Prompt:** "1692を36でわる。" (en: "Divide 1692 by 36.").
- **The divisor board:** `OperandBoard` for ÷ shows only the divisor b, since the dividend is already on the working soroban. The digit `yPlace` is highlighted during a subtract group, and nothing is highlighted during a quotient group.
- **Step lines** (`ProblemCorrectionCard`):
  - quotient group: `quotientLine(q, partial, d0, guess, split)`: the guess by 九九, why it was lowered if it was too big, then where q goes, e.g. "16÷3で見当をつけると5。5だと引ききれないので4にする。商4を頭の1つ左に立てる", "4÷3で見当をつけると1。商1を頭の2つ左に立てる". A 0 digit reads "6÷9で見当をつけると0。商0（立てない）". (en: "Estimate 16 ÷ 3 = 5. 5 is too big to take away, so use 4. Place 4 one rod left of the head.", "… Quotient 0: nothing to place.") A bead-mode miss also gives the final bead reading ("こたえは 47（そろばんは 47000）").
  - subtract group: `subtractLine(q, y, place, cascades)`, e.g. "4×3=12　千の位から1、百の位から2を引く". Only non-zero digits are listed, with the P1 cascade note for a borrow that ripples on.
- **Walkthrough** `/divide-intro` (1692 ÷ 36 = 47), shown before the first ÷ round (`Progress.divideIntroDone`, no schema bump) and from a わり算のやりかた link on Home beside かけ算のやりかた:
  1. what 商除法 does;
  2. the 割れる / 割れない rule;
  3. one page per group, with its bead steps playing and coloured, and the divisor board lit;
  4. the result.
  - Build it by generalising the × walkthrough (`MultiplyIntro`) rather than copying it.
- **Home:** the grid gains a ÷ row automatically (from `OPERATIONS`). (Per-kind examples such as 56 ÷ 8 were planned here, but Home no longer shows examples for any operation since the chooser's round row was replaced by the grid, so none were added.)

## 4. Testing
- `problem.test.ts`:
  - generation: sizes, exactness, 2–9 for 1けた, distinctness;
  - every 1けた and 2けた problem, and a large 3けた sample, replays to `q × 10^(N+1)` with every rod in 0–9 at every step;
  - the quotient rod is empty when each digit is placed;
  - no step touches a quotient rod after its digit is placed;
  - named cases: 1692 ÷ 36 = 47 (groups, places, split = false twice); 432 ÷ 36 = 12 (a 3-digit dividend: split = true, the quotient two rods left of the head, lead 43); 202032 ÷ 976 = 207 (a 0 quotient digit: a group with no moves);
  - the guess: those three problems' `partial` and `guess`; exhaustively, `q ≤ guess ≤ 9`, `partial ≤ 99`, and `guess = q` for a 1-digit divisor.
- Exercise (`expectedBeads`), the target, the strings, the card lines, the divisor board highlight, a ÷ round answered on the beads (final reading) and on the keypad (q), the walkthrough pages, the redirect, and the Home link.
- On the simulator: the walkthrough, and a 3けた round's 7 rods (tapping, stepping, the board).

## 5. Build order
1. Domain: `div`, the groups, target and exercise.
2. The screens: bead-answer check, step lines, divisor board, round.
3. Walkthrough, flag, redirect, and the Home link.
4. Simulator check, TestFlight, PR.
