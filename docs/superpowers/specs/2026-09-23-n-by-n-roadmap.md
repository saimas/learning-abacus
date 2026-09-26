# learning-abacus — N × N practice (＋ − × ÷, up to 3 digits): roadmap

Date: 2026-09-23
Status: **Complete** (2026-09-24): P1, P2 and P3 have all shipped; see §9. **This is a roadmap, not an implementable spec.** Each sub-project below got its own design spec and implementation plan.

## 1. What the owner asked for

> "can you add a menu for user to select N x N (where N is 3 at max) for the digit of numbers to calculate" — and, on the follow-up: "i mean N x N for all type of calculation - addition, subtraction, multiplication, and division."

So: a menu that chooses an operation (＋ − × ÷) and a size (1, 2 or 3 digits), and practice of that kind. For example 3 × 3 addition means 472 + 385.

## 2. Decisions already made with the owner

- **A separate practice mode.** The chooser that the start button opens gains the new kinds of practice beside ぜんぶ. The daily five-minute session keeps teaching single-digit moves and is not changed by this work.
- **The full learning machinery applies:** the learner works a problem on the soroban first, the beads fade as they become fluent, and results are recorded and scheduled per operation and size.
- The original curriculum design (`2026-09-20-learning-abacus-curriculum-design.md` §5) already names these as scope stages 5 (multi-rod), 7 (掛算) and 8 (割算), all deliberately out of Phase 1. This work is that ladder.

## 3. What today's app already gives us

These carry over and should not be rebuilt:

- **The soroban domain** (`src/domain/soroban.ts`) is already rod-count agnostic: `emptySoroban(n)`, `setValue`, `readValue`, `applyStep(s, step, workingIndex)`, `tapSoroban`, `adjustRod`.
- **The abacus UI** (`src/ui/abacus/`) draws any number of rods and scales: `Abacus` takes `soroban` and `scale`, `geometryFor(scale)` derives every measurement, `FadeLayer` handles the seven visibility levels.
- **The learning model** (`fade.ts`, `fluency.ts`, `progress.ts`): fade ladder F0–F6, latency-based fluency, Leitner boxes, `recordAttempt`. Today it is keyed by atom id; the same machinery can be keyed by a practice id (see §5).
- **The runner** (`SessionRunner`) plays any plan of blocks and items, in bead mode or keypad mode, with the miss review (✕, こたえを見る, the step-by-step replay) and the correct-answer 〇.
- **The chooser** (`PartChooser`) is a sheet of choices in front of Home, already wired to routes.
- **Step decomposition and replay:** `decompose(atom)` and `moveStates(atom)` turn a single-digit move into soroban states. Multi-digit addition is these same moves applied column by column, so the replay extends rather than being reinvented.

## 4. What does not exist yet

1. **A problem that is not an atom.** Everything today is one of the 180 single-rod atoms. N × N needs a `Problem` concept (operands, operation), its answer, and its decomposition into soroban steps.
2. **Multi-rod reality on a phone.** A rod is 64 pt wide at scale 1; a 375 pt screen fits about five rods comfortably. See §6.
3. **Records for something other than an atom.** Scheduling, fade and the map are per atom today.
4. **A menu with two axes.** Operation × size is 12 combinations; the current sheet lists four rows.
5. **Teaching for × and ÷.** Multi-digit ＋ and − are the same moves the app already teaches, applied right to left. Multiplication and division are new techniques and need real lesson content in Japanese.

## 5. Sub-projects, in order

Each is a complete, shippable product on its own, with its own spec, plan and TestFlight build.

### P1 — Multi-digit ＋ and − (1–3 digits)

The foundation, and the one that pays for the plumbing.

- The menu (operation × size), the new practice mode and its route.
- A `Problem` domain unit: generation per operation and size, the answer, and the column-by-column step decomposition (reusing `decompose`). Generation rules: no negative results for −, and sizes are the digit counts of both operands.
- A 4-rod soroban (999 + 999 = 1998), bead answering, keypad answering as the beads fade, and the existing miss review.
- Records and scheduling keyed by practice id, for example `add:2` and `sub:3`.
- Where these appear on Home and in the progress screen.

### P2 — Multiplication 掛算 (up to 3 × 3)

- The soroban method, and how much of it the app insists on (§6).
- Teaching content: placement, the 九九 step, where each partial product lands.
- 3 × 3 gives a 6-digit product.
- Unlocks after ＋ and − at the same size are fluent.

### P3 — Division 割算 (up to 6 ÷ 3)

- The method (商立て and the correction step), which is the hardest to teach and the widest on screen.
- Unlocks after multiplication.

**Not in scope unless asked:** 見取算 (columns of several terms), 読上算 (audio), 検定 mock exams. 見取算 is the exam ladder's first real milestone and is a natural P4.

## 6. The one hard design problem: rods on a phone

At scale 1 a rod is 64 pt and a bead 50 × 21 pt; bead answering uses 1.38× so beads are tappable. A 375 pt screen has about 335 pt of usable width.

| Practice | Digits shown | Rods at scale 1 | Fits 375 pt? |
|---|---|---|---|
| Today (single move) | 2 | 128 pt | yes, at 1.38× |
| P1: 3-digit ＋ − | 4 | 256 pt | yes, at about 1.2× |
| P2: 3 × 3, product only | 6 | 384 pt | at about 0.8×, beads 40 × 17 pt |
| P2: 3 × 3, traditional placement (multiplier + multiplicand + product) | 12–13 | 832 pt | no — about 0.39×, beads 20 pt wide |
| P3: 6 ÷ 3, traditional placement | 12–13 | 832 pt | no |

So P2 and P3 must decide between:
- **(a) Operands as text, soroban for the product only.** The prompt already states the problem in words today ("7に8をたす。"), so this matches the app. It keeps 6 rods and stays tappable, at the cost of not rehearsing traditional placement.
- **(b) Traditional placement with a windowed or scrollable soroban,** or landscape. Faithful, but a small and fiddly board.
- **(c) Cap the size**, for example multiplication at 2 × 2 (8 rods) until a better answer exists.

My recommendation is (a) for P2 and P3, with the size ceiling the owner asked for kept intact. Decide it at the start of P2's brainstorm, not now.

## 7. Open questions for each sub-project's brainstorm

**P1:**
- Menu shape: one sheet with two steps (operation, then size), a grid of 12, or a small settings row? The current sheet holds four rows comfortably.
- Do the three sizes unlock in order, and does 2-digit require single-digit fluency first?
- Does a multi-digit attempt also credit the single-digit moves inside it on the 180-move map, or only its own record? (Recommendation: only its own record — a wrong 3-digit sum should not punish five atoms.)
- Bead answering for a 3-digit problem takes many taps. Is こたえる on the beads still right at F0–F2, or should multi-digit be keypad-only from the start with the soroban as a working surface? (Recommendation: keep beads, since that is the actual skill, but check it on device early.)
- Where do these appear on Home: the existing map card, a second card, or the progress screen?

**P2 / P3:**
- §6's (a) / (b) / (c).
- How much the app teaches versus assumes: does it walk the learner through the method the first time, as the reading drill does?
- Whether the 九九 (times tables) needs its own drill before 掛算.

**Cross-cutting:**
- The daily session stays as it is. If these modes later feed it, that is a separate decision.
- Latency targets for multi-digit are unknown; the existing calibration is for single moves.

## 8. How to resume (historical: followed for P1–P3)

1. Read this file and `2026-09-20-learning-abacus-curriculum-design.md` §5 (scope stages) and §7 (scheduling).
2. Start with **P1**. Run the brainstorming skill on P1 alone, settle §7's P1 questions with the owner, and write `docs/superpowers/specs/<date>-multi-digit-add-sub-design.md`.
3. Then the writing-plans skill, then subagent-driven development, then a simulator check and a TestFlight build, as with builds 3–8.
4. Keep P2 and P3 out of P1's spec. Revisit this roadmap when P1 ships.

## 9. Outcome

Every sub-project shipped, each with its own spec, plan and TestFlight build:

| Sub-project | Spec | Build |
|---|---|---|
| P1 — multi-digit ＋ − | `2026-09-23-multi-digit-add-sub-design.md` | 9 |
| P2 — × by 両落とし | `2026-09-23-multiply-design.md` | 10; operand board 13 |
| Core rounds — けたの練習 as Home, 手順を見る | `2026-09-23-core-rounds-design.md` | 12 |
| P3 — ÷ by 商除法 | `2026-09-24-divide-design.md` | 19 |
| ÷ walkthrough, bead by bead | `2026-09-24-divide-walkthrough-design.md` | 21 |

How §6 and §7's questions were settled:

- **Rods on a phone (§6).** × took (a): the soroban holds the product only (2N rods), and the two numbers are shown on a small read-only soroban beneath it. ÷ sets the dividend on the soroban as 商除法 does (7 rods at 3けた, about 0.70×) with the divisor on that read-only board. Beads work at every size; no size fell back to the keypad.
- **Menu.** First two segmented controls in the chooser (P1); then, at the owner's request, Home itself became the ＋ − × ÷ × 1 / 2 / 3けた grid, and the single-move session moved behind a smaller 基礎の練習 card (core rounds).
- **Unlocking.** Every size is open from the start.
- **Records.** One per kind (`add:2`); a multi-digit answer never credits or faults the single moves inside it.
- **Teaching.** A walkthrough before the first × and ÷ round, replayable from Home, plus 手順を見る on every question. 1×1 is the 九九 itself, so it doubles as the times-tables drill.
- **Cross-cutting.** The daily session is unchanged and is not fed by these modes. Multi-digit time targets are derived from the per-move targets, not yet tuned on real data.

Next, if asked: 見取算 as P4 (§5), the first step toward 暗算検定 7-10級.
