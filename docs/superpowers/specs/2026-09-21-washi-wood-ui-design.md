# learning-abacus — 和紙と木 UI redesign

Date: 2026-09-21
Status: Approved design, pre-implementation

## 1. Goal and constraints

Give the app a real visual design. Today every screen is an unstyled `<View>`.
Text runs under the status bar and Dynamic Island, nothing has padding, and
buttons are bare `<Text>` inside a `Pressable`. The answer `TextInput` has no
style and no autofocus, so on the session screen it is invisible, and the
learner has to find and tap it before a keyboard appears. The soroban is the
only styled element.

Decisions made with the user, in order:

- **Feel: calm and traditional.** The learner is an adult or teen studying
  alone. Warm paper, a real-looking wooden soroban as the hero element,
  restrained colour, Japanese typography.
- **Direction A, 和紙と木 (washi and wood).** Paper background, a walnut
  frame with dark lacquered beads, Mincho headings, and a single vermilion
  (朱) accent used the way a hanko seal is.
- **A built-in keypad**, not the iOS number pad. The soroban stays full size,
  the layout never jumps, and こたえる is a key on the pad.
- **A home screen** in front of the session, not a tab bar and not
  straight-into-session.
- **Light only for now.** Every colour lives in one theme file, so a dark
  "lacquer" variant can be added later without touching screens.
- **A hand-rolled theme and a small component kit.** No styling library. The
  only new dependency is `react-native-svg`, for the bead shape.

The approved mockups are kept next to this file in
`2026-09-21-washi-wood-ui-mockups/`. They are fragments written for the
brainstorming companion's frame, so their page chrome is unstyled when opened
on their own, but each phone mockup carries its own colours and renders
correctly. `session-states.html` and `other-screens.html` are the reference
for the final screens.

This is a presentation change. The domain layer (`src/domain/`) is not
touched: no scheduling, fluency, fade or session-planning rule changes.

## 2. What already exists

- **Routes:** `app/index.tsx` (Today) plans and runs the session on mount.
  `app/tutorial.tsx` wraps `ReadingDrill`. `app/progress.tsx` and
  `app/settings.tsx` are reached by `<Link>`s above the soroban and return by
  a "今日にもどる" link. `_layout.tsx` is a header-less `Stack`.
- **`SessionRunner`** owns the block/queue state machine, attempt timing, the
  demonstration line (F0), the correction line (F0–F1), and the close summary.
- **`Abacus` → `FadeLayer` → `Rod` → `Bead`.** The fade layer wraps the rods
  *and* the beam. `Rod` renders every bead in a fixed slot and shows value by
  colour (active dark, inactive light). Beads are `Pressable` buttons wired to
  an `onBeadPress` that nothing outside `src/ui/abacus/` uses.
- **`AtomGrid`** renders 180 cells in one flat wrap, in `ATOMS` order.
- **i18n:** `useStrings()` returns the `ja` or `en` catalog. `Strings` is
  `typeof ja`, and `catalogs.test.ts` checks key parity and arity.

## 3. Visual system

### 3.1 Tokens (`src/ui/theme.ts`)

| Token | Value | Use |
|---|---|---|
| `paper` | `#F4EEE2` | screen background |
| `card` | `#FBF7EF` | cards, keypad keys |
| `cardLine` | `#E4D8C3` | card borders |
| `soft` | `#EAE1D0` | instruction and demonstration panels |
| `track` | `#E2D8C6` | unfilled progress, dividers |
| `ink` | `#2A2320` | primary text |
| `muted` | `#7A6D61` | secondary text |
| `accent` | `#B5412C` | vermilion: primary buttons, seals, corrections |
| `accentShadow` | `#8E3322` | 1.5–2pt bottom edge under accent buttons |
| `keyEdge` | `#D6C8B0` | 2pt bottom edge under keypad keys |
| `shadow` | `#3C2314` | soroban and segmented-control drop shadows |
| `onAccent` | `#FFF8F0` | text on accent |
| `frameTop` / `frameBottom` | `#6E4A2F` / `#4E3220` | soroban frame |
| `deck` | `#EFE3CC` | soroban interior |
| `rod` | `#9C7A55` | rod line |
| `beam` | `#4A2F1C` | beam (梁) |
| `beadHighlight` / `bead` / `beadShade` | `#6B4028` / `#3A2014` / `#24130B` | bead gradient stops |
| `cell.unseen` / `learning` / `reflex` / `mental` | `#E6DCCB` / `#E0BE7E` / `#B8743F` / `#4E3220` | atom map |

The atom-map colours differ only in lightness, getting darker as a move is
learned, like wood deepening under lacquer. They stay readable with any form
of colour blindness.

**Type.** Headings, prompts, numbers and keypad digits use Hiragino Mincho
(`HiraMinProN-W6`), which ships with iOS, so there are no font files to load.
Body text uses the system font (Hiragino Sans for Japanese). Sizes:
display 28–30, prompt 28, body 14–15, caption 11–12.

**Spacing and shape.** 20pt screen gutter. Corner radius 14 for cards and
primary buttons, 12 for keys, 10 for inline panels. Spacing steps
4/8/12/16/20/24.

### 3.2 Component kit (`src/ui/kit/`)

- **`Screen`**: safe-area insets (`react-native-safe-area-context`, which
  expo-router already provides), the paper background, and the 20pt gutter.
  Every route renders inside one.
- **`Button`**: `primary` (solid vermilion) and `outline` (vermilion
  border). Both are full-width with a 54pt tap target.
- **`Card`**: the paper card surface.
- **`Seal`**: the round vermilion hanko. It can be `empty` (dashed ring),
  `outline`, or `stamped` (filled), and it takes short text.
- **`BackLink`**: "‹ 今日" at the top left of pushed screens.
- **`SegmentedControl`**: used by the language choice.
- **`Icon` / `IconButton`**: five outline icons (grid, gear, close, back,
  delete), drawn with `react-native-svg` after Feather's shapes. No icon font
  is added.

## 4. Screens and flow

### 4.1 Routes

| Route | Screen | Notes |
|---|---|---|
| `/` | Home | Redirects to `/tutorial` until the tutorial is done, as today |
| `/session` | **new**: the five-minute session | Full-screen, swipe-back disabled |
| `/tutorial` | Reading drill | Unchanged route, restyled |
| `/progress` | Progress | Pushed, `BackLink` |
| `/settings` | Settings | Pushed, `BackLink` |

The session moves out of `app/index.tsx` into `app/session.tsx`. The plan is
still computed once per mount, so it is now computed when the learner taps
はじめる. The session clock starts then, and no longer runs while someone is
looking at the home screen.

`_layout.tsx` sets the `Stack` content background to `paper`, so no white
flashes between screens, and disables the swipe-back gesture on `/session`.
`app.json` changes `userInterfaceStyle` to `light` and the splash background
from Expo's default blue to `paper`. The status bar is dark.

### 4.2 Home (`/`)

From the top:

- Two icon buttons at the top right for 進捗 and 設定. Their accessibility
  labels are the existing `navProgress` and `navSettings`. The mockup's date
  line is dropped: it would need locale-aware date formatting and is only
  decoration.
- The title 今日の五分.
- A **days seal** showing `daysPracticed`, next to "練習 N日間" and a status
  line:
  - It is `empty` (dashed) when `daysPracticed` is 0.
  - It is `outline` with 今日の練習はまだです when the learner hasn't
    practised today.
  - It is `stamped` with 今日は練習しました and またあした。 when they have.
  "Practised today" means `progress.lastSessionDay === dayKey(now)`, the
  same rule `markDayPracticed` already uses, so nothing new is stored. `now`
  is captured once at mount, the same way `Today` captures `startedAt`.
- A **plan bar**: three segments sized 45 : 120 : 90 and labelled
  準備 / 集中 / 暗算. It shows the fixed shape of every session. The
  mockups also drew a fourth まとめ segment. It is dropped because the close
  block is a summary screen that waits for おわる, not a timed stretch, so a
  bar segment for it would never fill.
- A **map preview card** (暗算できる動き, N / 180) showing the same two
  grids as the Progress screen, shrunk and without labels. Tapping it opens
  Progress.
- At the bottom, **はじめる (5分)** as a `primary` button. After today's
  practice it becomes **もう一度練習する** as an `outline` button. Practising
  again is on offer but never pushed. Both push `/session`.

### 4.3 Session (`/session`)

- **Top bar.** An ✕ at the left, a three-segment time track, and the
  current block's label on the right. The track fills linearly with time from
  the session start across the 255s of practice (warm-up, focus, fade rep).
  Segment boundaries follow `BLOCK_SECONDS`. It animates with React Native's
  `Animated`, not by re-rendering every second.
- **Soroban** (section 5), then the **prompt** in Mincho at 28pt.
- **Demonstration** (F0, unchanged logic): a `soft` panel under the prompt.
- **Correction card** (F0–F1 after a miss, unchanged logic). The runner
  re-queues a missed item at the back of the block, so the correction appears
  under the *next* question. The card therefore names the problem it
  corrects: a vermilion-edged card with さっきの問題 plus that problem's
  prompt, then こたえは N in Mincho, then the coaching line. It stays until
  the next answer, as the current correction text does. To build the card,
  the runner stores the missed atom and its expected answer instead of a
  finished string. When and whether a correction appears doesn't change.
- **Correct answer.** The next question appears immediately, as now. A
  faint vermilion 〇 fades out beside the answer line over about 600ms. It
  never blocks input or delays anything, so the latency the fluency model
  records is unchanged. VoiceOver announces 正解.
- **Answer pad** (section 6), with こたえる as its submit key.
- **✕** opens a native confirmation: 練習をやめますか？ /
  ここまでの答えは記録されています。 with つづける and やめる. やめる
  calls `flush()` and returns home. Answers already given stay recorded,
  because `attempt()` has already applied them. If at least one answer was
  given, the day counts as practised, which is the existing
  `markDayPracticed` behaviour.
- **Close block.** A large `stamped` seal reading 済 (Done in English) settles
  in with a short scale-and-fade, followed by 今日の練習おわり and the existing
  result line. おわる is a `primary` button. Pressing it calls `onFinish` as
  today, and the session screen then returns home. The spec's "atoms
  mastered" and "tomorrow's preview" are still not built. They are out of
  scope here.

### 4.4 Reading drill (`/tutorial`)

A そろばんの読み方 heading with ten progress dots. The dots carry the
existing `readingIndex` string as their accessibility label. Below that: the
instruction in a `soft` panel, a single-rod soroban, the prompt, the
feedback (a vermilion-edged card on a miss, and the same rod stays, as now),
and the answer pad with たしかめる as its submit key.

### 4.5 Progress (`/progress`)

`BackLink`, the heading 進捗, the existing summary sentence displayed large,
and a four-swatch legend (未学習 / 学習中 / 即答 / 暗算, using the existing
cell-state names). Below that are **two maps side by side**: たし算 and
ひき算. Each is a 10 × 9 grid with **rows = the rod's current value 0–9** and
**columns = the operand 1–9**, with axis numbers and a one-line caption. Every
atom has one fixed cell, so the technique regions become visible. The direct
moves fill in first, then the 5- and 10-complement areas. Cell `testID`s
(`atom-cell-<id>`) and screen-reader labels (`cellLabel`) are unchanged.

### 4.6 Settings (`/settings`)

`BackLink`, then the heading 設定. A card holds two rows: the existing
`daysPracticed` sentence (練習 N日間), and 言語 with a `SegmentedControl` of
the untranslated `LOCALE_NAMES`. The mockup split the first row into a
label and a value. Keeping the existing sentence means the locale tests
that read it keep passing, with no new strings. Reset stays last on the screen. It is an `outline` button
(すべての進捗を消す) that, once armed, becomes a `primary` button
(本当にすべての進捗を消しますか？). The two-press guard and its testIDs are
unchanged.

## 5. The soroban

**Value by position.** A bead counts when it touches the beam. That is how
a real soroban works, and it's what the reading drill's own instruction says
(梁につけた珠だけを数えます). An active heaven bead sits against the beam. An
active earth bead is pushed up against it, and inactive earth beads rest at
the bottom. All beads share one colour. Today's rendering, which keeps beads
in fixed slots and shows value by colour, contradicts the instruction and is
replaced. A small dot on the beam marks the ones rod (定位点).

**Bead shape.** A six-sided bicone silhouette (the soroban bead seen side-on),
drawn with `react-native-svg` as a `Polygon` filled with a vertical
`LinearGradient` (`beadHighlight` → `bead` → `beadShade`). Beads are not
interactive in Phase 1 (typed answers only), so the `Pressable` wrappers and
the unused `onBeadPress` prop are removed. That also stops VoiceOver from
announcing five unlabelled buttons per rod. The rod keeps its
`accessibilityValue`.

**Layering and fade.** `Abacus` draws two stacked layers with identical
geometry, taken from shared constants:

1. A **static layer**: the frame, deck, rod lines, beam and unit dot.
2. The **bead layer**, wrapped in `FadeLayer`.

Only the beads fade. Today the fade layer also wraps the rods, so F5 (frame)
shows an empty rectangle with nothing to imagine beads on. Now it shows the
wooden frame with bare rods. The spec's rule still holds: visibility is one
prop driving one component. `FadeLayer`, `BEAD_OPACITY` and `showsFrame` are
unchanged. At F6 (hidden) neither layer is drawn, but the space stays
reserved, so the prompt and keypad don't move.

Rendering by fade level: solid (F0–F2), dim (F3), ghost (F4), frame (F5),
hidden (F6), exactly as `visualForFade` defines them.

## 6. The answer pad (`src/ui/answer/AnswerPad.tsx`)

A controlled component with `value`, `onChange`, `onSubmit`, `submitLabel`
and `submitTestID`. It shows:

- a **readout** of the typed value (Mincho, with a vermilion underline and
  `accessibilityLiveRegion`), and
- a **3 × 4 keypad**: 1–9, then ⌫, 0, and the submit key.

Rules:

- At most two digits, since the largest answer is 18.
- Typing a digit over a lone "0" replaces it, so "05" can't happen.
- ⌫ removes the last digit.
- The submit key is shown muted and does nothing while the value is empty.
  This matches the existing `parseAnswer` rule that a blank field is not an
  answer.

Key testIDs are `key-0` to `key-9` and `key-delete`. The submit key keeps the
caller's existing testID (`submit`, `reading-submit`). Every key has
`accessibilityRole="button"`, and ⌫ has a label.

`SessionRunner` and `ReadingDrill` replace their `TextInput`s with the pad.
They keep their answer state and `submit()` logic unchanged.

## 7. Strings

New keys, added to both catalogs:

| Key | ja | en |
|---|---|---|
| `homeTitle` | 今日の五分 | Today's five minutes |
| `start` | はじめる | Start |
| `startMinutes` | 5分 | 5 min |
| `notYetToday` | 今日の練習はまだです | Not practised yet today |
| `practisedToday` | 今日は練習しました | You practised today |
| `seeYouTomorrow` | またあした。 | See you tomorrow. |
| `practiseAgain` | もう一度練習する | Practise again |
| `mapPreviewTitle` | 暗算できる動き | Moves you can do mentally |
| `blockLabel(kind)` | 準備 / 集中 / 暗算 / まとめ | Warm-up / Focus / Fade / Close |
| `previousProblem` | さっきの問題 | Previous problem |
| `correctionAnswer(n)` | こたえは n | The answer is n |
| `correct` | 正解 | Correct |
| `quitLabel` | 練習をやめる | Stop practice |
| `quitTitle` | 練習をやめますか？ | Stop practising? |
| `quitBody` | ここまでの答えは記録されています。 | Your answers so far are saved. |
| `quitStop` / `quitContinue` | やめる / つづける | Stop / Keep going |
| `sealDone` | 済 | Done |
| `sealDays(n)` | n日 | n day / n days |
| `readingTitle` | そろばんの読み方 | Reading the soroban |
| `mapAdd` / `mapSub` | たし算 / ひき算 | Addition / Subtraction |
| `mapAxis` | 縦：いまのけたの数（0〜9）　横：たす数・ひく数（1〜9） | Rows: the rod's value (0–9) · Columns: the number added or taken away (1–9) |
| `back` | 今日 | Today |
| `deleteKey` | 1文字消す | Delete |
| `cellStateName(state)` | 未学習 / 学習中 / 即答 / 暗算 | unseen / learning / reflex / mental |

`correction` is replaced by `correctionAnswer` plus the existing `coaching`,
and `navToday` is replaced by `back`. Both old keys are removed once they
have no users. `readingIndex`, `navProgress` and `navSettings` stay, as
accessibility labels and screen titles.

## 8. Testing

Domain tests are untouched. The whole redesign sits in `src/ui/`, `app/` and
`src/i18n/`.

**Updated tests**

- The answer helpers in `SessionRunner.test.tsx`,
  `SessionRunner.integration.test.tsx`, `ReadingDrill.test.tsx` and
  `today-session.test.tsx` press `key-*` and then submit, instead of
  `changeText`.
- The correction assertions read the card's answer and coaching lines.
- `today-session.test.tsx` becomes a Home test (see below), and the session
  behaviour moves to a `/session` screen test.
- The `link-today` assertions in the Progress and Settings tests follow
  `BackLink`, which keeps that testID.
- Screens now render inside `Screen`, which reads safe-area insets. Tests use
  the mock that `react-native-safe-area-context` ships in its `jest/`
  directory, installed once in `jest.setup.js`. In the app, expo-router
  already provides the `SafeAreaProvider`.

**New tests**

- **AnswerPad:** digits append; at most two digits; replacing a lone 0; ⌫;
  submit is a no-op when empty; submit reports the value.
- **Abacus:** an active heaven bead sits at the beam and an inactive one
  away from it; active earth beads sit at the beam; the static layer is
  present at F5 while beads are at opacity 0; F6 keeps its layout box; rods
  keep their `accessibilityValue`; beads are not buttons.
- **AtomGrid:** 180 cells; an atom lands in its (rod value, operand) cell
  for each direction; the compact variant renders the same states.
- **Home:** the hydrating state; redirect to `/tutorial`; the three seal
  states driven by `daysPracticed` and `lastSessionDay`; はじめる and
  もう一度練習する push `/session`; the icons and map card go to their
  screens.
- **Session screen:** ✕ confirms through `Alert` (mocked), and やめる
  flushes and navigates home; finishing navigates home.
- **Catalogs:** the existing parity and arity tests cover the new keys
  automatically. Add value checks for `sealDays` pluralisation in English
  and for `blockLabel`.
- **react-native-svg** is replaced in Jest by plain Views that keep their
  props (`jest.setup.js`). Tests check layout and props, never the drawing.

**Visual verification.** Run the app in the iOS Simulator and screenshot
every screen and state in sections 4 and 5 (reading drill right and wrong,
home not-yet and done, session with demo, with correction, and at each fade
level, the close block, Progress, and Settings unarmed and armed). Compare
them against the mockups. `npm test`, `npm run typecheck` and `npm run lint`
must pass.

## 9. Out of scope

- A dark "lacquer" theme (the tokens are shaped for it, but it isn't built).
- Animating beads between problems, bead dragging, haptics.
- A new app icon, and iPad layouts (`supportsTablet` is false).
- The close block's "atoms mastered" and "tomorrow's preview" from the
  curriculum spec, and any extra-block offer beyond もう一度練習する.

**Known issue, not fixed here.** From stage 3 onward, a borrowing
subtraction atom such as 3−5 is shown as 3 on the ones rod with 0 on the
tens rod, and `SessionRunner` expects `rodValue − operand` (−2). Neither the
old iOS number pad nor the new keypad can enter a minus sign. The fix, which
is to show 1 on the tens rod so the problem reads 13−5 = 8, belongs to the
session logic and needs its own change.
