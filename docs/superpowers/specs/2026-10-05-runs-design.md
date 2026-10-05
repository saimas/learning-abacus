# learning-abacus — runs: combo, live fade, score and rank

Date: 2026-10-05
Status: Approved design, spec pending review.

## 1. Why, and what the owner chose

The owner (2026-10-05): "i think this app can be more fun. right now it is not so much of gaming factor in this app … i like it structured so that once user started session it is so engaging that hard to stop."

Today a session is a round of ten untimed problems, each 〇 or ✕, then 「1問中 1問正解」. Progress shows only as a kind's fade level and the days-practised seal: no score, no combo, no reward moment, and a stop every ten problems.

Decisions made with the owner:
- **Adults** are the player: scores, speed and mastery, not characters or stickers.
- **The five-minute frame goes.** A session lasts as long as the player wants. This reverses the curriculum design's "Five minutes per day … must be honoured". The name まいにち5分！ no longer describes the app; renaming it is a separate task, parked.
- **Speed is scored, never failed.** Answers stay untimed in the sense that slowness costs nothing; speed earns a bonus.
- **The hooks:** a rank that climbs, combo and momentum inside play, and an endless run in place of rounds of ten. (Beating a personal best was not picked as a hook; each kind keeps its best run all the same, since an endless run's score is the thing to compare.)
- **Approach: every round becomes a run** (chosen over a separate チャレンジ mode beside rounds of ten, and over auto-chained rounds).
- **Rank names:** 級 and 段 marked as the app's own, 「練習3級」, so they are not taken for 珠算検定 grades.
- **Feel:** haptics, no sound.

Flow over compulsion: everything here rewards doing the work well (streaks, fading, speed). Nothing is random, nothing is taken away, and missing a day costs nothing.

## 2. The run

Tapping a けたの練習 grid cell starts a **run** of that kind. There is no fixed length: problems keep coming, one card after another, with the 〇 hold and card swipe of spec (roll) §3.

**Lives.** Three, drawn as three beads in the bar. A miss costs one; the third miss ends the run. A miss keeps its ✕ and its review (the step panel opens with it at F0–F1, waits to be asked for from F2), and つぎへ moves on. After the third miss's review, つぎへ opens the results (§5).

**Combo.** The number of right answers in a row in this run. A miss resets it to 0. It starts at 0 in every run.

**The level follows the record, live.** The fade ladder's rules are unchanged (`fade.ts`): five right answers in a row promote a level, two misses in a row demote one. What changes is that a run does not hold the level it started at, as a round did (spec (multi-digit ＋ −) §6, and the one-level-per-round rule of 2026-10-01). Each problem is drawn at the record's level as it stands when the problem is shown, so a promotion earned on one answer shows from the next problem on. Nothing is skipped: each level is played from the problem after it is earned, and the record's streaks restart at each change, as they do today. `applyPracticeAttempt`'s `playedAt` guard stays and always passes.

**Streaks start afresh in each run.** A run always ends on a miss (or a quit), so a record's `consecutiveWrong` carried into the next run would make that run's first miss demote at once. At the start of a run the kind's record has both streaks set to 0. Its level is untouched.

**手順を見る.** Still offered on every problem. An answer after opening it is "with help" (spec (core rounds) §5): it never moves the level. In a run, a right answer with help costs no life, scores nothing and leaves the combo as it was; a wrong answer with help is a miss like any other (a life, combo to 0), and still moves no level.

**Quitting.** ✕ asks first (`confirmQuit`), as now. Confirmed, the run ends: with at least one answer it opens the results (§5) with the points earned so far; with none it goes straight back to Home.

**Drawing problems.** One at a time, never one of the last 10 shown in this run. (1けた kinds have only a few dozen distinct problems: 1けた − has 36 pairs.)

**What goes:** rounds of ten (`ROUND_LENGTH`), `RoundTrack`'s ten segments, and the round summary (`SessionSummary`, `sessionResult`, `roundComplete`).

**Unchanged:** a × or ÷ kind never played opens its lesson first (spec (howto tutorial) §4), ending in 練習をはじめる, which now starts a run. Lessons' やってみよう score nothing and touch no run state.

## 3. Scoring

A right answer without help earns points:

```
points = round(base × level factor × combo factor × speed factor)
```

| Part | Rule |
|---|---|
| base | `round(problemTargetMs(problem, calibrationMs) / 100)`: 10 points per second of the problem's time target. Medians: 1けた ＋ ≈ 20, 2けた ＋ ≈ 40, 2けた × ≈ 120, 2けた ÷ ≈ 160, 3けた ÷ ≈ 320. |
| level factor | `1 + 0.25 × level`, the level the problem was shown at: F0 ×1, F3 ×1.75, F6 ×2.5. |
| combo factor | By the combo counting this answer: 1–4 ×1, 5–9 ×1.5, 10–19 ×2, 20 and up ×3. |
| speed factor | `t = answer time / (problemTargetMs × BEAD_SPEED_FACTOR)`. ×1.5 when t ≤ 1, ×1 when t ≥ 2, and `1.5 − 0.5 × (t − 1)` between. |

Worked example: 47 + 85 (base 46) at F3, the 12th right answer in a row, answered within its target: 46 × 1.75 × 2 × 1.5 = 241.5, rounded to **242**.

Why: a base from the time target makes every kind earn about the same per minute, so 1けた ＋ is not the way to farm points and a slow 3けた ÷ is not punished. The level factor is the biggest lever and rewards exactly what the app trains, the beads fading. Speed only ever adds.

**Answer time** is measured by the run from the moment the card is uncovered (`shownAt`, spec (roll) §3) to the こたえる press (the submission's `t`). It is used for points only: the record is still given `pace: null`, so levels move on accuracy alone (the owner, 2026-09-30). `QuestionView` is unchanged.

**`BEAD_SPEED_FACTOR`** starts at 2. The time targets were built for typed answers and tapping beads is slower; the factor is tuned on the owner's phone after the first TestFlight runs.

A miss, and a right answer with help, earn 0. The **run's score** is the sum of its answers' points.

**Best run.** Each kind keeps its best score. A run scoring more than the kind's best (and more than 0) replaces it and is a new best. The best is compared and saved when the run ends (its results), so a run cut short by a crash keeps its points but sets no best.

## 4. Rank

**Points** are a lifetime total: every answer's points are added as they are earned. The total never goes down, and nothing in a run can take points away.

**Twenty ranks**, from the total:

| Rank | ja | en |
|---|---|---|
| 0 | 練習10級 | Practice 10th kyu |
| 1–9 | 練習9級 … 練習1級 | Practice 9th kyu … Practice 1st kyu |
| 10 | 練習初段 | Practice 1st dan |
| 11–19 | 練習二段 … 練習十段 | Practice 2nd dan … Practice 10th dan |

Everyone starts at 練習10級 with 0 points. Rank k (1–19) is reached at `2500 × (1.4^k − 1)` points rounded to the nearest 100: 1,000 for 練習9級, 2,400, 4,400, … about 1.49 million for 練習十段. Each step needs 40% more than the one before: the first comes within about one run, the last after months of regular play. Past 練習十段 points keep adding and the bar stays full.

Points can cross a rank mid-run, but nothing is shown then, to keep the run's attention on the problems: a rank crossed is shown on the results (§5).

Existing players start at 0 points: 1.0 has only just been released.

## 5. Screens

**The run's bar** (in `RoundTrack`'s place): ✕, the three life beads, the level (「レベル 3/6」, as now) and the score. Under it, the combo once it is 2 or more: 「12れんぞく ×2」 (en "12 in a row ×2"), with a pulse as it grows. The prompt, the soroban, the boards and 手順を見る stay where they are.

**Moments.**
- 〇: the 〇 alone (the owner, 2026-10-06: no numbers in the 〇; the points float was removed) during the hold, then the card swipes off as now. The points go to the bar's score.
- A promotion: a short 「レベル 4」 banner on the next card. Where the level's look changes (F2→F3 and up), that card's beads start at the old look and ease to the new one once the card is uncovered, so the fade is seen happening.
- ✕: a life bead drops from the bar and the combo goes; then the review as now.
- A demotion: the same banner with the lower level; the beads come back without easing.

**Looking back** (the owner's request, 2026-10-06: "user should be able to go back to the previous problem if they wanted"). Once a problem has been answered, a ‹ sits in the bar right after ✕ (its place kept while it is not offered, so the lives do not shift). It is offered while no card moves. It shows the answered problem before the one on screen as it was left, on an opaque card over the stack, at once: its prompt (and board or column), the learner's beads, drawn solid whatever the level it was answered at (the controller's ruling, 2026-10-06: looking back is review, not a test), under its 〇 or ✕, drawn still and named for VoiceOver (正解 or ちがいます), and what they read. 手順を見る opens the step panel at the start with the answer (and, for a miss, the learner's number beside it); とじる closes it. Nothing on it can be answered or moved, and it touches nothing of the run: score, lives, combo and the record. Its one button, 「いまの問題にもどる」 (「結果にもどる」 from the results), closes it, and for a moment after, as after とじる, what it uncovers takes no tap, so a double tap cannot answer, move on or leave; ‹ again goes further back, as far as the first, skipping a problem rolled away unanswered by ✕. The stack stays as it was underneath, and the current problem's clock pauses while the learner looks back. ✕ works as ever (it asks first) and, confirmed, also closes the card looked at.

**Results** (replacing the round summary):
- The run's score, large; beneath it 「自己ベスト！」 for a new best, otherwise 「ベスト 3,420」.
- Three facts: right answers, longest combo, highest level reached.
- The rank bar filling with the run's points. When a rank is crossed, its name is stamped as a seal (`Seal`, `animateIn`), in the 和紙と木 style.
- **もう一回** (primary, full width) starts a new run of the same kind at once, at the record's level. **おわる** goes back to Home.

**Home.** A rank seal (the rank's name) and its bar to the next rank join the days-practised seal at the top. The grid cells are unchanged.

**Settings.** The guarded reset also erases the points and best runs, since they are part of stored progress.

**Haptics** (`expo-haptics`): a light impact on 〇, a success notification on a promotion and on a rank stamped on the results, a warning notification on ✕. The calls go through one helper (`src/ui/feel.ts`), so tests mock them in one place.

**Reduce Motion.** The combo pulse and the banner become plain fades, and the beads change level without easing, as the card swipe already becomes a fade (spec (roll) §3).

**VoiceOver.** A promotion or demotion is announced (「レベル 4」), and a miss announces the lives left alongside the ✕. Points are not announced per answer. The bar's lives, level and score are one label.

## 6. Data and code

**Stored progress**, added without a schema bump, as `practices` and `lessonsSeen` were:
- `points: number`: the lifetime total. The rank is derived from it, never stored.
- `bestRuns: Partial<Record<PracticeId, number>>`: each kind's best run.

Both are checked on load like `practices`: a missing or invalid `points` reads as 0, and a `bestRuns` entry that is not a known kind with a non-negative integer is dropped. Points are applied answer by answer, with the attempt, and reach the disk as answers do today (the provider's saves and `flush` at the end of the run).

**Domain** (pure, unit tested):
- `src/domain/score.ts`: `answerPoints({ problem, calibrationMs, level, combo, answerMs })` and the factors of §3, with `BEAD_SPEED_FACTOR`.
- `src/domain/rank.ts`: `RANK_COUNT`, `rankThreshold(k)`, `rankOf(points)`, and progress from the current rank's threshold to the next.
- `src/domain/run.ts`: a run's state and its step on each answer: lives, combo, score, longest combo, highest level, and whether it has ended. It also draws the next problem (never one of the last 10). The level is not kept here: it is the record's, read for each new problem.
- `src/domain/practice.ts`: a way to start a run's record with both streaks at 0 (§2). `applyPracticeAttempt` is otherwise unchanged.
- `src/domain/progress.ts`: the two fields, `emptyProgress`, and adding points and a best run.

**UI:**
- `RunRunner` replaces `RoundRunner`, keeping the card stack and swipe. `RunBar` replaces `RoundTrack`. `RunResults` replaces the round summary, and `SessionSummary` is deleted with the strings only it used.
- `app/round.tsx` keeps its route and `?kind=` deep link, and starts a run instead of drawing ten problems. It reads the level from the live record for each problem instead of holding it.
- Home gains the rank seal and bar.
- New strings in both catalogues for the bar, the combo, the banner, the results and the rank names.

**Docs:** the README's けたの練習, fade ladder and Screens sections describe runs; the curriculum design gets a status line that the five-minute frame was dropped on 2026-10-05.

## 7. Testing

- `score.test.ts`: the worked example (242); each factor's steps and bounds (combo 4/5/9/10/19/20; speed at t = 1, 1.5, 2 and beyond); the base for a few kinds.
- `rank.test.ts`: the thresholds (1,000, 2,400, …, the last), `rankOf` at and around each, the bar's progress, and a total past the last rank.
- `run.test.ts`: the third miss ends a run; a miss resets the combo; a right answer with help keeps the combo and scores 0; a wrong answer with help costs a life; the score sums the points; longest combo and highest level; no problem repeats within 10, for the smallest kinds too.
- `practice.test.ts` and `progress.test.ts`: a run's start clears both streaks and keeps the level; points add up; a best run is replaced only by a higher score; stored values are checked on load.
- Screen tests: a run through a promotion (the next problem at the new level, the banner); three misses to the results; quitting with and without answers; もう一回 starting a fresh run at the record's level; a new best saved and shown; the rank seal on Home; a rank crossed on the results.
- On the simulator (Expo Go and Maestro, recorded): the combo pulse, the banner and the beads easing to a new level.
- On TestFlight: the haptics, which only a phone has, and `BEAD_SPEED_FACTOR`, tuned from the owner's first runs.

## 8. Out of scope

Sound; leaderboards or any backend; timed challenge modes; best scores on Home's grid cells; changes to the progress screen; renaming the app (parked, see §1); runs mixing kinds.
