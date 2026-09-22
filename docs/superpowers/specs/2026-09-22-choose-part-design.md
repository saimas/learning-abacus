# learning-abacus — Choosing what to practise

Date: 2026-09-22
Status: Approved design, pre-implementation

## 1. Goal and decisions

After TestFlight build 7 the owner asked to choose what to practise: "right now i cannot get to the 集中 part until i finish all 準備. that is inconvenient."

Decisions made with the owner:
- **What is chosen is a part:** 準備, 集中 or 暗算. The full session (準備 → 集中 → 暗算 → まとめ) stays available and unchanged. Choosing individual moves is out of scope.
- **A part-only session gets the full practice time,** then まとめ. It ends sooner if the part runs out of moves; for example, 準備 is one pass through the moves that are due.
- **The start button asks.** Home looks the same, and its start button opens a chooser sheet (mockup option C). The full session becomes two taps: the start button, then ぜんぶ.

The approved mockup is `2026-09-22-choose-part-mockups/choose-part.html`.

## 2. What exists

- `selectSession(progress, now)` (`src/domain/session.ts`) builds the plan. Its blocks are:
  - warmup: up to 10 due moves, 45 s;
  - focus: today's new moves plus the weakest, 120 s, with a reserve of up to 4 more new moves that join as the learner becomes secure;
  - faderep: up to 6 fluent moves one fade level up, 90 s;
  - close: 30 s.

  `SESSION_SECONDS` is 285.
- `SessionRunner` plays any plan. It already handles a plan whose practice block is empty: the block is skipped and the learner goes straight to まとめ. It makes warm-up a single pass and only joins the reserve in a focus block.
- `app/session.tsx` builds the plan once, at mount, with `selectSession(progress, startedAt)`.
- Home (`app/index.tsx`) shows the start button as `<Link href="/session" asChild testID="start">`. The button reads はじめる 5分, or もう一度練習する once today's session is done.

## 3. Domain (pure, in `src/domain/session.ts`)

- `export type PracticePart = 'warmup' | 'focus' | 'faderep'`, and `export const PRACTICE_PARTS: readonly PracticePart[] = ['warmup', 'focus', 'faderep']`.
- `export function isPracticePart(value: unknown): value is PracticePart`.
- `export const PRACTICE_SECONDS = SESSION_SECONDS - BLOCK_SECONDS.close`, which is 255.
- `export function planForPart(plan: SessionPlan, part: PracticePart): SessionPlan` returns:
  - `blocks`: two blocks. The first is `{ kind: part, seconds: PRACTICE_SECONDS, items }`, where `items` are that block's items from `plan`. The second is `{ kind: 'close', seconds: BLOCK_SECONDS.close, items: [] }`.
  - `totalSeconds`: `SESSION_SECONDS`.
  - `reserve`: `plan.reserve` when `part === 'focus'`; left out otherwise.
- `selectSession` is unchanged.

## 4. The chooser (`src/ui/home/PartChooser.tsx`)

- It is a bottom sheet in a transparent React Native `Modal` over a dimmed Home, titled **なにを練習しますか**.
- It has four rows. Each row is a button with a name and a detail line:

  | Row | testID | Name | Detail | Opens |
  |---|---|---|---|---|
  | all | `choose-all` | ぜんぶ | 準備 → 集中 → 暗算・5分 | `/session` |
  | warmup | `choose-warmup` | 準備だけ | おさらい・Nつの動き | `/session?part=warmup` |
  | focus | `choose-focus` | 集中だけ | 新しい動きと苦手な動き | `/session?part=focus` |
  | faderep | `choose-faderep` | 暗算だけ | 珠を消す・Nつの動き | `/session?part=faderep` |

  - ぜんぶ is drawn as the primary (vermilion) row.
  - N is the number of moves that part would practise. It is the block's item count in a plan built with `selectSession(progress, Date.now())` at the moment the sheet opens.
- **A part with no moves** shows 今はありません, is drawn faded (like a disabled button) and cannot be pressed (`accessibilityState.disabled`). ぜんぶ is always enabled.
- Tapping the dimmed backdrop (`chooser-backdrop`) closes the sheet without starting anything (the Modal's `onRequestClose` does the same).
- **Choosing a row** closes the sheet and pushes the route.
- **Accessibility:** each row is `accessibilityRole="button"`, with the name and detail as its label.
- **Props:** `{ plan: SessionPlan | null, onChoose: (part: PracticePart | 'all') => void, onClose: () => void }`. The sheet is visible while `plan !== null`. Home owns the navigation.

**Home:**
- The start button stays a `Button` with `testID="start"` and the same labels.
- Its `onPress` builds the plan (`selectSession(progress, Date.now())`, in the handler, never during render) and opens the chooser with it.
- `onChoose` pushes `/session` or `/session?part=…`.

**Strings** (both catalogs):

| Key | ja | en |
|---|---|---|
| `chooseTitle` | なにを練習しますか | What would you like to practise? |
| `chooseAll` | ぜんぶ | Everything |
| `chooseAllDetail` | 準備 → 集中 → 暗算・5分 | Warm-up → Focus → Fade · 5 min |
| `chooseOnly(kind)` | `${blockLabel}だけ` (準備だけ …) | `${blockLabel} only` (Warm-up only …) |
| `chooseDetail(kind, n)` | warmup: `おさらい・${n}つの動き`; focus: `新しい動きと苦手な動き`; faderep: `珠を消す・${n}つの動き` | warmup: `Review · ${n} move(s)`; focus: `New and shaky moves`; faderep: `Fading the beads · ${n} move(s)` |
| `chooseEmpty` | 今はありません | Nothing right now |

English uses "move" for 1 and "moves" otherwise.

## 5. The session route (`app/session.tsx`)

- It reads the `part` search parameter with `useLocalSearchParams`.
- If `isPracticePart(part)`, the plan is `planForPart(selectSession(progress, startedAt), part)`. Otherwise, with no parameter or an unknown value, it is the full `selectSession(...)` plan, exactly as today.
- The plan is still built once, at mount.
- Everything after that is unchanged: the runner, answer recording, quitting, the summary, and the day counter. The time bar shows one segment, labelled with the part.
- The sheet's counts and the session's plan are built a moment apart. A move that falls due in between is simply included; this is harmless.

## 6. Testing

- **Domain:**
  - `planForPart` for each part: one practice block of `PRACTICE_SECONDS` holding exactly that block's items, then close;
  - the reserve kept only for focus;
  - an empty part giving an empty practice block;
  - `isPracticePart` accepting the three parts and rejecting `'close'`, `''`, `undefined` and anything else.
- **Chooser (component):**
  - four rows with the right names and details (counts from the plan);
  - an empty part disabled and reading 今はありません;
  - `onChoose` called with the row's part;
  - the backdrop calling `onClose`;
  - not rendered when `plan` is null.
- **Home:**
  - the start button opens the chooser (`part-chooser`);
  - choosing a row navigates to the right route (mock `router.push`).
  - Existing tests that read the start link's `href` are updated to go through the chooser.
- **Session screen:**
  - `part=focus` gives a runner whose only practice block is 集中 (block label 集中 on the first question), and the same for 準備 and 暗算 where they have moves;
  - an unknown `part` gives the full session.
- **Runner:** unchanged; its existing tests already cover single-block plans.
- **Catalogs:** parity covers the new keys; English singular and plural.
- **On device:**
  - a simulator check: open the chooser, pick 集中だけ and land on 集中, pick 準備だけ and see one pass then まとめ, check a disabled part, and close the sheet by tapping outside;
  - then TestFlight build 8.

## 7. Out of scope

- Choosing individual moves or technique families.
- Remembering the last choice, or making a part the default.
- Changing the full session or its timings.
