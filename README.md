# learning-abacus

まいにち5分！そろばん練習 — a backend-free iOS app that teaches soroban arithmetic and mental
soroban (暗算, anzan) from zero prior soroban knowledge. All learning material is generated from a
fixed rule set and ships inside the app bundle, so the app is fully functional offline and makes no
network calls at runtime. Progress is stored on-device only.

The practice is **けたの練習**: ＋ − × ÷ with 1-, 2- or 3-digit numbers, and 見取算 (a column of
five), in rounds of ten, started from the grid on Home. The learner works each problem on the
soroban first; the beads fade as they get faster, until the work is mental.

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
= +10 − 2」), and a round's time target is built from the per-move time targets.

## The fade ladder

Each kind of problem (for example 2-digit addition, `add:2`) keeps one record, since its problems
are generated fresh every time. Seven fade levels (F0-F6) map to five renderings — solid beads,
dimmed, ghost outline, empty frame, then nothing — with the lowest three differing only in
coaching. Five fast right answers in a row promote a level; two misses in a row demote one. F6
means that kind of problem is now done entirely in the head.

While the beads are solid (F0-F2) the learner answers by tapping beads and pressing こたえる,
untimed; from F3 on they type the answer on a built-in keypad.

## けたの練習

Home's grid has a row per operation and a column per size, each cell coloured by its stage. A
tap starts a round of ten problems, then a summary. Every size is open from the start.

| | 1けた | 2けた | 3けた |
|---|---|---|---|
| ＋ − | 7 + 8 | 47 + 85 | 472 + 385 |
| × (両落とし) | 7 × 8 | 47 × 36 | 472 × 385 |
| ÷ (商除法) | 56 ÷ 8 | 1692 ÷ 36 | 202032 ÷ 976 |
| ± (見取算) | 7, 3, −2, 8, −4 | 47, 30, −23, 61, −19 | five 3-digit numbers |

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
- **手順を見る** on every question opens the steps: ◀ ▶ play one bead move
  at a time and 最初から goes back to the start. The steps are grouped the way the learner thinks
  of them — the number added or taken off, each multiplicand digit, each quotient digit — each
  under a heading with what the soroban reads before and after it (「4×36　0 → 1440」), its bead
  moves coloured together. An answer given after opening it counts "with help": it is tallied but
  does not move the fade ladder.
- **After an answer**, a right one is stamped with a 〇 where it stands; then the problem fades out
  as it drifts a little to the left, and the next fades in, settling from a little to the right
  (only the fade with Reduce Motion on). A miss's つぎへ moves on the same way.
- **A wrong answer** gets a big ✕ and the same step panel, with the correct answer.
- **Walkthroughs**: the first × round opens with かけ算のやりかた and the first ÷ round with
  わり算のやりかた; both can be replayed from links on Home, and ✕ leaves either at any point
  (it counts as seen). The ÷ walkthrough works 1692 ÷ 36
  one bead at a time, including a guess that is too big and how it is fixed.

## Screens

- **Tutorial** — on first launch, reading the soroban: what number is on each rod.
- **Home** (今日の五分) — the days-practised seal, the けたの練習 grid, and the walkthrough links.
- **Round** — full-screen practice. ✕ asks before leaving and keeps what was answered.
- **Progress** — days practised and the けたの練習 table, each cell coloured by its stage.
- **Settings** — days practised, the language toggle (Japanese by default, or English), and a
  guarded reset (two presses; the first only arms it) that erases all stored progress.

## Not in the app yet

- 暗算検定 practice as the exam sets it (50 columns of three to five 1-digit numbers in 12
  minutes), and longer 見取算 columns than five. Complement technique itself sits below 珠算能力検定
  10級, which grades by problem size, so the app earns no official grade yet.
- Division with remainders, N × 1 and N ÷ 1 sizes, 帰除法, and the traditional × layout with
  both numbers on the soroban.
- Time targets tuned to the learner from rounds (they use the calibration 基礎の練習 measured
  before it was removed on 2026-09-28, or the default).
- 読上算 audio, 検定 mock exams, drag or swipe bead gestures, landscape, and any backend or sync.

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
