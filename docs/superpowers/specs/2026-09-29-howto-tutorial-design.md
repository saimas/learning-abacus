# learning-abacus — やりかた as a tutorial of its own

Date: 2026-09-29
Status: Design approved in conversation, spec pending review.

## 1. Why, and what the owner chose

Home's やりかた section replays two walkthroughs, かけ算のやりかた (47 × 36) and わり算のやりかた (1692 ÷ 36). The owner, 2026-09-29: "i think we should add more stages in やり方 section. addition, subtraction should be added. also we better show the cases by various 桁数 for each operation. it should be a full tutorial contents of its own."

Asked and answered:
- **Depth:** 1けた is taught **by technique**, one short lesson per kind of move. 2けた and 3けた get **one worked example each**, showing columns and carries across them.
- **Try it:** each lesson ends with **やってみよう**, one similar problem to answer on the beads. It is not recorded.
- **Entry:** Home's やりかた section becomes **four buttons**, ＋ − × ÷, each opening that operation's page of lessons.
- **Opening by itself:** only **× and ÷**, as now, but the lesson for the round's own 桁数. ＋ and − never interrupt.
- **Approach:** a **catalogue of lessons as data**. Step pages are generated from each example's own moves, in 手順を見る's words.

Out of scope for this spec: 見取算 lessons.

## 2. The lessons

Eighteen lessons (＋ 6, − 6, × 3, ÷ 3). The move classes are the app's own (`AtomClass`, named as in 手順を見る), and each example below was run through `problemSteps` to confirm the classes named.

| | 1けた | 2けた | 3けた |
|---|---|---|---|
| **＋ たし算** | そのまま 3＋1 · 五の合成 4＋3 · 十の繰上 8＋5 · 十の繰上と五の分解 6＋7 | 47＋38 (五の合成, then 十の繰上) | 575＋427 = 1002 (a 十の繰上と五の分解 whose carry ripples through two 9s into the thousands; *changed 2026-09-29 from 595＋427, whose ripple step was a −5 −3, not a complement*) |
| **− ひき算** | そのまま 4−3 · 五の分解 6−3 · 十の繰下 13−5 · 十の繰下と五の合成 12−6 | 82−37 (そのまま, then 十の繰下と五の合成) | 613−258 (五の分解, 十の繰下, 十の繰下と五の合成) |
| **× かけ算** | 7×8 (where a 九九's two digits go) | 47×36 (today's walkthrough) | 473×256 (nine 九九, one carry that ripples) |
| **÷ わり算** | 56÷7 | 1692÷36 (today's, with a guess fixed down) | 121088÷256 = 473 (with a guess fixed down too) |

- **One move each.** Each 1けた technique lesson is a single move on the ones rod. A 1けた subtraction never borrows (9 − 3 at most), so the borrowing lessons take a 1けた number from a 2-digit one (13 − 5, 12 − 6), set on the lesson's two rods. They are still lessons about one move.
- **Ids.** Lesson ids are `<op>:<technique>` for the 1けた ＋ − lessons (`add:direct`, `add:five`, `add:ten`, `add:both`, and the same for `sub`), and `<op>:<digits>` for every other lesson (`add:2`, `mul:1`, `div:3`, …).

### A lesson's pages

1. **Intro.** What the move or method is, and when it is used, in one or two sentences.
   - Technique lessons each have their own text.
   - The ＋ and − 2けた/3けた lessons share a method text: work from the highest place down, one column at a time, carrying into (or borrowing from) the rod on the left.
   - × keeps its method and placement pages. The placement page states the rule for the lesson's 桁数:
     - 1けた: a 九九's two digits go on the ones and tens rods.
     - 2けた: as now.
     - 3けた: the rule in general, the ones digit on the place the two multiplied places add up to.
   - ÷ keeps its walkthrough's opening.
2. **Steps.** One page per step group of the example, its bead steps playing as the page opens. The words are 手順を見る's (`groupLine`) for ＋ − ×, and the division walk's own for ÷. ＋ and − show the first number set on the soroban at the start. Only × has the number board beneath, as now.
3. **Result.** The problem and its answer.
4. **やってみよう.**
   - A similar problem on the beads, drawn solid (fade 0), with 手順を見る. A miss opens the step panel with its ✕, as at the first levels of a round.
   - Once answered, 「もう一問」 draws another and 「おわる」 goes back to the operation page.
   - Nothing is recorded: no attempt, no fade move, no day practised.
   - What is drawn: for a technique lesson, a 1けた move of that same class, chosen from the app's list of single moves (`atoms`) and set up as in 基礎 (`startValue`, so a borrow starts from 1 on the tens rod). For every other lesson, a problem of that operation and 桁数 from the round's own generator.

The two existing walkthroughs keep their pages. They become the × 2けた and ÷ 2けた lessons, with やってみよう added.

## 3. Screens and flow

- **Home.** The やりかた heading stays. Under it, four buttons in a 2×2 block, each opening its operation page, at the kit Button's 54 pt:
  - Japanese: 「＋ たし算」「− ひき算」「× かけ算」「÷ わり算」.
  - English: "+ Add", "− Subtract", "× Multiply", "÷ Divide".
  - VoiceOver reads たし算のやりかた and so on.
  - From 1.2× text size the buttons stack, one per row, as they do now.
  - The double-push guard covers all four.
- **Operation page** (`/howto/[op]`, titled e.g. 「たし算のやりかた」), with the kit's back link to Home.
  - Its lessons are grouped under 1けた / 2けた / 3けた headings.
  - Each row shows the lesson's name and example (「五の合成　4＋3」; for a 2けた or 3けた lesson just the example, 「47＋38」), and a ✓ once the lesson is done.
  - A row opens its lesson.
- **Lesson screen** (`/lesson/[id]`).
  - The walkthroughs' ✕, at the same place, leaves at any point and counts the lesson as done.
  - The pages have もどる / つぎへ, as the walkthroughs do now.
  - Opened from an operation page, the last page is やってみよう, and おわる returns to the operation page.
- **Before a first × or ÷ round.**
  - The round redirects to the lesson for its own kind (`/lesson/mul:1?kind=mul:1`).
  - Opened that way, the lesson leaves out やってみよう: the round comes next. Its last button is 「練習をはじめる」, which replaces the lesson with the round.
  - Its ✕ goes Home and counts as done, as now.

## 4. What is remembered, and when a lesson opens by itself

- **Stored progress** gains `lessonsSeen`, the ids of the lessons done. A lesson counts as done when the learner reaches やってみよう, presses 練習をはじめる (before a round), or leaves it with ✕.
- **The old flags carry over.** An older stored document still loads.
  - `multiplyIntroDone` counts as `mul:2` done, and `divideIntroDone` as `div:2` done.
  - The two flags are no longer written.
  - No schema bump, as the flags themselves were added.
- **Opening by itself.** A × or ÷ round opens its kind's lesson first only when that lesson is not done **and** the kind has no practice record yet. A learner who has already played a kind is never interrupted by it now.
- **＋ and −** never open a lesson by themselves.

## 5. How it is built

- **`src/domain/lessons.ts`** is pure. It holds:
  - the catalogue: each lesson's id, operation, 桁数, technique (1けた ＋ − only) and example;
  - `lessonsFor(op)`, in the page's order;
  - `lessonById(id)`;
  - `lessonForKind(kind)`, the × or ÷ lesson a round of that kind opens;
  - `tryProblem(lesson, random)`.
- **`src/domain/progress.ts`** gains `lessonsSeen`, `markLessonSeen`, and the load step for the old flags.
- **The lesson player** for ＋ − × grows out of `MethodIntro`: the intro page per lesson, ＋ − starting from their first number, and the board only for ×. ÷ keeps `DivideWalkthrough`, which already takes any problem, given the lesson's example.
- **`ProblemQuestion`** is extracted from RoundRunner's per-problem wiring (QuestionView, with its correction card, 見取算 column and operand board). RoundRunner and やってみよう share it.
- **Routes.**
  - `app/howto/[op].tsx` is the operation page.
  - `app/lesson/[id].tsx` is the lesson screen. It grows out of `IntroScreen`, with its ✕, its "counts as done" and its handoff to the round.
  - `app/multiply-intro.tsx` and `app/divide-intro.tsx` go, and `app/round.tsx` redirects to `/lesson/…` instead.
- **Strings** for both languages: the section and operation names, the operation pages' titles and 桁数 headings, the technique lessons' intro texts, the ＋ − method text, the × placement texts for 1けた and 3けた, やってみよう, もう一問, おわる and 練習をはじめる.

## 6. Testing

- **Catalogue.**
  - Each technique lesson's example is one column group of exactly that class.
  - Each example is a problem of its lesson's operation and 桁数.
  - The ＋ 3けた example carries through a 9 (a cascading group).
  - Every op has 1けた, 2けた and 3けた lessons, in order.
  - `tryProblem` keeps to its lesson over many seeded draws (the class for technique lessons, the kind otherwise).
  - `lessonForKind` finds the × and ÷ lessons.
- **Progress.**
  - `markLessonSeen` stores the id once.
  - A document with `multiplyIntroDone` / `divideIntroDone` loads as `mul:2` / `div:2` done.
  - A document without `lessonsSeen` loads.
- **Screens.**
  - Home's four buttons open their operation pages, once each under a double tap.
  - An operation page lists its lessons in order, with ✓ for done ones.
  - A lesson pages forward and back to やってみよう.
  - On やってみよう, a right answer shows 〇, a miss opens the step panel, もう一問 draws a new problem, おわる returns, and nothing reaches progress but `lessonsSeen`.
  - ✕ counts the lesson as done.
  - A lesson opened before a round has no やってみよう and starts the round.
  - A × or ÷ round opens its lesson only when that lesson is not done and the kind has no record.
- **Simulator** (iPhone 17 Pro and a 375 × 667 screen): Home's four buttons, an operation page, a technique lesson through to やってみよう, and the ÷ 3けた lesson.
- Then TestFlight build 30 and a PR.
