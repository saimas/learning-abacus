# learning-abacus — Home as a menu of operations, and a word after the flash

Date: 2026-10-07
Status: Approved design (owner: "Yes, go ahead and push to TestFlight").

## 1. Why, and what the owner chose

The owner (2026-10-07), with a screenshot of Home: "We better improve this home page. It is hard to see the menu as the contents grows. … Maybe better to have menu buttons for each operation? Then we can show フラッシュ暗算 too." With six rows (＋ − × ÷ ± フ) under the seals and the rank, Home's 6 × 3 grid pushes the やりかた tiles below the fold, and every new kind makes it worse.

The owner chose **operation buttons** (over tabs above one row of cells, and over a slimmer header on the same grid).

The same day the owner reported that こたえる and もどす "did not work" on a フラッシュ暗算 problem. They work: once the flash ends the soroban already holds the first four numbers' total, the learner adds the fifth on the beads, and こたえる stays off until a bead moves. Nothing on screen said so (only VoiceOver hears 「こたえてください」). The owner had not moved the beads. §4 adds a visible line.

## 2. Home

- **Top:** the days-practised seal and the rank badge, unchanged.
- **「練習」 (en "Practice"):** six large buttons, two per row: ＋ たし算, − ひき算, × かけ算, ÷ わり算, ± 見取算, フ フラッシュ暗算 (`OPERATIONS` order). Each shows the operation's symbol, its name, and how far the learner has got: 「レベル N」 with N the highest level among its three sizes, or 「まだ」 if none has been played. It is tinted by the most advanced stage among its sizes, in the grid cells' colours (`cellColors`).
- **Gone from Home:** the 6 × 3 grid and the やりかた row (both move into each operation's page). Home fits on one screen however many kinds are added.
- Tapping a button opens that operation's page. VoiceOver reads a button as 「たし算、レベル 4」 / 「見取算、まだ」 (en "Add, level 4" / "Columns, not yet").

## 3. An operation's page (`app/practice/[op].tsx`)

- **Title:** the operation's name (`OP_NAME`), with a back link to Home (as the やりかた page has).
- **Three cards:** 1けた, 2けた, 3けた. Each shows its stage and level as today's grid cell does (「珠で／レベル 2」, 「まだ」), its stage colour, and its best run when there is one (「ベスト 1,240点」). Tapping a card starts a run of that kind exactly as a grid cell does now (including a × or ÷ kind never played opening its lesson first).
- **「やりかた」:** for ＋ − × ÷, a button that opens that operation's existing lessons page (`/howto/[op]`). 見取算 and フラッシュ暗算 have no lessons, so no button.
- VoiceOver reads a card as the grid cell does, plus its best: 「1けたのたし算、珠で、レベル 2、ベスト 1,240点」.
- An unknown `op` in the URL goes back to Home.

## 4. A word after the flash

Once a フラッシュ暗算 problem's flash ends (naturally or by 手順を見る and とじる), until it is answered, the prompt's place shows one line: 「5つめの数を珠でたして、こたえましょう」 (en "Add the fifth number on the beads, then answer"). It sits in the box that holds the column's height, so nothing moves; it gives way to the column whenever the step panel is open, and is not shown once the answer is in (〇 or ✕). The VoiceOver announcement 「こたえてください」 stays as it is.

## 5. Unchanged

The progress screen (its full table), runs, lessons, the やりかた pages, settings, and every practice kind's behaviour. `PracticeTable` stays for the progress screen.

## 6. Testing

- Home: six operation buttons in order, each with its level or 「まだ」 and stage tint; no grid and no やりかた row; a tap opens `/practice/[op]`; the double-tap guard Home already has applies.
- Operation page: three cards with level, stage, best run; a tap starts `/round?kind=…`; the やりかた button only for ＋ − × ÷ and opening `/howto/[op]`; an unknown op redirects Home; the back link.
- Flash: the line appears after the flash ends, not while it plays, not with the panel open, not after answering.
- Simulator (iPhone 17 Pro and SE): Home fits on one screen; an operation page; a flash problem's line after the flash.

## 7. Out of scope

Reordering or hiding operations, per-operation statistics beyond level and best, a redesigned progress screen, lessons for 見取算 or フラッシュ暗算.
