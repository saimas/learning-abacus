# learning-abacus — Japanese UI and locale switching

Date: 2026-09-21
Status: Approved design, pre-implementation

## 1. Goal and constraints

Ship the app with a **Japanese UI by default** and let the learner switch to
English from the Settings screen.

The app teaches 暗算 from the 珠算 tradition, and every technique it drills
already has a settled Japanese name — 五の合成, 十の繰上 — that the curriculum
spec and the README both use. Shipping an English-only UI asks a Japanese
learner to read the app in one language and the subject in another. Japanese
is therefore the default, and English the alternative, not the reverse.

Fixed constraints, given by the user:

- **Japanese is the default.** A fresh install is Japanese with no device
  interrogation, no negotiation, and no new runtime dependency.
- **The toggle lives on the Settings screen.** ("mypage" in the request; the
  app has no such route, and Settings — days practised plus the guarded
  reset — is the screen meant.)
- **Everything is translated, including the teaching copy**, using real
  soroban vocabulary rather than translated English.

## 2. What already exists

There is no i18n layer, no `expo-localization`, and no locale anywhere in
storage. Every string is an English literal inside the component that renders
it. Four properties of the current code shape the design:

- **Copy reaches into the domain layer.** `explainMove` in
  `src/domain/explain.ts` builds the coaching line — `Add 8 = +10 − 2` — which
  is the pedagogical core the fade ladder rests on, not chrome.
- **English grammar is encoded as logic.** `breakdown()` in
  `src/ui/tutorial/ReadingDrill.tsx` branches on `earth === 1` to pluralise
  `bead`/`beads`. Japanese has no plural; a literal port would carry a dead
  branch forever.
- **Most strings interpolate.** `${n} days practised`,
  `Rod shows ${r}. Add ${n}.`, `Rod ${i} of ${n}`. The catalog needs
  parameterised functions, not constants.
- **`reset()` restores `emptyProgress()`.** Anything stored inside `Progress`
  is destroyed by the two-press reset on the Settings screen.

`src/domain/purity.test.ts` asserts that no domain file imports React, Expo,
storage, or UI. The domain layer is deliberately free of platform concerns,
and this design keeps it free of language for the same reason.

## 3. Architecture

### Module layout

| File | Contents |
|---|---|
| `src/i18n/locale.ts` | `Locale = 'ja' \| 'en'`, `DEFAULT_LOCALE = 'ja'` |
| `src/i18n/ja.ts` | the reference catalog |
| `src/i18n/en.ts` | typed `Strings = typeof ja` |
| `src/i18n/index.tsx` | `LocaleProvider`, `useStrings()`, `useLocale()` |
| `src/storage/localeStore.ts` | `loadLocale()`, `saveLocale()` |

**`ja` is the reference shape, not `en`.** `Strings = typeof ja` derives the
contract from the catalog that actually ships by default, so a missing or
wrong-arity key in `en` fails `tsc` rather than rendering a blank label. This
inverts the sibling `learning-vocabulary` project, and deliberately: there
English is the default, here it is not.

### The domain stays language-free

`explainMove` **moves out of `src/domain/explain.ts` into the catalogs.** The
domain keeps only what is language-independent, both unchanged:

- `describeSteps(atom)` → `'+10 − 2'` — arithmetic notation, not prose.
- `classify(atom)` → `'direct' | 'five' | 'ten' | 'both'` — already exported
  from `src/domain/atoms.ts` and already tested.

Each catalog builds its own sentence from those two facts plus
`atom.direction`. Japanese is therefore not a translation of the English
sentence; it is a different sentence assembled from the same structured
input. That is the whole point of translating the teaching copy at all.

### Storage and hydration

A separate AsyncStorage key, `learning-abacus/locale/v1`, independent of
`learning-abacus/progress/v1`. `localeStore` mirrors `progressStore`'s
never-throw discipline: an unreadable, absent, or corrupt value resolves to
`'ja'` rather than propagating an error.

The key is separate so that **"Reset all progress" does not change the
language.** Language is a device preference, not learning history; a learner
who wipes their progress to start over should not also be thrown out of the
UI language they chose. `emptyProgress()`, the `Progress` type, and
`progressStore`'s field-by-field validation are all untouched.

`LocaleProvider` mounts outermost in `app/_layout.tsx`, above
`ProgressProvider`, and renders `null` until the stored locale resolves. This
costs one blank frame at launch and guarantees the learner never sees a flash
of the wrong language — which matters precisely for the minority who
deliberately switched to English, and who would otherwise see Japanese flash
on every single launch.

## 4. The toggle

A two-option segmented control on the Settings screen, placed **above** the
reset control so the destructive action remains last on the screen.

```
言語 / Language
┌──────────┬──────────┐
│  日本語  │ English  │
└──────────┴──────────┘
```

- `testID`: `locale-ja`, `locale-en`
- `accessibilityRole="button"`, `accessibilityState={{ selected }}`
- Pressing writes through `saveLocale()` immediately; there is no confirm
  step and nothing to lose.

**The two option labels are never translated.** They read 日本語 and English
in both locales. A learner who mistaps into a language they cannot read must
be able to find the way back, and cannot if the buttons themselves flip. Only
the section heading above them is localised.

## 5. String inventory

Every user-visible string in the app. Functions take the interpolated values;
everything else is a constant.

### Shared

| Key | English | Japanese |
|---|---|---|
| `loading` | Loading… | 読み込み中… |
| `loadingProgress` | Loading your progress… | 進捗を読み込んでいます… |
| `daysPracticed(n)` | `${n} days practised` | `練習 ${n}日` |
| `navProgress` | Progress | 進捗 |
| `navSettings` | Settings | 設定 |
| `navToday` | Back to today | 今日にもどる |

### Settings

| Key | English | Japanese |
|---|---|---|
| `languageLabel` | Language | 言語 |
| `resetAll` | Reset all progress | すべての進捗を消す |
| `resetConfirm` | Really erase everything? | 本当にすべて消しますか？ |

### Session

| Key | English | Japanese |
|---|---|---|
| `sessionComplete` | Session complete | セッション完了 |
| `sessionResult(a, c)` | `${a} answered, ${c} correct` | `${a}問中 ${c}問正解` |
| `done` | Done | おわる |
| `answer` | Answer | こたえる |
| `prompt(atom)` | `Rod shows 7. Add 8.` | `けたは7。8をたす。` |
| `correction(e, atom)` | `It is ${e}. ${coaching(atom)}` | `こたえは${e}。${coaching(atom)}` |
| `coaching(atom)` | `Add 8 = +10 − 2` | `十の繰上：8をたす = +10 − 2` |

### Progress

| Key | English | Japanese |
|---|---|---|
| `atomSummary(m, total)` | `${m} of ${total} moves are mental` | `${total}手中 ${m}手が暗算` |
| `cellLabel(atomId, state)` | `7+8 reflex` | `7+8 反射` |

`cellLabel` is the per-cell `accessibilityLabel` on the 180-atom grid — copy
that only a VoiceOver user ever hears, and the one place where leaving English
in place would be invisible in review. `cellState()` keeps returning the
`CellState` identifier union; the catalog maps it to prose:

| `CellState` | English | Japanese |
|---|---|---|
| `unseen` | unseen | 未学習 |
| `learning` | learning | 学習中 |
| `reflex` | reflex | 反射 |
| `mental` | mental | 暗算 |

This is the same split as `coaching`: the logic yields an identifier, the
catalog yields the sentence.

### Tutorial

| Key | English | Japanese |
|---|---|---|
| `readingIndex(i, n)` | `Rod ${i} of ${n}` | `${n}問中 ${i}問目` |
| `readingPrompt` | What number is on this rod? | このけたはいくつですか？ |
| `check` | Check | たしかめる |
| `readingInstruction` | The heaven bead above the bar is worth 5. Each earth bead pushed up to the bar is worth 1. The rod reads as their total. | 天珠（上の珠）は5、一珠（下の珠）は1です。けたの数はその合計です。 |
| `readingFeedback(t)` | `Not quite. This rod shows ${t}: ${breakdown(t)}.` | `ちがいます。このけたは${t}です：${breakdown(t)}。` |

`breakdown` is internal to each catalog, not a public key:

| Case | English | Japanese |
|---|---|---|
| `0` | no beads pushed in | 珠がひとつも入っていません |
| `< 5` | `${e} earth bead(s)` | `一珠が${e}つ` |
| `e === 0` | the heaven bead on its own | 天珠だけ |
| otherwise | `the heaven bead and ${e} earth bead(s), 5 + ${e}` | `天珠と一珠が${e}つ、5 + ${e}` |

The Japanese cases carry no plural branch.

## 6. Technique names

`coaching` prefixes the move with its technique name, derived from
`classify(atom)` and `atom.direction`. The vocabulary is the curriculum
spec's own, unchanged:

| `classify` | add | sub |
|---|---|---|
| `direct` | *(no prefix)* | *(no prefix)* |
| `five` | 五の合成 | 五の分解 |
| `ten` | 十の繰上 | 十の繰下 |
| `both` | 十の繰上と五の分解 | 十の繰下と五の合成 |

`both` names both substitutions in the order performed: a `both` addition
carries ten and then resolves the inner subtraction with a five-complement
(`+10 − 5 + 1`), which is 繰上 followed by 五の分解. Subtraction mirrors it.

English keeps its current wording — `Add 8 = +10 − 2` — with no technique
prefix, so `en.coaching` ignores `classify` entirely and only `ja.coaching`
consults it. The English sentence is unchanged from today's `explainMove`;
only the file it lives in moves.

## 7. Testing

### New

- `src/i18n/catalogs.test.ts` — catalog parity beyond what types enforce, and
  `coaching()` across all four `classify` values in both directions in both
  locales (16 cases).
- `src/storage/localeStore.test.ts` — round-trip, absent key → `'ja'`,
  corrupt value → `'ja'`, write failure does not throw.
- `__tests__/settings-locale.test.tsx` — the toggle renders both options,
  pressing `locale-en` switches rendered copy, the choice is persisted, and
  **the locale survives `reset()`**.

### Changed

| File | Change |
|---|---|
| `__tests__/settings-reset.test.tsx:41` | `'12 days'` → the Japanese default |
| `src/ui/tutorial/ReadingDrill.test.tsx:25-27` | `'heaven'`/`'earth'` assertions → Japanese |
| `src/domain/explain.test.ts:50,54` | the two `explainMove` assertions move to the i18n tests |
| `src/ui/progress/AtomGrid.test.tsx:41` | `'0 of 180'` → the Japanese default |
| component tests | gain a `LocaleProvider` wrapper |

### Untouched

`cellState`'s four assertions (`AtomGrid.test.tsx:10-29`) — they assert the
`CellState` identifiers, which do not change — plus
`describeSteps`' six assertions, every 180-atom domain test, `classify`,
`decompose`, the fade ladder simulation, `progressStore`, and
`purity.test.ts` — which must still pass, and is the check that the domain
stayed language-free.

## 8. Out of scope

- `expo-localization` and any device-language detection. The default is a
  constant. No new runtime dependency is added.
- Any third locale, and any plural-rule or ICU message machinery.
- Per-screen or per-session language override.
- Translating README, the curriculum spec, or any other document.
- Japanese typography beyond the strings above — no vertical text, no
  furigana, no font change.
- The iOS display name in `app.json`. It is fixed at build time and cannot
  follow a runtime toggle, so it is a release decision, not part of this
  change.
- RTL layout.
