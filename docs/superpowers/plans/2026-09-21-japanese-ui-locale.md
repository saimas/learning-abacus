# Japanese UI and Locale Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the app with a Japanese UI by default and a 日本語/English toggle on the Settings screen.

**Architecture:** A new `src/i18n` module holds two catalogs, `ja` (the reference shape) and `en`, typed `Strings = typeof ja` so a missing English key fails `tsc`. `explainMove` moves out of `src/domain/explain.ts` into the catalogs, which build their own coaching sentence from `describeSteps()` and `classify()` — keeping the domain layer language-free, as `src/domain/purity.test.ts` requires. The chosen locale lives under its own AsyncStorage key so `reset()` cannot touch it.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), React 19, React Native 0.86 / Expo 57, expo-router, `@react-native-async-storage/async-storage`, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-21-japanese-ui-locale-design.md`

## Global Constraints

Every task's requirements implicitly include these.

- **Japanese is the default.** `DEFAULT_LOCALE = 'ja'`. No device-language detection.
- **No new runtime dependency.** `package.json` `dependencies` must be unchanged at the end of this plan. In particular, do not add `expo-localization`.
- **The domain layer stays language-free.** No file under `src/domain/` may contain Japanese or English prose after Task 6. `npm test` includes `src/domain/purity.test.ts`, which must keep passing.
- **`ja` is the reference shape.** `export type Strings = typeof ja` lives in `src/i18n/ja.ts`; `en` is declared `export const en: Strings`. Never the reverse.
- **The toggle labels are never translated.** They read 日本語 and English in both locales.
- **Locale storage key is `learning-abacus/locale/v1`**, separate from `learning-abacus/progress/v1`. `reset()` must not change the locale.
- **English copy keeps British spelling** (`practised`), matching the existing strings.
- **Import alias:** `@/*` maps to `./src/*`. `app/` files import from `@/…`; files inside `src/` may use relative imports for siblings.
- **Verification commands:** `npm test`, `npm run typecheck` (runs `tsc --noEmit` against both tsconfigs), `npm run lint`.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/i18n/locale.ts` | The `Locale` union, the default, the runtime guard, the untranslated endonyms |
| `src/i18n/ja.ts` | Japanese catalog + `Strings` type |
| `src/i18n/en.ts` | English catalog, typed against `Strings` |
| `src/i18n/index.tsx` | `LocaleProvider`, `useStrings()`, `useLocale()` |
| `src/i18n/catalogs.test.ts` | Catalog parity and `coaching()` coverage |
| `src/storage/localeStore.ts` | `loadLocale()` / `saveLocale()` |
| `src/storage/localeStore.test.ts` | Round-trip and fallback behaviour |
| `__tests__/settings-locale.test.tsx` | The toggle, end to end |

**Modified**

| File | Change |
|---|---|
| `src/domain/explain.ts` | `explainMove` deleted; `describeSteps` untouched |
| `src/domain/explain.test.ts` | the `explainMove` describe block removed |
| `app/_layout.tsx` | mount `LocaleProvider` |
| `app/index.tsx`, `app/progress.tsx`, `app/settings.tsx` | render from the catalog |
| `src/ui/session/SessionRunner.tsx` | render from the catalog |
| `src/ui/tutorial/ReadingDrill.tsx` | render from the catalog; `breakdown()` moves out |
| `src/ui/progress/AtomGrid.tsx` | render from the catalog |
| `__tests__/settings-reset.test.tsx`, `src/ui/tutorial/ReadingDrill.test.tsx`, `src/ui/progress/AtomGrid.test.tsx` | assertions follow the Japanese default |

**A note on test wrappers.** The spec (§7) anticipated that every component test would need a `LocaleProvider` wrapper. It does not: `StringsContext` is created with the Japanese catalog as its *default context value*, so a component rendered with no provider gets the shipped default. Existing tests therefore only need their expected strings changed, never their structure. Only `__tests__/settings-locale.test.tsx`, which exercises switching, mounts a real provider.

**Transient duplication.** Task 2 adds `coaching()` to the catalogs while `explainMove` still exists in the domain. That duplication is deliberate and lasts until Task 6 deletes the domain copy — it is what keeps every intermediate commit green. Do not delete `explainMove` early.

---

### Task 1: Locale primitives and storage

**Files:**
- Create: `src/i18n/locale.ts`
- Create: `src/storage/localeStore.ts`
- Test: `src/storage/localeStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Locale = 'ja' | 'en'`; `DEFAULT_LOCALE: Locale`; `LOCALES: readonly Locale[]`; `LOCALE_NAMES: Record<Locale, string>`; `isLocale(value: unknown): value is Locale`; `LOCALE_STORAGE_KEY: string`; `loadLocale(): Promise<Locale>`; `saveLocale(locale: Locale): Promise<void>`.

- [ ] **Step 1: Write `src/i18n/locale.ts`**

No test of its own — it is data, exercised by every task that follows.

```ts
export type Locale = 'ja' | 'en'

// Japanese first: it is the default, and the toggle renders in this order.
export const LOCALES: readonly Locale[] = ['ja', 'en']

export const DEFAULT_LOCALE: Locale = 'ja'

// Endonyms, deliberately never translated. A learner who mistaps into a
// language they cannot read has to be able to find the way back, and cannot
// if the buttons themselves flip.
export const LOCALE_NAMES: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
}

// Narrows whatever came back out of storage. A stored 'fr' — or a null, or a
// number — resolves to the default rather than being trusted into the union.
export function isLocale(value: unknown): value is Locale {
  return value === 'ja' || value === 'en'
}
```

- [ ] **Step 2: Write the failing storage test**

Create `src/storage/localeStore.test.ts`. This mirrors the mocking style of `src/storage/progressStore.test.ts`.

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LOCALE_STORAGE_KEY, loadLocale, saveLocale } from './localeStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('loadLocale', () => {
  it('defaults to Japanese when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null)
    expect(await loadLocale()).toBe('ja')
    expect(mockGetItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY)
  })

  it('returns a stored locale', async () => {
    mockGetItem.mockResolvedValue('en')
    expect(await loadLocale()).toBe('en')
  })

  it('defaults to Japanese on a value outside the union', async () => {
    mockGetItem.mockResolvedValue('fr')
    expect(await loadLocale()).toBe('ja')
  })

  it('defaults to Japanese when the read throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'))
    expect(await loadLocale()).toBe('ja')
  })

  it('reads a key of its own, not the progress key', async () => {
    mockGetItem.mockResolvedValue(null)
    await loadLocale()
    expect(mockGetItem).toHaveBeenCalledWith('learning-abacus/locale/v1')
  })
})

describe('saveLocale', () => {
  it('writes the locale under its own key', async () => {
    mockSetItem.mockResolvedValue()
    await saveLocale('en')
    expect(mockSetItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en')
  })

  it('does not throw when the write fails', async () => {
    mockSetItem.mockRejectedValue(new Error('disk full'))
    await expect(saveLocale('en')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/storage/localeStore.test.ts`
Expected: FAIL — `Cannot find module './localeStore'`.

- [ ] **Step 4: Write `src/storage/localeStore.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale'

// Deliberately not the progress key. The locale is a device preference, not
// learning history, and must survive the reset on the Settings screen.
export const LOCALE_STORAGE_KEY = 'learning-abacus/locale/v1'

export async function loadLocale(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(raw) ? raw : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export async function saveLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // A failed write costs the learner one re-toggle; never crash over it.
  }
}
```

The value is stored as a bare string rather than JSON: the union is two known
tokens, and `isLocale` already rejects anything else, so `JSON.parse` would
only add a failure mode.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/storage/localeStore.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. Nothing else in the app imports these files yet.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locale.ts src/storage/localeStore.ts src/storage/localeStore.test.ts
git commit -m "feat: store a UI locale, defaulting to Japanese"
```

---

### Task 2: The catalogs

**Files:**
- Create: `src/i18n/ja.ts`
- Create: `src/i18n/en.ts`
- Test: `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes: `Locale`, `LOCALES` from Task 1. `classify`, `Atom`, `AtomClass` from `@/domain/atoms`. `describeSteps` from `@/domain/explain`. `CellState` from `@/ui/progress/AtomGrid` (type-only import; erased at compile time, so no runtime cycle).
- Produces: `ja`, `en`, and `type Strings = typeof ja`. Keys and signatures exactly as written in Step 1 below — later tasks call them by these names.

- [ ] **Step 1: Write the failing catalog test**

Create `src/i18n/catalogs.test.ts`.

```ts
import { ATOMS, atomId, classify, type Atom, type Direction } from '@/domain/atoms'
import { en } from './en'
import { ja } from './ja'
import { LOCALES } from './locale'

const CATALOGS = { ja, en }

// Same helper as src/domain/explain.test.ts, so the atoms here are built the
// way the domain's own tests build them.
function atom(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

describe('catalog parity', () => {
  it('covers every locale', () => {
    expect(Object.keys(CATALOGS).sort()).toEqual([...LOCALES].sort())
  })

  // `Strings = typeof ja` already makes a missing key a compile error. This
  // catches the case types cannot: a key present but of the wrong kind, or a
  // function that silently takes fewer arguments than its Japanese twin.
  it('gives every key the same kind and arity in both catalogs', () => {
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const left = ja[key]
      const right = en[key]
      expect(typeof right).toBe(typeof left)
      if (typeof left === 'function' && typeof right === 'function') {
        expect(right.length).toBe(left.length)
      }
    }
  })

  it('leaves no constant entry blank', () => {
    for (const catalog of Object.values(CATALOGS)) {
      for (const value of Object.values(catalog)) {
        if (typeof value === 'string') expect(value.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('coaching', () => {
  it('names the technique in Japanese for every class and direction', () => {
    // The six atoms are the ones src/domain/explain.test.ts already pins
    // describeSteps against, so only the Japanese wrapper is new here.
    expect(ja.coaching(atom(1, 3, 'add'))).toBe('3をたす = +3')
    expect(ja.coaching(atom(3, 4, 'add'))).toBe('五の合成：4をたす = +5 − 1')
    expect(ja.coaching(atom(7, 8, 'add'))).toBe('十の繰上：8をたす = +10 − 2')
    expect(ja.coaching(atom(6, 4, 'sub'))).toBe('五の分解：4をひく = −5 + 1')
    expect(ja.coaching(atom(7, 8, 'sub'))).toBe('十の繰下：8をひく = −10 + 2')
    expect(ja.coaching(atom(7, 6, 'add'))).toBe('十の繰上と五の分解：6をたす = +10 − 5 + 1')
    expect(ja.coaching(atom(2, 6, 'sub'))).toBe('十の繰下と五の合成：6をひく = −10 + 5 − 1')
  })

  it('keeps the English wording that explainMove had', () => {
    expect(en.coaching(atom(7, 8, 'add'))).toBe('Add 8 = +10 − 2')
    expect(en.coaching(atom(6, 4, 'sub'))).toBe('Subtract 4 = −5 + 1')
  })

  // Every one of the 180 atoms has to produce a sentence; a hole in the
  // TECHNIQUE table would otherwise only surface on the learner's screen.
  it('produces a non-empty sentence for all 180 atoms in both locales', () => {
    for (const a of ATOMS) {
      expect(ja.coaching(a).length).toBeGreaterThan(0)
      expect(en.coaching(a).length).toBeGreaterThan(0)
    }
  })

  it('prefixes a technique name for every class except direct', () => {
    for (const a of ATOMS) {
      const named = ja.coaching(a).includes('：')
      expect(named).toBe(classify(a) !== 'direct')
    }
  })
})

describe('breakdown, via readingFeedback', () => {
  it('reads a heaven-and-earth rod without a plural in Japanese', () => {
    expect(ja.readingFeedback(6)).toBe('ちがいます。このけたは6です：天珠と一珠が1つ、5 + 1。')
  })

  it('reads a bare heaven bead', () => {
    expect(ja.readingFeedback(5)).toContain('天珠だけ')
  })

  it('reads an empty rod', () => {
    expect(ja.readingFeedback(0)).toContain('珠がひとつも入っていません')
  })

  it('keeps the English singular and plural', () => {
    expect(en.readingFeedback(1)).toContain('1 earth bead.')
    expect(en.readingFeedback(3)).toContain('3 earth beads')
  })
})

describe('cellLabel', () => {
  it('translates the cell state', () => {
    expect(ja.cellLabel('7+8', 'mental')).toBe('7+8 暗算')
    expect(ja.cellLabel('7+8', 'unseen')).toBe('7+8 未学習')
    expect(en.cellLabel('7+8', 'mental')).toBe('7+8 mental')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/i18n/catalogs.test.ts`
Expected: FAIL — `Cannot find module './ja'`. Neither catalog exists yet; that
is the red phase, and it is why the test is written before them.

- [ ] **Step 3: Write `src/i18n/ja.ts`**

```ts
import { classify, type Atom, type AtomClass } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import type { CellState } from '@/ui/progress/AtomGrid'

// The curriculum spec's own vocabulary, not a translation of the English.
// `both` names the two substitutions in the order they are performed: a
// `both` addition carries ten and then resolves the inner subtraction with a
// five-complement (+10 − 5 + 1), which is 繰上 followed by 五の分解.
const TECHNIQUE: Record<AtomClass, { add: string; sub: string }> = {
  direct: { add: '', sub: '' },
  five: { add: '五の合成', sub: '五の分解' },
  ten: { add: '十の繰上', sub: '十の繰下' },
  both: { add: '十の繰上と五の分解', sub: '十の繰下と五の合成' },
}

const CELL_STATE: Record<CellState, string> = {
  unseen: '未学習',
  learning: '学習中',
  reflex: '反射',
  mental: '暗算',
}

// Declared as a function rather than inline on the object: `correction` calls
// it, and a member referencing `ja` from inside the initialiser of `ja` makes
// `typeof ja` circular, which TypeScript rejects.
function coaching(atom: Atom): string {
  const name = TECHNIQUE[classify(atom)][atom.direction === 'add' ? 'add' : 'sub']
  const verb = atom.direction === 'add' ? 'たす' : 'ひく'
  const move = `${atom.operand}を${verb} = ${describeSteps(atom)}`
  return name === '' ? move : `${name}：${move}`
}

// No plural branch — Japanese has none. The English catalog needs one.
function breakdown(value: number): string {
  const earth = value % 5
  if (value === 0) return '珠がひとつも入っていません'
  if (value < 5) return `一珠が${earth}つ`
  if (earth === 0) return '天珠だけ'
  return `天珠と一珠が${earth}つ、5 + ${earth}`
}

export const ja = {
  loading: '読み込み中…',
  loadingProgress: '進捗を読み込んでいます…',
  daysPracticed: (days: number) => `練習 ${days}日`,
  navProgress: '進捗',
  navSettings: '設定',
  navToday: '今日にもどる',

  languageLabel: '言語',
  resetAll: 'すべての進捗を消す',
  resetConfirm: '本当にすべて消しますか？',

  sessionComplete: 'セッション完了',
  sessionResult: (answered: number, correct: number) => `${answered}問中 ${correct}問正解`,
  done: 'おわる',
  answer: 'こたえる',
  prompt: (atom: Atom) =>
    `けたは${atom.rodValue}。${atom.operand}を${atom.direction === 'add' ? 'たす' : 'ひく'}。`,
  coaching,
  correction: (expected: number, atom: Atom) => `こたえは${expected}。${coaching(atom)}`,

  atomSummary: (mental: number, total: number) => `${total}手中 ${mental}手が暗算`,
  cellLabel: (atomId: string, state: CellState) => `${atomId} ${CELL_STATE[state]}`,

  readingIndex: (index: number, total: number) => `${total}問中 ${index}問目`,
  readingPrompt: 'このけたはいくつですか？',
  check: 'たしかめる',
  readingInstruction: '天珠（上の珠）は5、一珠（下の珠）は1です。けたの数はその合計です。',
  readingFeedback: (target: number) => `ちがいます。このけたは${target}です：${breakdown(target)}。`,
}

// The contract every catalog satisfies, derived from the catalog that ships
// by default rather than hand-written — so a missing or wrong-arity key in
// `en` fails `tsc` instead of rendering a blank label on a learner's device.
export type Strings = typeof ja
```

- [ ] **Step 4: Write `src/i18n/en.ts`**

The wording is carried over verbatim from the components it replaces, so this
task changes no English text anywhere in the app.

```ts
import type { Atom } from '@/domain/atoms'
import { describeSteps } from '@/domain/explain'
import type { CellState } from '@/ui/progress/AtomGrid'
import type { Strings } from './ja'

const CELL_STATE: Record<CellState, string> = {
  unseen: 'unseen',
  learning: 'learning',
  reflex: 'reflex',
  mental: 'mental',
}

// English names no technique: this is the wording `explainMove` has today,
// moved rather than rewritten. Only `ja.coaching` consults `classify`.
function coaching(atom: Atom): string {
  const verb = atom.direction === 'add' ? 'Add' : 'Subtract'
  return `${verb} ${atom.operand} = ${describeSteps(atom)}`
}

function breakdown(value: number): string {
  const earth = value % 5
  const beads = `${earth} earth bead${earth === 1 ? '' : 's'}`
  if (value === 0) return 'no beads pushed in'
  if (value < 5) return beads
  if (earth === 0) return 'the heaven bead on its own'
  return `the heaven bead and ${beads}, 5 + ${earth}`
}

export const en: Strings = {
  loading: 'Loading…',
  loadingProgress: 'Loading your progress…',
  daysPracticed: (days) => `${days} days practised`,
  navProgress: 'Progress',
  navSettings: 'Settings',
  navToday: 'Back to today',

  languageLabel: 'Language',
  resetAll: 'Reset all progress',
  resetConfirm: 'Really erase everything?',

  sessionComplete: 'Session complete',
  sessionResult: (answered, correct) => `${answered} answered, ${correct} correct`,
  done: 'Done',
  answer: 'Answer',
  prompt: (atom) =>
    `Rod shows ${atom.rodValue}. ${atom.direction === 'add' ? 'Add' : 'Subtract'} ${atom.operand}.`,
  coaching,
  correction: (expected, atom) => `It is ${expected}. ${coaching(atom)}`,

  atomSummary: (mental, total) => `${mental} of ${total} moves are mental`,
  cellLabel: (atomId, state) => `${atomId} ${CELL_STATE[state]}`,

  readingIndex: (index, total) => `Rod ${index} of ${total}`,
  readingPrompt: 'What number is on this rod?',
  check: 'Check',
  readingInstruction:
    'The heaven bead above the bar is worth 5. Each earth bead pushed up to the bar is worth 1. The rod reads as their total.',
  readingFeedback: (target) => `Not quite. This rod shows ${target}: ${breakdown(target)}.`,
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/i18n/catalogs.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. `explainMove` still exists in the domain and is still tested — that duplication is intentional until Task 6.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/ja.ts src/i18n/en.ts src/i18n/catalogs.test.ts
git commit -m "feat: add Japanese and English string catalogs"
```

---

### Task 3: The provider

**Files:**
- Create: `src/i18n/index.tsx`
- Modify: `app/_layout.tsx`
- Test: `src/i18n/index.test.tsx`

**Interfaces:**
- Consumes: `ja`, `en`, `Strings` (Task 2); `Locale`, `DEFAULT_LOCALE` (Task 1); `loadLocale`, `saveLocale` (Task 1).
- Produces: `LocaleProvider`, `useStrings(): Strings`, `useLocale(): { locale: Locale; setLocale: (next: Locale) => void }`, `CATALOGS: Record<Locale, Strings>`.

- [ ] **Step 1: Write the failing provider test**

Create `src/i18n/index.test.tsx`.

```tsx
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import * as localeStore from '@/storage/localeStore'
import { LocaleProvider, useLocale, useStrings } from './index'

jest.mock('@/storage/localeStore')

const mockLoad = localeStore.loadLocale as jest.MockedFunction<typeof localeStore.loadLocale>
const mockSave = localeStore.saveLocale as jest.MockedFunction<typeof localeStore.saveLocale>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue('ja')
  mockSave.mockResolvedValue()
})

function Probe() {
  const strings = useStrings()
  const { locale, setLocale } = useLocale()
  return (
    <>
      <Text testID="label">{strings.navSettings}</Text>
      <Text testID="locale">{locale}</Text>
      <Pressable testID="to-en" onPress={() => setLocale('en')}>
        <Text>switch</Text>
      </Pressable>
    </>
  )
}

describe('LocaleProvider', () => {
  it('renders nothing until the stored locale resolves', () => {
    // A promise that never settles, so the gate is observed rather than raced
    // against a microtask that may or may not have flushed.
    mockLoad.mockReturnValue(new Promise<never>(() => {}))
    const { queryByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(queryByTestId('label')).toBeNull()
  })

  it('renders the stored locale once resolved', async () => {
    mockLoad.mockResolvedValue('en')
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    await waitFor(() => expect(getByTestId('locale').props.children).toBe('en'))
    expect(getByTestId('label').props.children).toBe('Settings')
  })

  it('switches catalog and persists the choice', async () => {
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    await waitFor(() => expect(getByTestId('label').props.children).toBe('設定'))
    await act(async () => {
      fireEvent.press(getByTestId('to-en'))
    })
    expect(getByTestId('label').props.children).toBe('Settings')
    expect(mockSave).toHaveBeenCalledWith('en')
  })
})

describe('useStrings outside a provider', () => {
  it('falls back to the Japanese catalog instead of throwing', () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('label').props.children).toBe('設定')
    expect(getByTestId('locale').props.children).toBe('ja')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/i18n/index.test.tsx`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write `src/i18n/index.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadLocale, saveLocale } from '@/storage/localeStore'
import { en } from './en'
import { ja, type Strings } from './ja'
import { DEFAULT_LOCALE, type Locale } from './locale'

export const CATALOGS: Record<Locale, Strings> = { ja, en }

export type LocaleApi = { locale: Locale; setLocale: (next: Locale) => void }

// The default context value is the shipped catalog, not a thrown error: a
// component rendered outside the provider — which is every component unit
// test — renders the Japanese default rather than needing a wrapper.
const StringsContext = createContext<Strings>(CATALOGS[DEFAULT_LOCALE])

// `setLocale` does throw outside a provider. Only the Settings toggle calls
// it, and a silent no-op there would look exactly like a broken toggle.
const LocaleContext = createContext<LocaleApi>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {
    throw new Error('setLocale must be used inside a LocaleProvider')
  },
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  // null means "not yet read from storage", which is a different state from
  // any real locale and is what gates the first render.
  const [locale, setLocaleState] = useState<Locale | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadLocale().then((stored) => {
      if (!cancelled) setLocaleState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void saveLocale(next)
  }, [])

  const api = useMemo(() => ({ locale: locale ?? DEFAULT_LOCALE, setLocale }), [locale, setLocale])

  // Spec §3: one blank frame, rather than a frame of the wrong language.
  // That frame matters most to the learner who deliberately chose English and
  // would otherwise see Japanese flash on every launch.
  if (locale === null) return null

  return (
    <LocaleContext.Provider value={api}>
      <StringsContext.Provider value={CATALOGS[locale]}>{children}</StringsContext.Provider>
    </LocaleContext.Provider>
  )
}

export function useStrings(): Strings {
  return useContext(StringsContext)
}

export function useLocale(): LocaleApi {
  return useContext(LocaleContext)
}
```

Note the hook order: `useMemo` runs before the `locale === null` early return, so no hook is skipped between renders.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/i18n/index.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Mount the provider in `app/_layout.tsx`**

Replace the whole file:

```tsx
import { Stack } from 'expo-router'
import { LocaleProvider } from '@/i18n'
import { ProgressProvider } from '@/ui/ProgressProvider'

export default function RootLayout() {
  return (
    <LocaleProvider>
      <ProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </LocaleProvider>
  )
}
```

`LocaleProvider` sits outside `ProgressProvider` so that even the hydration
copy the screens render while progress loads is already in the right language.

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. No screen reads from the catalog yet, so nothing else changes.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/index.tsx src/i18n/index.test.tsx app/_layout.tsx
git commit -m "feat: provide the active string catalog to the tree"
```

---

### Task 4: The Settings screen and the toggle

This is the deliverable the whole plan exists for: after this task the learner can switch languages.

**Files:**
- Modify: `app/settings.tsx`
- Modify: `__tests__/settings-reset.test.tsx:41`
- Test: `__tests__/settings-locale.test.tsx`

**Interfaces:**
- Consumes: `useStrings`, `useLocale` (Task 3); `LOCALES`, `LOCALE_NAMES` (Task 1).
- Produces: testIDs `locale-ja`, `locale-en`, `language-label` for later manual verification.

- [ ] **Step 1: Write the failing toggle test**

Create `__tests__/settings-locale.test.tsx`.

```tsx
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import { LocaleProvider } from '@/i18n'
import * as localeStore from '@/storage/localeStore'
import * as store from '@/storage/progressStore'
import { ProgressProvider } from '@/ui/ProgressProvider'
import Settings from '../app/settings'

jest.mock('@/storage/progressStore')
jest.mock('@/storage/localeStore')

jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  return {
    Link: ({ href, testID }: { href: string; testID?: string }) => (
      <Text testID={testID}>{href}</Text>
    ),
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>
const mockLoadLocale = localeStore.loadLocale as jest.MockedFunction<typeof localeStore.loadLocale>
const mockSaveLocale = localeStore.saveLocale as jest.MockedFunction<typeof localeStore.saveLocale>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 12 })
  mockSave.mockResolvedValue()
  mockLoadLocale.mockResolvedValue('ja')
  mockSaveLocale.mockResolvedValue()
})

function renderSettings() {
  return render(
    <LocaleProvider>
      <ProgressProvider>
        <Settings />
      </ProgressProvider>
    </LocaleProvider>,
  )
}

describe('Settings language toggle', () => {
  it('starts in Japanese', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain('12日'))
    expect(getByTestId('language-label').props.children).toBe('言語')
  })

  it('offers both languages by their own names, untranslated', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-ja')).toBeTruthy())
    expect(getByTestId('locale-ja-label').props.children).toBe('日本語')
    expect(getByTestId('locale-en-label').props.children).toBe('English')
  })

  it('marks the active language as selected', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-ja')).toBeTruthy())
    // toMatchObject, not toEqual: Pressable merges its own keys (disabled,
    // busy) into accessibilityState, so an exact match would be brittle.
    expect(getByTestId('locale-ja').props.accessibilityState).toMatchObject({ selected: true })
    expect(getByTestId('locale-en').props.accessibilityState).toMatchObject({ selected: false })
  })

  it('switches the whole screen to English', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(getByTestId('days-practiced').props.children).toContain('12 days practised')
  })

  it('keeps the option labels in their own language after switching', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(getByTestId('locale-ja-label').props.children).toBe('日本語')
    expect(getByTestId('locale-en-label').props.children).toBe('English')
  })

  it('persists the choice', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(mockSaveLocale).toHaveBeenCalledWith('en')
  })

  // The whole reason the locale lives under its own storage key.
  it('survives a full progress reset', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })

    fireEvent.press(getByTestId('reset'))
    await act(async () => {
      fireEvent.press(getByTestId('reset-confirm'))
    })

    expect(mockSave).toHaveBeenCalledWith(emptyProgress())
    expect(getByTestId('days-practiced').props.children).toContain('0 days practised')
    expect(mockSaveLocale).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/settings-locale.test.tsx`
Expected: FAIL — `Unable to find an element with testID: locale-ja`.

- [ ] **Step 3: Rewrite `app/settings.tsx`**

```tsx
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useStrings } from '@/i18n'
import { LOCALES, LOCALE_NAMES } from '@/i18n/locale'
import { useProgress } from '@/ui/ProgressProvider'

export default function Settings() {
  const { progress, hydrated, reset } = useProgress()
  const { locale, setLocale } = useLocale()
  const strings = useStrings()
  const [confirming, setConfirming] = useState(false)

  if (!hydrated) return <Text testID="hydrating">{strings.loading}</Text>

  return (
    <View>
      <Text testID="days-practiced">{strings.daysPracticed(progress.daysPracticed)}</Text>

      {/* Above the reset, so the destructive control stays last on screen. */}
      <Text testID="language-label">{strings.languageLabel}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {LOCALES.map((option) => (
          <Pressable
            key={option}
            testID={`locale-${option}`}
            accessibilityRole="button"
            accessibilityState={{ selected: option === locale }}
            onPress={() => setLocale(option)}
          >
            {/* Never translated: the way back for someone who mistapped
                into a language they cannot read. */}
            <Text testID={`locale-${option}-label`}>{LOCALE_NAMES[option]}</Text>
          </Pressable>
        ))}
      </View>

      {confirming ? (
        <Pressable testID="reset-confirm" accessibilityRole="button" onPress={() => void reset()}>
          <Text>{strings.resetConfirm}</Text>
        </Pressable>
      ) : (
        <Pressable testID="reset" accessibilityRole="button" onPress={() => setConfirming(true)}>
          <Text>{strings.resetAll}</Text>
        </Pressable>
      )}
      <Link href="/" testID="link-today">
        {strings.navToday}
      </Link>
    </View>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/settings-locale.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Update the existing reset test for the Japanese default**

`__tests__/settings-reset.test.tsx` mounts no `LocaleProvider`, so it gets the
Japanese default from the context default value. Only the expected string
changes. At line 41, replace:

```tsx
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain('12 days'))
```

with:

```tsx
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain('12日'))
```

Leave the other three tests in that file untouched: they assert testIDs and
hrefs, not copy.

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/settings.tsx __tests__/settings-locale.test.tsx __tests__/settings-reset.test.tsx
git commit -m "feat: switch the UI language from the settings screen"
```

---

### Task 5: The Today and Progress screens

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/progress.tsx`
- Modify: `src/ui/progress/AtomGrid.tsx`
- Modify: `src/ui/progress/AtomGrid.test.tsx:41`

**Interfaces:**
- Consumes: `useStrings` (Task 3); `ja.atomSummary`, `ja.cellLabel`, `ja.daysPracticed`, `ja.loading`, `ja.loadingProgress`, `ja.navProgress`, `ja.navSettings`, `ja.navToday` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Update `app/index.tsx`**

Add the import:

```tsx
import { useStrings } from '@/i18n'
```

Inside `Today()`, after the `useProgress()` call, add:

```tsx
  const strings = useStrings()
```

Then replace the three copy sites:

```tsx
        <Text testID="hydrating">{strings.loadingProgress}</Text>
```

```tsx
      <Text testID="days-practiced">{strings.daysPracticed(progress.daysPracticed)}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Link href="/progress" testID="link-progress">
          {strings.navProgress}
        </Link>
        <Link href="/settings" testID="link-settings">
          {strings.navSettings}
        </Link>
      </View>
```

`useStrings()` must be called before the `if (!hydrated …)` early return, so
the hook runs on every render.

- [ ] **Step 2: Update `app/progress.tsx`**

```tsx
import { Link } from 'expo-router'
import { Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { useProgress } from '@/ui/ProgressProvider'
import { AtomGrid } from '@/ui/progress/AtomGrid'

export default function ProgressScreen() {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()
  if (!hydrated) return <Text testID="hydrating">{strings.loading}</Text>
  return (
    <View>
      <Text>{strings.daysPracticed(progress.daysPracticed)}</Text>
      <AtomGrid progress={progress} />
      <Link href="/" testID="link-today">
        {strings.navToday}
      </Link>
    </View>
  )
}
```

- [ ] **Step 3: Update `src/ui/progress/AtomGrid.tsx`**

Add the import and the hook, then replace the two copy sites. `CellState`,
`CELL_COLOR` and `cellState()` are unchanged — the catalog imports
`CellState` from this file, so it must keep exporting the type.

```tsx
import { useStrings } from '@/i18n'
```

```tsx
export function AtomGrid({ progress }: { progress: Progress }) {
  const strings = useStrings()
  const states = ATOMS.map((atom) =>
    cellState(progress.atoms[atom.id], classify(atom), progress.calibrationMs),
  )
  const mental = states.filter((s) => s === 'mental').length

  return (
    <View>
      <Text testID="atom-summary">{strings.atomSummary(mental, ATOMS.length)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ATOMS.map((atom, index) => (
          <View
            key={atom.id}
            testID={`atom-cell-${atom.id}`}
            accessible={true}
            accessibilityLabel={strings.cellLabel(atom.id, states[index] ?? 'unseen')}
            style={{
              width: 16,
              height: 16,
              margin: 1,
              borderRadius: 3,
              backgroundColor: CELL_COLOR[states[index] ?? 'unseen'],
            }}
          />
        ))}
      </View>
    </View>
  )
}
```

- [ ] **Step 4: Update `src/ui/progress/AtomGrid.test.tsx:41`**

Replace:

```tsx
    expect(getByTestId('atom-summary').props.children).toContain('0 of 180')
```

with:

```tsx
    expect(getByTestId('atom-summary').props.children).toContain('180手中 0手')
```

The four `cellState` assertions at lines 10-29 are untouched: they assert the
`CellState` identifiers, which do not change.

- [ ] **Step 5: Run the affected tests**

Run: `npx jest src/ui/progress __tests__/progress-screen.test.tsx __tests__/today-session.test.tsx`
Expected: PASS. `progress-screen.test.tsx` and `today-session.test.tsx` assert
testIDs and hrefs only, so neither needs editing.

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/index.tsx app/progress.tsx src/ui/progress/AtomGrid.tsx src/ui/progress/AtomGrid.test.tsx
git commit -m "feat: render the today and progress screens from the catalog"
```

---

### Task 6: The session, and retiring `explainMove`

This is the task that makes the domain layer language-free. It removes the
transient duplication Task 2 introduced.

**Files:**
- Modify: `src/ui/session/SessionRunner.tsx`
- Modify: `src/domain/explain.ts`
- Modify: `src/domain/explain.test.ts`

**Interfaces:**
- Consumes: `useStrings` (Task 3); `ja.prompt`, `ja.coaching`, `ja.correction`, `ja.sessionComplete`, `ja.sessionResult`, `ja.done`, `ja.answer` (Task 2).
- Produces: `src/domain/explain.ts` exporting `describeSteps` only.

- [ ] **Step 1: Point `SessionRunner` at the catalog**

In `src/ui/session/SessionRunner.tsx`, replace the `explainMove` import:

```tsx
import { explainMove } from '@/domain/explain'
```

with:

```tsx
import { useStrings } from '@/i18n'
```

Inside `SessionRunner(...)`, alongside the other hooks and **before any early
return**, add:

```tsx
  const strings = useStrings()
```

Replace the close-block copy:

```tsx
        <Text testID="summary-text">{strings.sessionComplete}</Text>
        {/* Spec §6: the close block reports the result. Atoms mastered and
            tomorrow's preview still belong here and are not built yet. */}
        <Text testID="summary-result">{strings.sessionResult(tally.answered, tally.correct)}</Text>
```

and the button label in that same block:

```tsx
          <Text>{strings.done}</Text>
```

In `submit()`, replace the correction line:

```tsx
      if (current.coaching !== 'silent') nextCorrection = strings.correction(expected, atom)
```

And in the returned JSX, replace the prompt, the demonstration and the submit
label:

```tsx
      <Text testID="prompt">{strings.prompt(atom)}</Text>
      {/* Spec §4: F0 is where the app demonstrates the move, so the
          substitution is shown *before* the answer, not after a miss. */}
      {current.coaching === 'demo' ? (
        <Text testID="demonstration">{strings.coaching(atom)}</Text>
      ) : null}
```

```tsx
        <Text>{strings.answer}</Text>
```

`strings.prompt(atom)` replaces the interpolated `Rod shows … Add ….` string
and takes the whole atom, so `rodValue`, `operand` and `direction` no longer
appear in the template.

`atom`, `expected`, `rodValue`, `operand` and `sign` are all declared above
`submit()` already, so no ordering changes. After this edit `rodValue` is
still used by `<Abacus>`, and `operand` and `sign` by `expected` and `atom`,
so nothing becomes unused.

- [ ] **Step 2: Run the session tests**

Run: `npx jest src/ui/session __tests__/today-session.test.tsx`
Expected: PASS. These tests assert testIDs, submission behaviour and
scheduling, not copy.

- [ ] **Step 3: Delete `explainMove` from the domain**

In `src/domain/explain.ts`, remove the whole `explainMove` function:

```ts
export function explainMove(atom: Atom): string {
  const verb = atom.direction === 'add' ? 'Add' : 'Subtract'
  return `${verb} ${atom.operand} = ${describeSteps(atom)}`
}
```

`describeSteps`, `sign`, `amountOf`, `MINUS` and the file's header comment all
stay. If `Atom` is now only used as a type by `describeSteps`, leave the
import as it is — it is still needed.

- [ ] **Step 4: Remove its tests**

In `src/domain/explain.test.ts`, delete the entire `describe('explainMove', …)`
block (lines 46-55) and drop `explainMove` from the import on line 2, leaving:

```ts
import { describeSteps } from './explain'
```

Those two assertions now live in `src/i18n/catalogs.test.ts`, added in Task 2
as "keeps the English wording that explainMove had". The six `describeSteps`
assertions stay exactly as they are.

- [ ] **Step 5: Verify the domain is language-free**

Run: `npx jest src/domain`
Expected: PASS, including `purity.test.ts`.

Then confirm by hand that no prose is left:

Run: `grep -rnE "'(Add|Subtract) |heaven|earth bead" src/domain/ || echo "domain is language-free"`
Expected: `domain is language-free`.

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass. `tsc` will catch any remaining `explainMove` importer.

- [ ] **Step 7: Commit**

```bash
git add src/ui/session/SessionRunner.tsx src/domain/explain.ts src/domain/explain.test.ts
git commit -m "refactor: move the coaching sentence out of the domain layer"
```

---

### Task 7: The tutorial drill

**Files:**
- Modify: `src/ui/tutorial/ReadingDrill.tsx`
- Modify: `src/ui/tutorial/ReadingDrill.test.tsx:10,17,25-27,35,43`

**Interfaces:**
- Consumes: `useStrings` (Task 3); `ja.readingIndex`, `ja.readingInstruction`, `ja.readingPrompt`, `ja.check`, `ja.readingFeedback` (Task 2).
- Produces: nothing new. `breakdown()` and the `INSTRUCTION` constant are deleted from this file — the catalogs own them now.

- [ ] **Step 1: Rewrite `src/ui/tutorial/ReadingDrill.tsx`**

```tsx
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { parseAnswer } from '@/ui/parseAnswer'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
  const strings = useStrings()
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const target = values[index] ?? 0

  function submit() {
    // Number('') is 0, so without this a blank field would read as a correct
    // answer on the drill's 0 rod and finish the tutorial.
    const given = parseAnswer(answer)
    if (given === null) return

    if (given !== target) {
      setFeedback(strings.readingFeedback(target))
      setAnswer('')
      return
    }
    setAnswer('')
    setFeedback(null)
    if (index + 1 >= values.length) {
      onComplete()
      return
    }
    setIndex(index + 1)
  }

  return (
    <View>
      <Text testID="reading-index">{strings.readingIndex(index + 1, values.length)}</Text>
      <Text testID="reading-instruction">{strings.readingInstruction}</Text>
      <Abacus soroban={setValue(emptySoroban(1), target)} fade={0} />
      <Text>{strings.readingPrompt}</Text>
      <TextInput
        testID="reading-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="reading-submit" accessibilityRole="button" onPress={submit}>
        <Text>{strings.check}</Text>
      </Pressable>
      {feedback !== null ? <Text testID="reading-feedback">{feedback}</Text> : null}
    </View>
  )
}
```

The local `breakdown()` helper and the `INSTRUCTION` constant are gone — both
now live inside each catalog, where the Japanese version has no plural branch.

- [ ] **Step 2: Update the five copy assertions in `ReadingDrill.test.tsx`**

The file mounts no provider, so it renders the Japanese default. Change only
the expected strings; leave every `fireEvent` and every structural assertion
alone.

Line 10, in 'advances on a correct reading':

```tsx
    expect(getByTestId('reading-index').props.children).toContain('2問目')
```

Line 17, in 'does not advance on a wrong reading':

```tsx
    expect(getByTestId('reading-index').props.children).toContain('1問目')
```

Lines 25-27, in 'says how a rod is read before asking for a reading':

```tsx
    expect(instruction).toContain('天珠')
    expect(instruction).toContain('一珠')
    expect(instruction).toContain('5')
```

Line 35 keeps `toContain('6')` and `toContain('5 + 1')` — both appear verbatim
in the Japanese feedback (`ちがいます。このけたは6です：天珠と一珠が1つ、5 + 1。`), so
that test needs no edit at all.

Line 43, in 'explains a rod with no heaven bead in earth beads alone':

```tsx
    expect(getByTestId('reading-feedback').props.children).toContain('一珠が3つ')
```

- [ ] **Step 3: Run the tutorial tests**

Run: `npx jest src/ui/tutorial`
Expected: PASS, 8 tests.

- [ ] **Step 4: Run the full suite, typecheck and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Confirm no English is left in the rendered app**

Run: `grep -rnE ">[A-Z][a-z]+ [a-z]" app/ src/ui/ --include='*.tsx' | grep -v test || echo "no bare English copy in components"`
Expected: `no bare English copy in components`. Every remaining capitalised
literal should be a testID, a style value, or an import.

- [ ] **Step 6: Verify the dependency list is unchanged**

Run: `grep -n "localization\|i18next\|intl" package.json || echo "no i18n dependency added"`
Expected: `no i18n dependency added`. The catalogs are plain TypeScript; the
whole feature ships without a new runtime dependency.

- [ ] **Step 7: Commit**

```bash
git add src/ui/tutorial/ReadingDrill.tsx src/ui/tutorial/ReadingDrill.test.tsx
git commit -m "feat: teach the reading drill in the learner's language"
```

---

## Manual verification

After Task 7, run the app and confirm the parts tests cannot:

```bash
npm run ios
```

1. A fresh install opens in Japanese, at the tutorial (`このけたはいくつですか？`).
2. Complete the drill; the session prompt reads `けたは…`, and a wrong answer
   shows a correction naming the technique (`十の繰上：…`).
3. Settings → press **English**. The screen turns English immediately, and the
   two option labels still read 日本語 and English.
4. Kill and relaunch. The app opens in English with no flash of Japanese.
5. Settings → **Reset all progress**, twice. Days practised returns to 0; the
   UI stays in English.
6. Settings → press **日本語**, relaunch, confirm it opens in Japanese.

## Follow-up, deliberately not in this plan

`cellState()` and the `CellState` type live in `src/ui/progress/AtomGrid.tsx`
but import only from `src/domain/`. They are pure domain logic in a UI file,
which is why `src/i18n/ja.ts` has to reach into a UI module for a type. The
`import type` is erased at compile time, so there is no runtime cycle and
nothing here is blocked by it — but moving `cellState` into `src/domain/`
would remove the awkwardness. Out of scope for this change.
