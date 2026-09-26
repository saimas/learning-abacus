# learning-abacus — 見取算, a column of five numbers (roadmap P4)

Date: 2026-09-26
Status: Approved design, not yet implemented. Sub-project P4 of `2026-09-23-n-by-n-roadmap.md` (§5 names 見取算 as the natural P4), after P1–P3 shipped (TestFlight builds 9–21).

## 1. Goal and decisions

見取算 is adding and subtracting a column of several numbers: the next step on the 検定 ladder after two-number ＋ and −, and what every 見取暗算 and 見取算 exam section tests.

The 検定 formats, as 日珠連 publishes them (retrieved 2026-09-26):
- 暗算検定 10–7級 is 見取暗算 alone: 50 questions in 12 minutes, 500 points. "1～15番3口3字、16～30番4口4字、31～50番5口5字", so every number is a single digit. Whether subtraction appears is not stated. (The curriculum design §5 said "1-2 digits, 3-5 terms"; the terms are 1 digit until 6級, "1けた～2けた5口6字".)
- 珠算能力検定 10級 and 9級 見取算: "2けた　5口　10字", 10 questions.

Decisions made with the owner:
- **General skill, not an exam format.** 見取算 grows at the app's own pace, as one more row of けたの練習 with the usual 1 / 2 / 3けた sizes. No timer, no 50-question mock.
- **Five numbers (5口) at every size.** The longest 暗算検定 10–7級 column, and 珠算検定 10級's 2けた5口. One row, three cells, like the other operations.
- **Mixed ＋ and − (加減算).** The first number is always added; one or two of the other four are subtracted. The running total never goes below 0.
- **A vertical column above the soroban,** as on exam paper: right-aligned, a minus sign on the numbers to subtract. While stepping with 手順を見る, the number being worked is highlighted.
- **Approach: a fifth operation with its own problem shape** (a list of signed numbers), whose steps are the ＋ − column moves played number after number. The alternatives were rewriting every problem as a list of numbers (it churns × and ÷, where it does not fit) and chaining five ＋/− questions (one answer would span several questions, which the runner, records and step panel do not allow).
- Carried over without change: every size open from the start, rounds of 10, the speed-aware fade ladder with beads at F0–F2 and the keypad from F3, one record per kind, 手順を見る with ◀ ▶ and "with help" answers, the miss review, a row on the progress table.
- **No walkthrough.** There is no new technique, only ＋ and − in turn; 手順を見る shows how the running total builds.

Out of scope: an exam mode or timer, other lengths (3口, 10口), 1けた/2けた mixes within a column, 読上算, a walkthrough, feeding 見取算 into the daily session.

## 2. What the learner sees

- **Home grid:** a fifth row, headed `±`, below ÷, with 1 / 2 / 3けた cells coloured by stage as the others are. VoiceOver names it 見取算 (ja) / Columns (en): 「2けたの見取算、まだ」, "2-digit columns, not yet". The progress screen's table gains the same row. No やりかた link.
- **A round:** 10 problems, then the summary, as for the other kinds.
- **The prompt:** the column, e.g. at 2けた

  ```
       47
       85
    −  23
       61
    −  19
    ──────
  ```

  Digits right-aligned in tabular figures, the minus sign in a column of its own at the left, a rule under the last number. No ＋ on added numbers, as on exam paper.
- **The soroban:** N + 1 rods, opened with the first number set (as ＋ − open with a). At F0–F2 the learner works the other four numbers onto the beads, then presses こたえる; the beads are checked against the total. From F3 the beads fade and the total is typed.
- **手順を見る:** ◀ ▶ step one bead move at a time. Each line explains one digit's move and the soroban colours one digit's move at a time, as for ＋ −. The number that move belongs to is highlighted in the column (the accent colour, as the × board highlights its digits); nothing is highlighted before the first step. After とじる the column returns to plain.
- **A miss:** the ✕, then the same panel with こたえは …, as everywhere.

## 3. Domain (`src/domain/problem.ts`)

### Types
- `Operation` gains `'mitori'`, added last to `OPERATIONS`; `OPERATION_SYMBOL.mitori = '±'`. `PRACTICE_KINDS`, `practiceId`, `parsePracticeId` and so the stored records' validation (`progressStore.asPractices`) accept `mitori:1`–`mitori:3` with no other change.
- Today's `Problem` is renamed `PairProblem = { op: 'add' | 'sub' | 'mul' | 'div'; digits; a; b }`. A new `MitoriProblem = { op: 'mitori'; digits; terms: number[] }`, the terms signed (`[47, 85, −23, 61, −19]`), `terms[0] > 0`. `Problem = PairProblem | MitoriProblem`.
- Code that only ever sees × or ÷ takes `PairProblem`: `MethodIntro`, `DivideWalkthrough`, `OperandBoard`, `divisionWalk`, `divisorFirstDigit`, and the i18n `divideWalk` captions. Code that sees any problem switches on `op`: `answerOf`, `startOf`, `generateProblems`, `problemSteps`, `problemTargetMs`, `exerciseForProblem`, `problemPrompt`, `groupLine`.
- `MITORI_TERMS = 5`.

### Generation
For a size N, each number is drawn uniformly from N-digit numbers (1–9, 10–99, 100–999). The first is added. The count of subtracted numbers is 1 or 2 with equal chance, at positions drawn uniformly from 2–5. The draw is rejected, and drawn again, if the running total after any number is below 0 or the final total is 0. No problem (the whole signed list) repeats within a round. The existing bound on tries (`count × 1000`) stays.

### Rods, start, answer
- `rodsFor`: N + 1, the default ＋ − already use: the total never exceeds 5 × (10^N − 1) < 10^(N+1).
- `startOf`: `terms[0]`. `answerOf`: the sum of the terms.

### Steps
The soroban starts at `terms[0]`. For each later number i (1–4), its digits from the highest place down, each played on its own rod as the one atom it is from what that rod shows by then: an add atom for a positive term, a sub atom for a negative one, through `placeMove`, so carries and borrows reach left and cascade exactly as ＋ −'s do. Each digit is one `column` group, which gains an optional field:

```ts
{ kind: 'column'; place; atom: Atom | null; steps; cascades; term?: number }
```

`term` is the index in `terms` of the number the move belongs to, set only for 見取算. A digit of 0 is a group with `atom: null` and no steps, as in ＋ −.

Borrows always find something to take: working a subtraction from its highest digit down, the value on the rods at and above each place is at least that digit's share of what is still to be taken off, because the running total after the number is ≥ 0. The ＋ − code relies on the same fact for a > b.

`groupOfStep`, `problemStates`, `groupStarts` and `stepColouring` work unchanged, since every group has `steps`.

### Time target
As for ＋ −: the per-move target of each digit's atom, plus `TYPING_ALLOWANCE_MS` per digit of the answer. No allowance for reading the numbers: the per-move targets are calibrated from single moves that include reading their prompt.

## 4. Screens and wording

- **`src/ui/mitori/TermColumn.tsx`** (new): `{ terms, label, activeTerm?: number }`. Renders the column (§2) in the prompt's font at the prompt's 28 pt (line height 34), `fontVariant: ['tabular-nums']`; on a window shorter than `SHORT_WINDOW_HEIGHT` (750 pt, a 375 × 667 phone) at 22 pt (line height 26), so five lines leave the soroban and the controls their room. The active number's digits and sign are in `colors.accent`. It is one accessible element whose label is `label` (`strings.problemPrompt(problem)`), testID `prompt` (so tests find the prompt the same way as for the other kinds), with a testID per row (`term-0`…`term-4`).
- **`QuestionView`** gains `renderPrompt?: (activeStep: number | undefined) => ReactNode`, drawn in place of the text prompt in both the bead and keypad layouts, following the same `activeStep` as `renderBeneath`. Without it, the text prompt is drawn as today. The prompt's scroll area already sizes itself to what it holds. On a short window the soroban is capped at `SHORT_WINDOW_BEAD_SCALE` with a `renderPrompt` as it already is with a `renderBeneath`, since the column takes the height a board would.
- **`RoundRunner`** passes `renderPrompt` for a 見取算 problem only: `<TermColumn terms={problem.terms} activeTerm={groupOf(activeStep)?.term} />`.
- **`ProblemCorrectionCard.groupLine`**: a column group with `term` reads `strings.mitoriLine(terms[term], place, atom, cascades)`. Its line's testID is `correction-term-<term>-<place>`, since a place repeats across the numbers (a ＋ − column keeps `correction-column-<place>`).
- **i18n** (ja / en):
  - `OP_NAME.mitori`: 見取算 / Columns (so `roundName` gives 2けたの見取算 / 2-digit columns).
  - `problemPrompt` for 見取算, used as the VoiceOver label: 「47、たす85、ひく23、たす61、ひく19。」 / "47 + 85 − 23 + 61 − 19".
  - `mitoriLine(term, place, atom, cascades)`: the signed number, then the ＋ − column line: 「−23　十の位　…」 / "−23 · Tens: …". The sign is always shown here (＋85, −23), since after a miss the card lists every line with nothing highlighted, and each "十の位" must say which number it belongs to.
- Home and the progress screen need no change beyond the new row that `OPERATIONS` gives `PracticeTable`. `app/round.tsx` needs no intro gate for 見取算.

## 5. Testing

- **Generation**, over many seeds and every size: five N-digit terms; the first positive; one or two negative among terms 2–5; every running total ≥ 0; the total > 0; no repeats within a round.
- **Steps**, over every generated problem of many seeds: replaying `problemStates` on N + 1 rods ends at the total; every step stays on the rods (no throw); each group's `term` is the number it belongs to, in order; a 0 digit gives an empty group. Two worked examples whose moves cascade: 2けた `[95, 90, 15, −60, 22]` (＋15 onto 185: the tens become 9, so the ones' carry ripples through them to 200) and 3けた `[500, 500, −101, 200, −300]` (−101 from 1000: the tens are 0, so the ones' borrow ripples through them to 899).
- **Target**: equals the ＋ − formula summed over the digit moves.
- **Ids and storage**: `parsePracticeId('mitori:2')`; a `mitori:3` record survives save and load; an unknown `mitori:4` is dropped.
- **i18n**: both catalogues have the new keys (the catalogue parity test); the prompt sentence and a line in each language.
- **Components**: `TermColumn` shows the numbers with minus signs only on the subtracted ones, and highlights `activeTerm`; a 見取算 round shows the column, 手順を見る highlights the number of the stepped move and the line of the move; the correction card's lines carry their numbers; `PracticeTable` has the ± row and a cell that starts `mitori:2`.
- **Simulator**: iPhone 17 Pro, and a 375 × 667 screen (deep link `exp://127.0.0.1:8081/--/round?kind=mitori:3`): the five-line column, the 4-rod soroban and the controls fit in bead and keypad modes, with the panel open and closed. At 375 × 667 the column's 22 pt size and the capped soroban must leave 手順を見る and こたえる on screen; if they do not, the column's size is what gives way.

## 6. Build order

1. Domain types: `PairProblem`, `MitoriProblem`, `Operation` `'mitori'`, the × / ÷ call sites narrowed to `PairProblem`. Nothing generates a 見取算 problem yet.
2. Generation, start, answer, rods.
3. Steps (the `term` field) and the time target.
4. i18n: names, the prompt sentence, `mitoriLine`.
5. `TermColumn`, `QuestionView.renderPrompt`, `RoundRunner` and `ProblemCorrectionCard` wiring; the grid row.
6. README (見取算 moves out of "Not in the app yet"), the roadmap's outcome, this spec's status.
7. Simulator check, TestFlight build 22, PR.
