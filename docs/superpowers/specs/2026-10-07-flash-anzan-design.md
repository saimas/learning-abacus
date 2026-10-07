# learning-abacus — フラッシュ暗算, with the beads following along

Date: 2026-10-07
Status: Approved design, spec pending review.

## 1. Why, and what the owner chose

The owner (2026-10-07): "Can you add フラッシュ暗算 feature. But Show the beads after each operations."

フラッシュ暗算 shows numbers one at a time, each for a moment, and the learner adds them in their head and answers the total. The owner wants a training version in which the soroban helps the learner see the running total.

Decisions made with the owner:
- **The app shows the running total.** After each number flashes, the beads move by themselves to the running total; the learner watches them follow along.
- **The last step is the learner's.** The beads follow every number except the last. The last number flashes alone; the beads stay on the total before it, and the learner works the last step on the beads and answers. As the level rises the shown beads fade (the app's fade ladder), so it turns into real フラッシュ暗算 by itself.
- **Five numbers, all added** (5口, classic フラッシュ暗算), at 1, 2 and 3けた.
- **A fixed pace of about one number a second**, the same at every level; the fading beads are what makes it harder.
- **Approach: a sixth kind on Home's grid** (chosen over a flash switch on 見取算 and a separate screen outside runs). It reuses 見取算's shape (a list of numbers, steps per number) and plays in runs like every other kind: lives, points, rank, levels, 戻る, 手順を見る.

## 2. What the learner sees

**Home and progress.** A sixth row under 見取算, headed 「フ」, with 1 / 2 / 3けた cells coloured and levelled like the others. VoiceOver names the kind フラッシュ暗算 (ja) / Flash (en): 「2けたのフラッシュ暗算、まだ」, "2-digit flash, not yet". The progress screen's table gains the same row. No やりかた tile or lesson: there is no new technique.

**A problem, as it plays.**
1. The card arrives as every card does (the 〇 hold and swipe of the problem before). The soroban shows 0.
2. 0.6 s after the card is uncovered, the first number appears in the prompt's place, large, with a small counter (「1/5」).
3. Each of the first four numbers shows for 0.7 s and disappears; the beads then jump (no animation) to the running total, and after 0.3 s the next number appears. About one number a second.
4. The fifth number flashes alone for 0.7 s and disappears. The beads stay on the total of the first four.
5. Only now can the learner touch the beads: they add the last number on the soroban and press こたえる. The answer is checked against the total of all five.

While the numbers play, the beads take no taps and こたえる and もどす are off. 手順を見る stays offered: opening it ends the flash at once (the steps reveal every number), and as everywhere an answer after it is "with help". The numbers cannot be replayed, as in real フラッシュ暗算.

**After answering.** As for any problem: a right answer is stamped 〇 and the run moves on; a miss shows ✕ and its review. The review's steps (手順を見る) show the five numbers as a column, as 見取算's do, and how the total builds number by number. 戻る back to a フラッシュ暗算 problem shows it fresh, and it plays again from the start.

**How it grows harder.** At levels 0–2 the beads are solid, so the learner only ever adds the last number to beads they can see. From level 3 the shown beads fade — dimmed, a faint outline, the frame only, nothing — so by level 6 the learner holds the whole running total in their head: real フラッシュ暗算. The beads still move under the learner's fingers where they would be, as in every kind.

**VoiceOver.** Each number is announced as it appears (「47」), then 「こたえてください」 / "Your answer" when the flash ends.

## 3. Domain (`src/domain/problem.ts`, `src/domain/exercise.ts`)

- `Operation` gains `'flash'`, `OPERATIONS` lists it after `'mitori'`, and `OPERATION_SYMBOL.flash` is 「フ」.
- A flash problem has 見取算's shape: `{ op: 'flash', digits, terms }`, five terms, every term added (all positive). It is not a `PairOperation`.
- **Generation:** five numbers, each drawn from the size's range (1けた 1–9, 2けた 10–99, 3けた 100–999). Problems are distinct by their terms, as 見取算's are.
- **The answer** is the sum of the five. **Rods:** digits + 1, as 見取算 (5 × 999 = 4995 fits four rods).
- **The steps** are 見取算's column moves played number after number, all additions: the soroban starts with the first number set, and each later number is one section.
- **The exercise:** `expected` is the sum of all five; the learner's beads start at the sum of the first four (`start`), the soroban the flash leaves them on. The step replay (`states`) is 見取算's, from the first number set.
- `problemTargetMs` is computed as for 見取算 (every move of the column), so points scale with the whole problem's work.

## 4. Playing the flash (`src/ui/session/QuestionView.tsx`, `src/ui/round/RunRunner.tsx`, `ProblemQuestion.tsx`)

- A flash problem's question has two phases: **playing** and **answering**. Playing shows the flash in the prompt's place and the running totals on the soroban; answering is the ordinary question, beads at `start`.
- **Timing constants:** `FLASH_LEAD_MS = 600`, `FLASH_SHOW_MS = 700`, `FLASH_GAP_MS = 300`. The flash lasts `FLASH_LEAD_MS + 5 × FLASH_SHOW_MS + 4 × FLASH_GAP_MS` (5.3 s).
- **Start:** the flash starts when the card is uncovered, not while it is underneath the card swiping off (the runner tells the question, as it tells the results card when it is revealed). The first card of a run starts at once (there is nothing swiping over it).
- **Opening 手順を見る** while playing ends the flash: the question goes straight to answering, with the panel open.
- **The clock:** the answer time used for points runs from the end of the flash to こたえる, not from the card being uncovered.
- **戻る** shows the problem fresh: playing again from the start.
- The fade level, the 〇/✕, the miss review, the stepper and everything else are the ordinary question's.

## 5. Strings

Both catalogues: the kind's name (ja フラッシュ暗算, en Flash) wherever operations are named (`OP_NAME`, grid labels, progress table, prompts as VoiceOver reads them), the flash counter (「1/5」), the end-of-flash announcement (「こたえてください」 / "Your answer"), and the problem's prompt as VoiceOver and the step panel name it (e.g. 「フラッシュ暗算、5口」 / "Flash, 5 numbers").

## 6. Testing

- Domain: generation (five terms in range, all positive, distinct), the answer, rods, steps (every section an addition), the exercise's `start` (first four) and `expected` (all five), `problemKey`, and the kind's place in `OPERATIONS` / `PRACTICE_KINDS` / stored ids.
- Question: the flash plays in order with fake timers (numbers, counter, beads jumping to each running total, the fifth leaving the beads on the first four's total), the beads and こたえる locked while playing and free after, 手順を見る ending the flash, VoiceOver announcements, the flash not starting until told the card is uncovered.
- Runner: a flash run end to end (play, answer, points from the flash's end), 戻る replaying a flash problem fresh.
- Home and progress: the sixth row and its labels.
- On the simulator: a 1けた and a 3けた flash run, recorded, to see the pace and the beads following along.

## 7. Out of scope

Other lengths (3口, 10口), faster or level-dependent speeds, a replay button, mixed + and −, an exam mode, a lesson.
