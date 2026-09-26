# learning-abacus

まいにち5分！そろばん暗算 — a backend-free iOS app that teaches soroban arithmetic and mental
soroban (暗算, anzan) from zero prior soroban knowledge. All learning material is generated from a
fixed rule set and ships inside the app bundle, so the app is fully functional offline and makes no
network calls at runtime. Progress is stored on-device only.

There are two kinds of practice:

- **けたの練習** — the core of the app: ＋ − × ÷ with 1-, 2- or 3-digit numbers, in rounds of
  ten, started from the grid on Home.
- **基礎の練習** — a fixed five-minute daily session that drills the 180 single-rod moves every
  calculation is built from.

Both run on the same machinery: the learner works on the soroban first, the beads fade as they get
faster, and every move and every kind of problem keeps its own record.

## The 180-atom model

Every soroban calculation decomposes into single-rod moves. A single-rod move is fully specified
by *(current rod value 0-9, operand 1-9, direction add/sub)* — exactly **180 atoms**, the complete
alphabet of single-rod soroban arithmetic; nothing else exists at this level. Atoms are generated,
never hand-authored, and each is classified into one of four technique classes by `classify()` in
`src/domain/atoms.ts`, the source of truth (the total and the per-class breakdown are asserted in
tests, verified four independent ways):

| Class | Cognitive substitution | Count |
|---|---|---|
| Direct | none — move beads | 50 |
| 5's complement (五の合成/分解) | "add 4" becomes "add five, take one" | 40 |
| 10's complement (十の繰上/繰下) | "add 8" becomes "carry ten, take two" | 50 |
| Both | two substitutions in one move | 40 |

The goal state is that all 180 fire below conscious thought. The Progress screen shows all 180
cells from day one, coloured by fluency and fade — the map of what's mastered and what's still
coming.

## The fade ladder

Visibility is applied per atom, independently of what's being taught. Seven fade levels (F0-F6)
map to five renderings — solid beads, dimmed, ghost outline, empty frame, then nothing — with the
lowest three levels differing only in coaching (demonstrate the move, correct on error, go
silent). An atom's fade advances one level after five consecutive correct answers within its
class's latency target, and drops one level after two consecutive misses. F6 means that move is
now performed entirely in the learner's head: mental arithmetic emerges gradually, atom by atom,
rather than being taught as a separate skill once bead technique is "done."

けたの練習 uses the same ladder with one record per kind of problem (for example 2-digit
addition, `add:2`), since its problems are generated fresh every time. The time target is scaled
to each problem from the per-move targets.

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

- **＋ −**: the soroban opens with the first number set. Subtraction never goes negative.
- **×**, 両落とし worked from the top: neither number is set. The learner builds the product only,
  adding each 九九 result as two digits at its place. Both numbers are shown on a small read-only
  soroban beneath the main one, with the digits being multiplied highlighted.
- **÷**, 商除法: the dividend is set on the soroban. For each quotient digit the learner places it
  and subtracts each 九九 of quotient digit × divisor digit; the quotient is left on the soroban.
  The divisor is shown on the small read-only soroban. Division is always exact.
- **手順を見る** on every question, here and in 基礎の練習, opens the steps: ◀ ▶ play one bead move
  at a time and 最初から goes back to the start. An answer given after opening it counts "with
  help": it is tallied but does not move the fade ladder.
- **A wrong answer** gets a big ✕ and the same step panel, with the correct answer.
- **Walkthroughs**: the first × round opens with かけ算のやりかた and the first ÷ round with
  わり算のやりかた; both can be replayed from links on Home. The ÷ walkthrough works 1692 ÷ 36
  one bead at a time, including a guess that is too big and how it is fixed.

## 基礎の練習: the daily session

Fixed at five minutes, because predictability is what makes the habit survive a bad day:

| Block | Time | Content |
|---|---|---|
| 準備 (warm-up) | 45s | Already-fluent atoms, rapid fire |
| 集中 (focus) | 120s | 1-3 new or shaky atoms, taught and drilled |
| 暗算 (fade rep) | 90s | Fluent atoms pushed one fade level up |
| まとめ (close) | 30s | The result |

Each session starts with at most two new atoms; up to four more join during the session, one at a
time, once every atom in play has been answered right five times in a row. The card on Home opens
a sheet offering the whole session (ぜんぶ) or any one part on its own, but nothing beyond the
five minutes is ever required — a negotiable habit is a dead habit.

## Screens

- **Tutorial** — on first launch, reading the soroban (stage 0): what number is on each rod.
- **Home** (今日の五分) — the days-practised seal, the けたの練習 grid, the walkthrough links and
  the 基礎の練習 card.
- **Round** and **Session** — full-screen practice. ✕ asks before leaving and keeps what was
  answered.
- **Progress** — the 180-atom map, as an addition grid and a subtraction grid (rows: the rod's
  value, columns: the operand), and the けたの練習 table.
- **Settings** — days practised, the language toggle (Japanese by default, or English), and a
  guarded reset (two presses; the first only arms it) that erases all stored progress.

## Not in the app yet

- 見取算 (columns of several numbers) — the next step on the 検定 ladder, and what the first
  realistic external milestone, **暗算検定 7-10級**, tests. Complement technique itself sits below
  珠算能力検定 10級, which grades by problem size, so the app earns no official grade yet.
- Division with remainders, N × 1 and N ÷ 1 sizes, 帰除法, and the traditional × layout with
  both numbers on the soroban.
- A recalibration session after a long absence, and latency targets tuned on real usage data.
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
  the 180 atoms, the fade ladder, scheduling and the scope stages
- [N × N roadmap](docs/superpowers/specs/2026-09-23-n-by-n-roadmap.md) — how けたの練習 was
  split into ＋ −, × and ÷, and what comes next
