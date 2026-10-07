# learning-abacus

まいにち5分！そろばん練習 — a backend-free iOS app that teaches soroban arithmetic and mental
soroban (暗算, anzan) from zero prior soroban knowledge. All learning material is generated from a
fixed rule set and ships inside the app bundle, so the app is fully functional offline and makes no
network calls at runtime. Progress is stored on-device only.

The practice is **けたの練習**: ＋ − × ÷ with 1-, 2- or 3-digit numbers, 見取算 (a column of five)
and フラッシュ暗算 (five numbers flashed one at a time), in endless runs, started from each
operation's page off Home's menu. The learner works each problem on the soroban first; the beads
fade as the answers keep coming right, until they cannot be seen at all and the fingers still move
them.

## The 180 single-rod moves

Every soroban calculation decomposes into single-rod moves. A single-rod move is fully specified
by *(current rod value 0-9, operand 1-9, direction add/sub)* — exactly **180 moves** (atoms), the
complete alphabet of single-rod soroban arithmetic. They are generated, never hand-authored, and
each is classified into one of four technique classes by `classify()` in `src/domain/atoms.ts`:

| Class | Cognitive substitution | Count |
|---|---|---|
| Direct | none — move beads | 50 |
| 5's complement (五の合成/分解) | "add 4" becomes "add five, take one" | 40 |
| 10's complement (十の繰上/繰下) | "add 8" becomes "carry ten, take two" | 50 |
| Both | two substitutions in one move | 40 |

Every problem's steps are these moves: 手順を見る explains each one by its class (「十の繰上：8をたす
= +10 − 2」).

## The fade ladder

Each kind of problem (for example 2-digit addition, `add:2`) keeps one record, since its problems
are generated fresh every time. Seven fade levels (F0-F6) map to five renderings — solid beads,
dimmed, ghost outline, empty frame, then nothing — with the lowest three differing only in
coaching. Five right answers in a row promote a level; two misses in a row demote one. A run
follows the record as it moves: a level earned on one answer shows from the next problem on, so
none is skipped, and each run starts the streaks afresh. F6 means the beads are gone entirely: the
learner works from the soroban in their head.

At every level the learner answers by tapping beads and pressing こたえる, with no time limit
(speed earns a bonus). As the beads fade they still move where they would be, invisible or not, so
the fingers keep working the soroban (the owner, 2026-09-30); the number they read shows once the
answer is in. A run's bar shows its level (レベル 3/6), each card on an operation's page its kind's
level, and each button on Home the highest level among its operation's sizes.

## けたの練習

Home's 練習 menu has a button per operation (＋ − × ÷ ± フ), two to a row, each showing the
highest level among its sizes (or まだ) and tinted by the most advanced stage among them. A button
opens the operation's page: a card per size (1けた, 2けた, 3けた) with its stage, level and best
run, in its stage's colour, and for ＋ − × ÷ a やりかた button. A card starts a run: problems keep
coming until the third miss, then the results. Every size is open from the start.

| | 1けた | 2けた | 3けた |
|---|---|---|---|
| ＋ − | 7 + 8 | 47 + 85 | 472 + 385 |
| × (両落とし) | 7 × 8 | 47 × 36 | 472 × 385 |
| ÷ (商除法) | 56 ÷ 8 | 1692 ÷ 36 | 202032 ÷ 976 |
| ± (見取算) | 7, 3, −2, 8, −4 | 47, 30, −23, 61, −19 | five 3-digit numbers |
| フ (フラッシュ暗算) | 7, 3, 2, 8, 4, flashed | 47, 30, 23, 61, 19, flashed | five 3-digit numbers, flashed |

- **＋ −**: the soroban opens with the first number set. Subtraction never goes negative.
- **×**, 両落とし worked from the top: neither number is set. The learner builds the product only,
  adding each 九九 result as two digits at its place. Both numbers are shown on a small read-only
  soroban beneath the main one, with the digits being multiplied highlighted.
- **÷**, 商除法: the dividend is set on the soroban. For each quotient digit the learner places it
  and subtracts each 九九 of quotient digit × divisor digit; the quotient is left on the soroban.
  The divisor is shown on the small read-only soroban. Division is always exact.
- **±**, 見取算: five numbers in a column above the soroban, the first set on it at the start; one
  or two of the others are subtracted, and the running total never goes below 0. While stepping,
  the number being worked is highlighted, its bead moves stay coloured together, and the steps are
  grouped under a heading per number (「59をひく　77 → 18」).
- **フ**, フラッシュ暗算: five numbers, all added, flash one at a time in the prompt's place once
  the card is uncovered, about one a second (the first after 0.6 s, each for 0.7 s, 0.3 s apart),
  with a counter (1/5). After each of the first four the beads jump to the running total; the
  fifth flashes alone, and the learner adds it on the beads and answers the total; once the flash
  is over, until the answer is in, the prompt's place says so:
  「5つめの数を珠でたして、こたえましょう」. Until the flash ends the beads take no taps and もどす
  and こたえる are off; 手順を見る ends it at once and shows
  the five numbers as 見取算's column, and a flash problem gone back to with 戻る plays again from
  the start. The numbers cannot be replayed. As the level rises the beads that follow along fade
  like any others, until the whole running total is held in the head. Its points are timed from
  the end of the flash.
- **手順を見る** on every question opens the steps: ◀ ▶ play one bead move
  at a time and 最初から goes back to the start. The steps are grouped the way the learner thinks
  of them — the number added or taken off, each multiplicand digit, each quotient digit — each
  under a heading with what the soroban reads before and after it (「4×36　0 → 1440」), its bead
  moves coloured together. An answer given after opening it counts "with help": it is tallied but
  does not move the fade ladder.
- **After an answer**, on the beads, the number they read shows under the soroban (and, once a
  miss's steps take the soroban over, beside the answer: 「こたえは 81　あなたの答え 80」). A ÷ is
  read with its ones on the quotient's ones rod, N + 1 rods left of the dividend's. A right
  one is stamped with a 〇 where it stands; then the next problem is laid in its place underneath
  and the answered card is swiped off to the left over it, so the new problem never moves (with
  Reduce Motion on, the answered card fades away in place). A miss's つぎへ moves on the same way,
  and the last card goes over the results.
- **A wrong answer** gets a big ✕ and the same step panel, with the correct answer.
- **やりかた**: a tutorial of its own, from the やりかた button on the ＋ − × ÷ pages, each opening
  that operation's lessons by 桁数. 1けた ＋ − are taught move by move (そのまま, 五の合成, 十の繰上,
  十の繰上と五の分解, and the − ones); every other size has one worked example. A lesson walks its
  example on the soroban step by step, then やってみよう asks one like it (recorded nowhere).
  The first run of a × or ÷ kind never played opens its lesson first, ending in 練習をはじめる;
  ✕ leaves any lesson at any point, and every lesson done gets a ✓.

## Runs, points and rank

A run has three lives: each miss costs one, and the third ends it. Right answers in a row build a
combo, and the fade ladder moves mid-run, so a hot streak dims the beads in front of the learner
(they ease to each new look). Each right answer without help scores
`base × level × combo × speed`: the base is 10 points per second of the problem's time target, the
level adds 25% per fade level, the combo ×1.5 / ×2 / ×3 from 5 / 10 / 20 in a row, and an answer
within twice its target up to ×1.5 (slow costs nothing). The results show the score against the
kind's best, the right answers, the longest combo and the highest level, and the lifetime points
fill a rank bar: twenty ranks, 練習10級 to 練習十段, marked 練習 so they are not taken for 珠算検定
grades. A run is felt as well as seen: a tap on 〇, a pulse on a level or rank gained, a buzz on ✕.
戻る in the run's bar goes back to the problem before, as far back as the learner likes: it starts
afresh and counts like any other.

## Screens

- **Tutorial** — on first launch, reading the soroban: what number is on each rod.
- **Home** — the days-practised seal, the rank and its bar, and the 練習 menu: a button per
  operation, on one screen.
- **Operation page** — an operation's three sizes as cards that start runs, and やりかた for
  ＋ − × ÷.
- **Round** — full-screen practice: a run, its bar (lives, level, score, combo) and its results. ✕
  asks before leaving and keeps what was earned.
- **Progress** — days practised and the けたの練習 table, each cell coloured by its stage.
- **Settings** — days practised, the language toggle (Japanese by default, or English), and a
  guarded reset (two presses; the first only arms it) that erases all stored progress.

## Not in the app yet

- 暗算検定 practice as the exam sets it (50 columns of three to five 1-digit numbers in 12
  minutes), longer 見取算 columns than five, and フラッシュ暗算 of other lengths (3口, 10口), at
  other speeds or with a replay. Complement technique itself sits below 珠算能力検定 10級, which
  grades by problem size, so the app earns no official grade yet.
- Division with remainders, N × 1 and N ÷ 1 sizes, 帰除法, and the traditional × layout with
  both numbers on the soroban.
- Time targets tuned to the learner from rounds (they use the calibration 基礎の練習 measured
  before it was removed on 2026-09-28, or the default).
- Sound, 読上算 audio, 検定 mock exams, drag or swipe bead gestures, landscape, and any backend or
  sync (so no leaderboards).

## Prerequisites

- [Node.js](https://nodejs.org/) (a current LTS release)
- [Xcode](https://developer.apple.com/xcode/), for the iOS Simulator

## Getting started

```bash
npm install
npm run ios
```

`npm run ios` starts the Metro bundler and launches the app in the iOS Simulator via Expo.

## Testing

```bash
npm test
npm run typecheck
npm run lint
```

`npm test` runs the Jest suite (domain logic, content validation, and UI components).
`npm run typecheck` runs `tsc --noEmit` under TypeScript's strict mode.
`npm run lint` runs ESLint over the whole repository.

## Releasing

TestFlight builds are archived locally and uploaded without EAS; see
[docs/release-ios.md](docs/release-ios.md).

## Docs

Each feature has a design spec in [docs/superpowers/specs](docs/superpowers/specs) and an
implementation plan in [docs/superpowers/plans](docs/superpowers/plans). Start with:

- [Curriculum design](docs/superpowers/specs/2026-09-20-learning-abacus-curriculum-design.md) —
  the 180 moves and the fade ladder (history: it also describes 基礎の練習, removed on 2026-09-28)
- [N × N roadmap](docs/superpowers/specs/2026-09-23-n-by-n-roadmap.md) — how けたの練習 was
  split into ＋ −, × and ÷, and what comes next
