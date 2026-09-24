# learning-abacus — The division walkthrough, guess by guess

Date: 2026-09-24
Status: Implemented on feature/divide-walkthrough (TestFlight build 21). Replaces the ÷ walkthrough described in `2026-09-24-divide-design.md` §3 (its text pages) with a bead-by-bead walkthrough.

## 1. Why, and what the owner chose

After build 20 the owner still could not follow わり算のやりかた: "wording is just hard to process as image", and asked for a way back through it. A web walkthrough of 1692 ÷ 36, where each step shows the soroban, what is left as a real number, and the guess going wrong and being fixed, is what made it click: "now i finally got it … this exact animation (with bead move to be one by one move) should be on the app." Then, in their words, the rule behind it: "the candidate number has to … pass through each digit … and when it sees error, it should go back to the point of the current lane then adjust the number and try again."

Decisions:
- **▶ moves one bead step**, as 手順を見る does in a round. A step with no beads (a guess, a 九九 that won't come off) takes one ▶. ◀ goes back the same way.
- **The walkthrough only.** It replaces the ÷ text pages (method, guess, placement, one page per group, result). No chunk or bar pages before it.
- In Japanese (English in the English catalogue), for 1692 ÷ 36.
- The rounds' 手順を見る is unchanged: it still plays the right digit directly, with the guess in words.
- The × walkthrough (かけ算のやりかた) keeps its pages but gains a ◀ back button, the owner's other request.

## 2. Domain (`src/domain/divisionWalk.ts`, pure)

`divisionWalk(problem)` works an exact ÷ problem the way a learner does. The rounds' `quotientSteps` places the right digit at once; this places the 九九 guess and repairs it. The steps (`WalkStep`):

| kind | what happens | beads |
|---|---|---|
| `set` | the dividend is on the soroban | none |
| `guess` | the digit at quotient place p is guessed: `partial` (what is left above place p + N − 1) ÷ the divisor's first digit, capped at 9 (`raw` is before the cap); `chunk` is what is left counted in 10^p's (169 tens) | none |
| `try` | the guess is placed on its rod (p + N + 1), one or two left of the head of what is left (`lead`, `split`, as in the rounds) | yes |
| `take` | one 九九 of the digit and a divisor digit y (place j) comes off: `amount` = digit·10^p × y·10^j; `resumed` after a fix; `last` when it is the digit's last 九九 | yes |
| `stuck` | the next 九九 will not come off what is left, so the digit is too big | none |
| `fix` | the digit is lowered by one, and one copy of the divisor digits already taken off (`taken`, e.g. 30) is put back: `back` = taken·10^p. `putBack` lists the digits that go back, `{ digit, place }`, highest first, each with the rod place it goes on (p + k); a 0 moves no bead, so it is left out. The badges, focus rods, underlined divisor digits and the rods line all come from it. This is the same as going back to the lane's start (`laneStart`) and taking the lowered digit's 九九 | yes |
| `done` | the quotient is read off the left | none |

After a fix the walk carries on from the 九九 that got stuck. A guess of 0, including when nothing is left, is a `guess` with no `try`. A fix down to 0 ends the lane. Each step also carries:
- `steps` (bead steps, played by the same `playDigits` and carry and borrow logic as the rounds; `playDigits` and `productDigits` are exported from `problem.ts` for this);
- `left` (what is left below the quotient's rods after the step);
- `focus` (rods it works on);
- `marks` (a badge per rod: the digit put on or taken off);
- `divisorPlaces` (divisor digits in use, for the problem line);
- `answer` (the answer boxes: a digit is on `trial` until its last 九九 comes off).

`walkStates(problem, walk)` gives the soroban at the start and after each bead step. `walkFrames(walk)` lists what each ▶ shows: one frame per bead step, or one frame for a step without beads, together with where each step's bead steps start (for the colouring).

1692 ÷ 36 walks in 14 steps and 17 bead steps (23 frames):

set 1692 → guess 16÷3 → 5 → try 5 → take 50×30=1500 (192) → stuck on 50×6=300 → fix 5→4, put back 300 (492) → take 40×6=240 (252 ✓) → guess 25÷3 → 8 → try 8 → take 8×30=240 (12) → stuck on 8×6=48 → fix 8→7, put back 30 (42) → take 7×6=42 (0 ✓) → done 47.

Invariants, tested over every 1けた and 2けた problem and 10,000 3けた ones:
- the walk ends on the rounds' final soroban (q × 10^(N+1));
- every rod stays within 0–9 (`applyPlacedStep` throws otherwise);
- a digit never gets stuck on its first 九九, since the guess is that 九九;
- each lane settles on the quotient's digit, and the fixes in a lane lower the digit one at a time.

## 3. Words (`ja.ts`, `en.ts`)

`divideWalk(problem, step)` returns `{ what, math, note, rods }`, with an empty string where a step has none. The Japanese for 1692 ÷ 36:

| step | what | math | note | rods |
|---|---|---|---|---|
| set | 1692をそろばんに置く | | 1692の中に36がいくつ入るかを、答えの大きい位から1けたずつ決めていく。左はしのけたは空けておく。答えはそこにできていく。 | |
| guess | 答えの十の位：169の中に36はいくつ？ | 見当 16÷3 → 5 | 36を30と思って九九：3×5=15は16に入る。 | |
| try | 5を置いてみる（50×36） | | のこりの頭16は36より小さいので、頭の1つ左に置く。5×3も5×6も引けたら、5で決まり。 | |
| take | 50×30=1500を引く | 1692−1500=192 | | そろばんでは：5×3=15　千の位から1、百の位から5を引く |
| stuck | 50×6=300を引く……引けない | 192−300 ✗ | のこりの192は300より小さい。5は大きすぎた。 | |
| fix | 戻す：5を4にして、300を足し戻す | 192+300=492 | 50×30を引いたが、40×30でよかった。多く引いた10×30=300を戻す。やり直さなくていい：1692に戻して40×30を引いたのと同じ492になる。 | そろばんでは：答えのけたから1を引き、百の位に3を足す |
| take (last) | つづけて40×6=240を引く | 492−240=252 ✓ | 4×3も4×6も引けたので、4で決まり。 | そろばんでは：4×6=24　百の位から2、十の位から4を引く |
| done | 答えを読む | 1692÷36=47 | 左に47。右はすべて0。 | |

Other cases:
- **A capped guess:** 見当 32÷3 → 10以上なので9.
- **A guess of 0:** 9は6に入らないので、この位は0（置かない）。
- **Nothing left:** 答えの…：のこりは0, and the note のこりが0なので、この位は0（置かない）。
- **A 1-digit divisor:** 九九：7×8=56は56に入る。
- **A fix down to 0:** ends with この位は0（置かない）。
- **A fix whose put-back carries on up the rods** (797402 ÷ 998): the rods line, built from `putBack`, ends with the × product line's note, （さらに上の位へ繰り上がる） / "(and carries again into the next rod)".
- **English** says the same thing, e.g. "Fix it: 5 → 4, and put back 300", "No need to start over: it's the same 492 as going back to 1692 and taking away 40 × 30."
- **Labels:** のこり / left, 答え / Answer, and short rod names (一 十 百 千 万 …; 1 10 100 1000 10k …).

The old ÷ page strings (`divideIntroMethod`, `divideIntroGuess`, `divideIntroPlacement`, `divideIntroResult`) go. `divideIntroTitle` stays.

## 4. Screen (`src/ui/intro/DivideWalkthrough.tsx`)

Top to bottom:
- **Header:** わり算のやりかた, with one dot per step. Reached dots are filled with the accent. A stuck step's dot is always a ring, outlined in the accent, whether reached or not, so the places a guess turns out too big stay in sight.
- **Problem line:** 「1692 ÷ 36」, with the divisor digits in use (`divisorPlaces`) in the accent and underlined. On the right are the 答え boxes: dashed while empty, a trial digit in the accent with 「?」, a settled digit in ink.
- **Rod readings above the soroban,** aligned with its rods: each rod's digit, with focus rods in the accent. A badge under a digit shows the step's mark: `5?` for a trial, `−3?` for a 九九 that won't come off, and `−1` or `+3` otherwise.
- **The soroban (`Abacus`):**
  - the focus rods have the soft band behind them (`highlightRods`);
  - on a step with beads, its beads so far are tinted as in a round (`stepColouring` over the walk's states, with the steps' starts as groups);
  - rod names (一 十 百 千 万) sit under it.
- **Explanation:**
  - the bold `what` line;
  - のこり and the number left, then `math`. The colour comes from the step, not the text: green for a digit's last 九九 (its sum ends in ✓), accent for a 九九 that will not come off (✗), and ink otherwise;
  - `note`;
  - `rods`, small and muted.
- **Controls pinned at the bottom:**
  - ◀ (disabled on the first frame), the frame count ("5 / 23"), and ▶;
  - on the last frame, ▶ gives way to the finish button (はじめる before a round, おわる from Home).
- **Beads first:** のこり and the answer boxes change when a step's last bead lands. Until then they show what they did before the step. They are not the rods' number mid-step, since a take's first bead leaves only part of its 九九 off.
- **Layout and VoiceOver:**
  - everything above the controls scrolls, so a short phone can reach the note;
  - the scroll returns to the top when the step changes, but not while the same step's beads move;
  - VoiceOver hears the new `what` and `math` when a step changes (joined by `divideWalkSpoken`: 「、」 in Japanese, a full stop in English), and the count when only a bead moves;
  - the reading row (digits and badges) and the rod-name row are hidden from VoiceOver. Each rod of the soroban already reads its value, and the caption carries the numbers.

`IntroScreen` takes the walkthrough as a component prop (`walkthrough: ComponentType<{ finishLabel; onFinish }>`). It also holds the once-only finish guard, which now lives in one place for both walkthroughs. `/divide-intro` renders `DivideWalkthrough` and `/multiply-intro` renders `MethodIntro`. `MethodIntro` loses its ÷-only guess page (`IntroTexts.guess`).

## 5. The × walkthrough's ◀

`MethodIntro`'s bottom button becomes a row: an outline back button reading 「もどる」 on the left (hidden on the first page), then つぎへ or the finish button. Going back to a group page replays that group. Going back to any other page stops the replay, so the soroban shows that page's start again.

## 6. Testing

- **`divisionWalk.test.ts`:**
  - the 1692 ÷ 36 walk step by step (kinds, numbers, marks, focus, answer boxes, bead steps);
  - the invariants in §2, over the problem sets above;
  - a capped guess, a 0 digit (202032 ÷ 976), a fix down to 0 (17702 ÷ 167) and a 1けた problem;
  - `walkFrames` for 1692 ÷ 36: 23 frames, with the steps' starts.
- **Strings:** every row of the §3 table in Japanese, plus the other cases, in both catalogues.
- **`DivideWalkthrough.test.tsx`:**
  - the first frame;
  - ▶ through the bead frames of a step (the caption stays; the soroban changes);
  - ◀ back across a step boundary;
  - the stuck and fix captions;
  - the answer boxes (5? then 4? then 4);
  - the divisor underline;
  - the last frame's finish button, which calls onFinish.
- **Route tests** (`divide-intro-screen`, `multiply-intro-screen`) walk to the end with the new controls, and finishing twice saves once.
- **`MethodIntro` tests:** the ÷ cases go, and ◀ gets tests (back to a group page replays it; back to the method page restores its soroban; hidden on the first page).
- **On the simulator:** the whole walkthrough on an iPhone 17 Pro, and the note reachable on a short phone.

## 7. Out of scope

Guess-and-fix in the rounds' 手順を見る, chunk and bar pages, other example problems, and 帰除法.
