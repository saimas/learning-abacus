# learning-abacus

A backend-free iOS app that teaches mental soroban arithmetic (暗算, anzan) from zero prior
soroban knowledge. All learning material is generated from a fixed rule set and ships inside the
app bundle, so the app is fully functional offline and makes no network calls at runtime.
Progress — per-atom fluency and fade level — is stored on-device only.

This is Phase 1: iOS only, single-rod arithmetic. See the spec and plan linked below for what's
deliberately out of scope (multiplication, division, multi-rod operation, 検定 mock exams, 読上算
audio, and any backend/sync).

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

## The daily session

Fixed at five minutes, because predictability is what makes the habit survive a bad day:

| Block | Time | Content |
|---|---|---|
| Warm-up | 45s | Already-fluent atoms, rapid fire |
| Focus | 120s | 1-3 new or shaky atoms, taught and drilled |
| Fade rep | 90s | Fluent atoms pushed one fade level up |
| Close | 30s | Result, atoms mastered, tomorrow's preview |

Each session starts with at most two new atoms; up to four more join during the session, one at a
time, once every atom in play has been answered right five times in a row. The app offers a
further block when there's time to spare, but never requires one — a negotiable habit is a dead
habit.

## Screens

- **Home** — days practised, today's five-minute plan, a preview of the atom map, and the button
  that starts the session.
- **Session** — the daily session, full-screen. While the beads are solid (F0-F2) the learner
  answers by tapping beads on the soroban, untimed; from F3 on they type the answer on a built-in
  keypad. ✕ asks before leaving and keeps what was answered.
- **Progress** — the 180-atom map, as an addition grid and a subtraction grid (rows: the rod's
  value, columns: the operand).
- **Settings** — days practised, the language toggle, and a guarded reset (two presses; the first
  only arms it) that erases all stored progress.

## Phase 1 scope

**In:** stages 0-4 — reading the soroban, then all 180 single-rod atoms across direct moves, 5's
complements, 10's complements, and combined complements — the full fade ladder, the session
engine, and the 180-atom progress map. iOS only, fully offline.

**Out:** multiplication, division, multi-rod operation, 見取算 strings, 暗算検定 mock exams, 読上算
audio, drag or swipe bead gestures (bead answers are tapped, not dragged; while the beads are
solid — F0-F2 — the learner answers by tapping them, untimed, and from F3 on by typing on the
keypad), and any backend or sync.

Stages 0-4 sit entirely below the official 珠算能力検定 10級 syllabus — the 検定 ladder grades by
problem size, not by complement technique — so Phase 1 earns no official grade. The progress map
is deliberately the app's sole source of visible motivation until the first realistic external
milestone, **暗算検定 7-10級**, which sits just past Phase 1.

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
`npm run lint` runs ESLint.

## Docs

- [Spec](docs/superpowers/specs/2026-09-20-learning-abacus-curriculum-design.md)
- [Implementation plan](docs/superpowers/plans/2026-09-20-phase-1-single-rod-anzan.md)
