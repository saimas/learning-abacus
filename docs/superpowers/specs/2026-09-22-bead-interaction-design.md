# learning-abacus — Answering with the beads

Date: 2026-09-22
Status: Implemented on feature/bead-interaction (TestFlight build 4)

## 1. Goal and constraints

Let the learner work a calculation on the soroban itself. At the levels where
the beads are fully visible, the learner taps beads to move them, and the
soroban's final value is the answer.

This is the curriculum spec's own intent. Its fade ladder reads "F1 — User
moves beads; app corrects immediately", and it calls the app "the soroban".
Phase 1 postponed this and accepted typed answers only
(`2026-09-20-learning-abacus-curriculum-design.md` §4 and §11). The request
came from the user after trying TestFlight build 3.

Decisions made with the user:

- **The beads are the answer at F0–F2.** At those levels the learner moves
  the beads to the result and taps こたえる, and the app reads the soroban.
  From F3 up (beads dimmed, ghosted or gone) the learner answers on the
  keypad from memory, as now. The beads are not a scratchpad, and individual
  moves are not checked one by one.
- **Speed does not count while answering with beads.** At F0–F2, five
  correct answers in a row promote an atom, whatever the time, and bead-mode
  times are not recorded. Speed gating starts at F3.
- **Layout A.** At bead levels the keypad is replaced by an enlarged soroban
  within thumb reach, with もどす (reset) and こたえる below it. The approved
  mockup is `2026-09-22-bead-interaction-mockups/bead-layout.html`.
- **The demonstration stays text for now.** Animating the F0 demonstration,
  or replaying the correct move after a miss, is a later feature.

The reading drill is unchanged: it teaches reading beads, not moving them.

## 2. What already exists

- `src/domain/soroban.ts`: `Rod { heaven: boolean; earth: number }`,
  `Soroban { rods }`, `rodFor`, `readRod`, `readValue`, `setValue`,
  `applyStep`.
- `src/domain/fade.ts`: `visualForFade` (F0–F2 are `solid`) and
  `coachingForFade`.
- `src/domain/fluency.ts`:
  - `applyAttempt(record, cls, correct, latencyMs, calibrationMs, now)`
    counts a correct answer toward `consecutiveCorrect` only when it beats
    `latencyTargetMs`.
  - The target scales with `calibrationMs`, which `recordAttempt` derives
    from the learner's own direct-class latencies.
- `src/ui/abacus/`:
  - `geometry.ts` places beads by value (`beadTops`) at fixed sizes.
  - `Abacus` draws a static layer plus the `FadeLayer`-wrapped bead layer.
  - Beads are not interactive.
- `SessionRunner`:
  - It renders `setValue(emptySoroban(2), rodValue)` and expects
    `rodValue + sign * operand`.
  - It answers on `AnswerPad`.
  - It reports `{ atomId, correct, latencyMs }` through `onAttempt` to
    `ProgressProvider.attempt`, which calls `recordAttempt`.

### A defect this feature has to fix

A subtraction that needs a borrow, such as 3 − 5, is shown with 0 on the
tens rod, and the runner expects −2. No typed answer can produce −2, because
the keypad has no minus key. No bead move can reach it either, because the
tens rod has nothing to borrow. Bead answering cannot work at stage 3 without
fixing this. PRs #2 and #3 recorded it as a known issue.

## 3. Domain changes

These are all pure functions in `src/domain/`, so the purity test still
applies.

### 3.1 Where a problem starts and ends (`src/domain/atoms.ts`)

- `startValue(atom): number`. For a subtraction whose result would go below
  0 (`rodValue − operand < 0`), return `10 + rodValue`, so there is a 1 on
  the tens rod to borrow. Otherwise return `rodValue`.
- `expectedValue(atom): number`, which is
  `startValue(atom) + (add ? operand : −operand)`.
  - 7 + 4 → 11
  - 3 − 5 → 13 − 5 = 8
  - 1 + 3 → 4

  The result is always between 0 and 18.

`SessionRunner` uses these in place of its own arithmetic. The soroban is
`setValue(emptySoroban(2), startValue(atom))`, and the prompt reads the start
value.

### 3.2 Tapping a bead (`src/domain/soroban.ts`)

`type BeadRef = { kind: 'heaven' } | { kind: 'earth'; index: number }`. Earth
index 0 is the bead nearest the beam.

`tapBead(rod, bead): Rod` follows real-soroban rules:
- **Heaven bead:** toggles.
- **An earth bead that is away from the beam** (`index ≥ earth`): it moves to
  the beam, and so does every bead between it and the beam. The new
  `earth` is `index + 1`.
- **An earth bead at the beam** (`index < earth`): it moves back, and so
  does every bead beyond it. The new `earth` is `index`.

`tapSoroban(soroban, rodIndex, bead): Soroban` applies the same rule to one
rod. `adjustRod(soroban, rodIndex, delta): Soroban` changes one rod's value by
±1, clamped to 0–9, for VoiceOver.

### 3.3 How answers are entered (`src/domain/fade.ts`)

`answerModeForFade(level): 'beads' | 'keypad'` returns `'beads'` for F0–F2,
the solid levels, and `'keypad'` otherwise. The runner asks this function
and nowhere else decides.

### 3.4 Untimed attempts (`src/domain/fluency.ts`, `src/domain/progress.ts`)

`latencyMs` becomes `number | null` in `applyAttempt`, `recordAttempt` and
`AttemptResult`. `null` means the attempt was untimed, which is the case for
bead answers. The speed check is waived for an untimed attempt only while
the atom's own level is still a bead level — `answerModeForFade(record.fade)
=== 'beads'`, i.e. F0–F2. A session plan freezes each item's *presented*
fade at session start (`src/domain/session.ts`; requeuing and refilling keep
`item.fade`), so an atom that is promoted past F2 mid-session can still be
shown with beads and answered untimed for the rest of that session; past F2
those untimed correct answers must not keep advancing the streak, or a bead
session could carry an atom through F3–F6 having never been timed once. So,
for an untimed attempt:
- a correct answer counts toward `consecutiveCorrect` without a latency
  check only while the atom's own fade is F0–F2, so five in a row promotes
  the fade level as before up through F3; at F3 and beyond an untimed
  correct answer does not advance the streak;
- `recentLatencyMs` is left unchanged, so nothing slow reaches the median or
  the calibration;
- the box, `consecutiveWrong`, demotion and `dueAt` behave exactly as for a
  timed attempt.

Timed attempts are unchanged. No stored data changes, so there is no schema
bump or migration.

Two consequences of this rule, both intended:
- **An atom at F0–F2 is never "reflex"**, because `isReflex` needs a full
  latency window. So the fade-rep block does not pick it up. It climbs the
  bead levels through ordinary warm-up and focus repetitions instead.
- **The stage unlock needs both F3 and reflex**, so it is still decided by
  timed, mental answers.

## 4. The interactive soroban (`src/ui/abacus/`)

- **Scale.** Geometry becomes a function of scale:
  `geometryFor(scale)` returns the same named constants multiplied by
  `scale`. `beadTops(rod, scale)` uses it. `scale` defaults to 1, so
  existing callers and tests are unaffected.
  - The typed layout uses scale 1, which reproduces today's numbers
    exactly.
  - The bead layout uses **1.38**: beads 69 × 29 pt, rods 88 pt wide.
- **Hit testing.** Each rod column is one pressable area. The tap's
  `locationY` maps to a bead through a pure `beadAt(rod, y, scale):
  BeadRef`:
  - above the beam, the heaven bead;
  - below the beam, the earth bead whose centre is nearest.

  A tap anywhere on the rod therefore picks a bead, which gives a bigger
  target than the bead alone.
- **Props.** `Abacus` takes optional `onTapBead(rodIndex, bead)` and
  `onAdjustRod(rodIndex, delta)`, plus `scale`. Without them it is exactly
  today's static soroban. The parent owns the soroban state, so `Abacus`
  stays controlled.
- **Motion.** Beads slide to their new position in about 150 ms, using React
  Native `Animated`, with each bead's `top` driven from `beadTops`. A tap
  during a slide retargets it.
- **Accessibility.** With `onAdjustRod`, each rod has
  `accessibilityRole="adjustable"`, a label (一の位 or 十の位), its value, and
  increment and decrement actions. Beads are never separate accessibility
  elements.
- **Fading.** `FadeLayer` and `showsFrame` are unchanged. Bead mode only
  exists at the solid levels, so interaction never happens on a faded
  soroban.

## 5. The session screen in bead mode

When `answerModeForFade(current.fade)` is `'beads'`:

- **Layout, top to bottom:**
  - the track;
  - a scroll area holding the prompt, the demonstration (F0) and the
    correction card;
  - the enlarged soroban;
  - the hint 珠をタップして動かします;
  - a button row: **もどす** (outline, one third) and **こたえる** (primary,
    two thirds).

  The soroban, hint and buttons are pinned. Only the text area scrolls, as
  in the small-screen fix from PR #3. That keeps the whole soroban and both
  buttons on a 375 × 667 screen.
- **Start of each question:** the soroban shows `startValue(atom)`.
- **もどす** puts it back to that start value.
- **こたえる** is disabled until the soroban differs from the start value.
  An unchanged soroban is not an answer, the same rule as a blank keypad
  field, so a stray tap cannot use up one of the atom's three attempts.
- **Submitting** reads `readValue(soroban)` and compares it with
  `expectedValue(atom)`. It reports `latencyMs: null`, and the rest of
  `submit()` (requeue, failure cap, deadlines, correction) is unchanged.
  The soroban then resets to the next question's start value.
- **The 〇** after a correct answer, and the 正解 announcement, work as now.
  The 〇 sits at the top right of the soroban.

When the mode is `'keypad'`, the screen is exactly today's typed layout,
except that the prompt shows the start value (see §6).

The retry rule for misses is unchanged: a miss at F4 or above comes back one
level lower. Bead mode covers F0–F2 only, so every retry at F3 or above
stays on the keypad.

## 6. Strings

The `prompt` in both catalogs uses `startValue(atom)` instead of
`atom.rodValue`:
- ja: `13から5をひく。` and `7に4をたす。` (the format is unchanged);
- en: `Rod shows 7. Add 4.` becomes `The soroban shows 13. Subtract 5.`, the
  same wording for every prompt, because "rod" was wrong once the tens rod
  can be 1.

The correction card and every other `prompt` caller follow automatically.

New keys, in both catalogs:

| Key | ja | en |
|---|---|---|
| `beadHint` | 珠をタップして動かします | Tap the beads to move them |
| `resetBeads` | もどす | Reset |
| `rodName(place)` | 一の位 / 十の位 | ones rod / tens rod |

`place` is 0 for the ones rod and 1 for the tens rod.

## 7. Testing

- **Domain:**
  - `tapBead` for every case (heaven toggle, pushing several earth beads
    up, sending several back, the bead at the boundary) and `tapSoroban`;
  - `adjustRod` clamping at 0 and 9;
  - `startValue` and `expectedValue` for no borrow, a borrow (3 − 5 → 8),
    and a carry (7 + 4 → 11), plus a property check that `expectedValue` is
    between 0 and 18 for all 180 atoms;
  - `answerModeForFade` for every level;
  - `applyAttempt` and `recordAttempt` with `latencyMs: null`: five untimed
    correct answers promote, the latencies stay untouched, the calibration
    is unchanged, and a miss still demotes and resets the box.
- **Geometry:** `geometryFor(1)` equals today's constants, and
  `beadAt(rod, y, scale)` returns the right bead above the beam, below the
  beam, and between two beads.
- **Abacus:**
  - a tap calls `onTapBead` with the bead under the tap;
  - with no handler there is no pressable and no adjustable role;
  - adjustable actions call `onAdjustRod`;
  - scale 1.38 produces the larger bead sizes.
- **SessionRunner:**
  - F0–F2 shows the soroban and no keypad; F3+ shows the keypad and no
    bead buttons;
  - こたえる is disabled until a bead moves;
  - もどす restores the start value;
  - moving the beads to the right value scores correct with
    `latencyMs: null`;
  - a borrow atom starts at 13 and accepts 8;
  - the correction still names the previous problem.
- **Integration** (`SessionRunner.integration.test.tsx`): the session is
  played with beads at F0–F2 and the keypad at F3+. The prompt regex
  accepts a two-digit start value. The existing assertions still hold (the
  whole 255 s of practice is delivered, every answer is recorded, atoms
  climb the ladder).
- **On device:** a Maestro run on the iPhone 17 Pro and iPhone SE
  simulators covering tapping, もどす, a correct bead answer, a wrong bead
  answer with its correction, a borrow question (13から…), and the switch to
  the keypad at F3. Then TestFlight build 4.

## 8. Out of scope

- Animating the demonstration or replaying the correct move after a miss
  (the next feature).
- Checking each bead move as it is made, the curriculum spec's "corrects
  immediately" in the strict sense.
- Drag or swipe gestures, haptics, and bead sounds.
- Bead input in the reading drill, and "set this number" exercises.
- Soroban sizes other than 1 and 1.38.
