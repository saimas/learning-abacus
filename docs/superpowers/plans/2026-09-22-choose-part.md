# Choosing What to Practise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The start button on Home opens a chooser (ぜんぶ / 準備だけ / 集中だけ / 暗算だけ), so a learner can practise one part of the session on its own. TestFlight build 8 ships from the feature branch.

**Architecture:**
- A pure domain function, `planForPart`, narrows today's `selectSession` plan to one part. The part runs for the whole practice time and is followed by the close block.
- `app/session.tsx` applies it when the route carries `?part=`.
- A new `PartChooser` sheet, shown by Home, makes the choice and says what each part holds.
- `SessionRunner` is unchanged, because it already plays any plan.

**Tech Stack:** Expo SDK 57, React Native 0.86 (`Modal`, `Pressable`), expo-router with typed routes (both `'/session'` and `{ pathname: '/session', params: { part } }` are valid hrefs), TypeScript strict (`noUncheckedIndexedAccess`), Jest via jest-expo with @testing-library/react-native 13.3. The release uses the Xcode CLI and an App Store Connect API key.

**Spec:** `docs/superpowers/specs/2026-09-22-choose-part-design.md`. The approved mockup is `docs/superpowers/specs/2026-09-22-choose-part-mockups/choose-part.html`.

**Decisions made while planning:**
- The sheet uses `Modal` with `animationType="fade"`: the dimmed backdrop and the sheet fade in together. There is no hand-written slide animation, so there are no JS animation timers in Home's tests. The simulator check judges how it feels.
- There is no chevron on the rows, because the icon set has no right chevron. Each row is a bordered button.
- The row's accessible name is the Pressable's grouped child text (name, then detail). Pressables are accessible by default, so VoiceOver reads both.

## Global Constraints

- **House style, enforced by ESLint:** no semicolons; single quotes (double quotes only to avoid escaping an apostrophe); 2-space indent. No statement may start with `[` or `(`; put the value in a `const` first.
- **Domain:** `src/domain/` changes only by adding what this plan names. `src/domain/purity.test.ts` must keep passing, so domain files import no React, React Native, `@/ui`, `@/storage` or `@/i18n`. `selectSession` is unchanged.
- **Colours and strings:**
  - Every colour comes from `src/ui/theme.ts`; components contain no hex or `rgba` literals.
  - Every user-visible string comes from both `src/i18n/ja.ts` and `src/i18n/en.ts` (`Strings = typeof ja`; `catalogs.test.ts` checks parity and arity).
- **Render rules:** no `Date.now()` during render (`react-hooks/purity`); Home calls it only in the start button's handler. All hooks run before any early return.
- **Exact values:** `PRACTICE_SECONDS = SESSION_SECONDS - BLOCK_SECONDS.close` (255). A part-only plan's `totalSeconds` is `SESSION_SECONDS` (285).
- **Strings** (exact):

  | Key | ja | en |
  |---|---|---|
  | `chooseTitle` | `なにを練習しますか` | `What would you like to practise?` |
  | `chooseAll` | `ぜんぶ` | `Everything` |
  | `chooseAllDetail` | `準備 → 集中 → 暗算・5分` | `Warm-up → Focus → Fade · 5 min` |
  | `chooseOnly(part)` | `準備だけ` / `集中だけ` / `暗算だけ` | `Warm-up only` / `Focus only` / `Fade only` |
  | `chooseDetail(part, n)` | `おさらい・${n}つの動き` / `新しい動きと苦手な動き` / `珠を消す・${n}つの動き` | `Review · ${n} move(s)` / `New and shaky moves` / `Fading the beads · ${n} move(s)` |
  | `chooseEmpty` | `今はありません` | `Nothing right now` |

  English uses "move" for 1 and "moves" otherwise.
- **testIDs:**
  - New: `part-chooser`, `chooser-backdrop`, `choose-all`, `choose-warmup`, `choose-focus`, `choose-faderep`.
  - `start` stays on Home's start button.
  - All session testIDs are unchanged (`prompt`, `block-label`, `track-segment-<i>`, `session-summary`, `summary-result`, …).
- **Routes:**
  - ぜんぶ pushes `'/session'`.
  - A part pushes `{ pathname: '/session', params: { part } }`.
  - `app/session.tsx` treats a missing or unknown `part` as the full session.
- **Tests:** test files that render SessionRunner or anything animated use `jest.useFakeTimers()` in `beforeEach` and `jest.useRealTimers()` in `afterEach`, as `__tests__/session-screen.test.tsx` already does. A pre-existing `act(...)` warning from `src/ui/ProgressProvider.tsx` in some `__tests__` files is not new.
- **Commits:** every commit message ends with a `Co-Authored-By:` line naming the model that wrote the commit.
- **Branch:** work on `feature/choose-part`, which already exists and holds the spec and this plan. Do not push, do not merge, and do not touch simulators (Task 5 is the controller's). Metro may be running from this checkout; leave it running.
- **Commands:** run one test file with `npx jest <path>` and the whole suite with `npm test`. Also run `npm run typecheck` and `npm run lint`. Lint has one known warning in `src/ui/kit/kit.test.tsx`.

---

## File Structure

| Path | Change | Responsibility |
|---|---|---|
| `src/domain/session.ts` (+ test) | modify | `PracticePart`, `PRACTICE_PARTS`, `isPracticePart`, `PRACTICE_SECONDS`, `planForPart` |
| `src/i18n/ja.ts`, `src/i18n/en.ts` (+ `catalogs.test.ts`) | modify | the chooser's strings |
| `src/ui/theme.ts` | modify | `scrim` (the dimmed backdrop colour) |
| `src/ui/home/PartChooser.tsx` (+ test) | create | the chooser sheet |
| `app/index.tsx` (+ `__tests__/home.test.tsx`) | modify | the start button opens the chooser; a choice navigates |
| `app/session.tsx` (+ `__tests__/session-screen.test.tsx`) | modify | reads `?part=` and narrows the plan |
| `app.json`, the spec | modify | build 8; Status line |

---

### Task 1: A plan for one part (domain)

**Files:**
- Modify: `src/domain/session.ts`
- Test: `src/domain/session.test.ts`

**Interfaces:**
- Consumes: `SessionPlan`, `SessionItem`, `BLOCK_SECONDS`, `SESSION_SECONDS`, `selectSession`, `EXTRA_NEW_ATOMS`, `NEW_ATOMS_PER_DAY` (all in `session.ts`).
- Produces (exported from `src/domain/session.ts`):
  - `type PracticePart = 'warmup' | 'focus' | 'faderep'`;
  - `PRACTICE_PARTS: readonly PracticePart[]` (in that order);
  - `isPracticePart(value: unknown): value is PracticePart`;
  - `PRACTICE_SECONDS: number` (255);
  - `planForPart(plan: SessionPlan, part: PracticePart): SessionPlan`.

- [ ] **Step 1: Write the failing tests**

In `src/domain/session.test.ts`, replace the import block from `'./session'` with:

```ts
import {
  BLOCK_SECONDS,
  EXTRA_NEW_ATOMS,
  isPracticePart,
  NEW_ATOMS_PER_DAY,
  planForPart,
  PRACTICE_PARTS,
  PRACTICE_SECONDS,
  selectSession,
  SESSION_SECONDS,
  type SessionItem,
  type SessionPlan,
} from './session'
```

and append at the end of the file:

```ts
// Spec (choosing what to practise) §3: one part of today's plan, for the
// whole practice time, then the summary.
describe('planForPart', () => {
  const item = (atomId: string): SessionItem => ({ atomId, fade: 0, coaching: 'demo' })
  const today: SessionPlan = {
    blocks: [
      { kind: 'warmup', seconds: BLOCK_SECONDS.warmup, items: [item('1+1'), item('2+1')] },
      { kind: 'focus', seconds: BLOCK_SECONDS.focus, items: [item('0+3')] },
      { kind: 'faderep', seconds: BLOCK_SECONDS.faderep, items: [] },
      { kind: 'close', seconds: BLOCK_SECONDS.close, items: [] },
    ],
    totalSeconds: SESSION_SECONDS,
    reserve: [item('0+4')],
  }

  it('gives a part the practice time of a whole session', () => {
    expect(PRACTICE_SECONDS).toBe(BLOCK_SECONDS.warmup + BLOCK_SECONDS.focus + BLOCK_SECONDS.faderep)
    expect(PRACTICE_SECONDS).toBe(255)
  })

  it.each(PRACTICE_PARTS)('keeps only %s, for the whole practice time, then the summary', (part) => {
    const plan = planForPart(today, part)
    expect(plan.blocks.map((block) => block.kind)).toEqual([part, 'close'])
    expect(plan.blocks[0]?.seconds).toBe(PRACTICE_SECONDS)
    expect(plan.blocks[0]?.items).toEqual(today.blocks.find((block) => block.kind === part)?.items)
    expect(plan.blocks[1]).toEqual({ kind: 'close', seconds: BLOCK_SECONDS.close, items: [] })
    expect(plan.totalSeconds).toBe(SESSION_SECONDS)
    expect(plan.blocks.reduce((sum, block) => sum + block.seconds, 0)).toBe(SESSION_SECONDS)
  })

  it('keeps the reserve for focus, the only part that brings new moves in', () => {
    expect(planForPart(today, 'focus').reserve).toEqual(today.reserve)
    expect(planForPart(today, 'warmup').reserve).toBeUndefined()
    expect(planForPart(today, 'faderep').reserve).toBeUndefined()
  })

  it('leaves a part with nothing in it empty, for the runner to skip', () => {
    expect(planForPart(today, 'faderep').blocks[0]?.items).toEqual([])
  })

  it("narrows a real plan: a new learner's focus keeps today's new moves and the reserve", () => {
    const plan = planForPart(selectSession(emptyProgress(), NOW), 'focus')
    expect(plan.blocks[0]?.items).toHaveLength(NEW_ATOMS_PER_DAY)
    expect(plan.reserve).toHaveLength(EXTRA_NEW_ATOMS)
  })
})

describe('isPracticePart', () => {
  it('accepts the three parts', () => {
    for (const part of PRACTICE_PARTS) expect(isPracticePart(part)).toBe(true)
  })

  it('rejects anything else, including the close block', () => {
    for (const value of ['close', '', 'FOCUS', 'focus ', undefined, null, 3, ['focus']]) {
      expect(isPracticePart(value)).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/domain/session.test.ts`
Expected: FAIL, because `planForPart`, `isPracticePart`, `PRACTICE_PARTS` and `PRACTICE_SECONDS` are not exported.

- [ ] **Step 3: Implement**

In `src/domain/session.ts`, directly after the line `export const SESSION_SECONDS = 285`, add:

```ts

// Spec (choosing what to practise) §3: the parts a learner can practise on
// their own. Close is the summary, not something to practise.
export type PracticePart = 'warmup' | 'focus' | 'faderep'
export const PRACTICE_PARTS: readonly PracticePart[] = ['warmup', 'focus', 'faderep']

// A part practised on its own gets all of a session's practice time.
export const PRACTICE_SECONDS = SESSION_SECONDS - BLOCK_SECONDS.close

// For values from outside the app's own code, such as a route parameter.
export function isPracticePart(value: unknown): value is PracticePart {
  return typeof value === 'string' && (PRACTICE_PARTS as readonly string[]).includes(value)
}
```

and append at the end of the file:

```ts

// Today's plan narrowed to one part: that part's moves for the whole practice
// time, then the summary. The runner plays the block just as it would inside
// a full session. Warm-up is still a single pass, and only focus draws on the
// reserve, so the reserve goes with focus alone.
export function planForPart(plan: SessionPlan, part: PracticePart): SessionPlan {
  const items = plan.blocks.find((block) => block.kind === part)?.items ?? []
  return {
    blocks: [
      { kind: part, seconds: PRACTICE_SECONDS, items },
      { kind: 'close', seconds: BLOCK_SECONDS.close, items: [] },
    ],
    totalSeconds: SESSION_SECONDS,
    reserve: part === 'focus' ? plan.reserve : undefined,
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx jest src/domain`
Expected: PASS (including `purity.test.ts` and the existing `selectSession` tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/session.ts src/domain/session.test.ts
git commit -m "feat: narrow a session plan to one part

planForPart(plan, part) keeps one part of today's plan for the whole
practice time, then the summary; the reserve stays with focus.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 2: Strings for the chooser

**Files:**
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`
- Test: `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes: `type PracticePart` from `@/domain/session` (Task 1).
- Produces, in both catalogs: `chooseTitle`, `chooseAll`, `chooseAllDetail`, `chooseEmpty` (strings); `chooseOnly(part: PracticePart): string`; `chooseDetail(part: PracticePart, count: number): string`.

- [ ] **Step 1: Write the failing tests**

Append to `src/i18n/catalogs.test.ts`:

```ts
// Spec (choosing what to practise) §4: the chooser's rows.
describe('the part chooser', () => {
  it('names the full session and each part', () => {
    expect(ja.chooseTitle).toBe('なにを練習しますか')
    expect(ja.chooseAll).toBe('ぜんぶ')
    expect(ja.chooseAllDetail).toBe('準備 → 集中 → 暗算・5分')
    expect(ja.chooseOnly('warmup')).toBe('準備だけ')
    expect(ja.chooseOnly('focus')).toBe('集中だけ')
    expect(ja.chooseOnly('faderep')).toBe('暗算だけ')
    expect(ja.chooseEmpty).toBe('今はありません')
    expect(en.chooseTitle).toBe('What would you like to practise?')
    expect(en.chooseAll).toBe('Everything')
    expect(en.chooseAllDetail).toBe('Warm-up → Focus → Fade · 5 min')
    expect(en.chooseOnly('warmup')).toBe('Warm-up only')
    expect(en.chooseEmpty).toBe('Nothing right now')
  })

  it('says what each part holds', () => {
    expect(ja.chooseDetail('warmup', 3)).toBe('おさらい・3つの動き')
    expect(ja.chooseDetail('focus', 2)).toBe('新しい動きと苦手な動き')
    expect(ja.chooseDetail('faderep', 4)).toBe('珠を消す・4つの動き')
    expect(en.chooseDetail('warmup', 3)).toBe('Review · 3 moves')
    expect(en.chooseDetail('focus', 2)).toBe('New and shaky moves')
    expect(en.chooseDetail('faderep', 4)).toBe('Fading the beads · 4 moves')
  })

  it('keeps the English singular', () => {
    expect(en.chooseDetail('warmup', 1)).toBe('Review · 1 move')
    expect(en.chooseDetail('faderep', 1)).toBe('Fading the beads · 1 move')
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx jest src/i18n/catalogs.test.ts`
Expected: FAIL, because `ja.chooseTitle` is undefined and `chooseOnly` is not a function.

- [ ] **Step 3: Implement in `src/i18n/ja.ts`**

Change the import `import type { BlockKind } from '@/domain/session'` to:

```ts
import type { BlockKind, PracticePart } from '@/domain/session'
```

After the `BLOCK_LABEL` constant, add:

```ts

// What each part holds, as the chooser's detail line. Focus's size changes as
// new moves join during the session, so it names the kind of move instead of
// a count.
const CHOOSE_DETAIL: Record<PracticePart, (count: number) => string> = {
  warmup: (count) => `おさらい・${count}つの動き`,
  focus: () => '新しい動きと苦手な動き',
  faderep: (count) => `珠を消す・${count}つの動き`,
}
```

In the `ja` object, after the line `  practiseAgain: 'もう一度練習する',` add:

```ts
  chooseTitle: 'なにを練習しますか',
  chooseAll: 'ぜんぶ',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep}・5分`,
  chooseOnly: (part: PracticePart) => `${BLOCK_LABEL[part]}だけ`,
  chooseDetail: (part: PracticePart, count: number) => CHOOSE_DETAIL[part](count),
  chooseEmpty: '今はありません',
```

- [ ] **Step 4: Implement in `src/i18n/en.ts`**

Change the import `import type { BlockKind } from '@/domain/session'` to:

```ts
import type { BlockKind, PracticePart } from '@/domain/session'
```

After the `BLOCK_LABEL` constant, add:

```ts

function moves(count: number): string {
  return `${count} ${count === 1 ? 'move' : 'moves'}`
}

// What each part holds, as the chooser's detail line.
const CHOOSE_DETAIL: Record<PracticePart, (count: number) => string> = {
  warmup: (count) => `Review · ${moves(count)}`,
  focus: () => 'New and shaky moves',
  faderep: (count) => `Fading the beads · ${moves(count)}`,
}
```

In the `en` object, after the line `  practiseAgain: 'Practise again',` add:

```ts
  chooseTitle: 'What would you like to practise?',
  chooseAll: 'Everything',
  chooseAllDetail: `${BLOCK_LABEL.warmup} → ${BLOCK_LABEL.focus} → ${BLOCK_LABEL.faderep} · 5 min`,
  chooseOnly: (part) => `${BLOCK_LABEL[part]} only`,
  chooseDetail: (part, count) => CHOOSE_DETAIL[part](count),
  chooseEmpty: 'Nothing right now',
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx jest src/i18n && npm run typecheck`
Expected: PASS, including the parity and arity tests.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/ja.ts src/i18n/en.ts src/i18n/catalogs.test.ts
git commit -m "feat: add the strings for choosing what to practise

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 3: The chooser sheet

**Files:**
- Create: `src/ui/home/PartChooser.tsx`
- Modify: `src/ui/theme.ts`
- Test: `src/ui/home/PartChooser.test.tsx`

**Interfaces:**
- Consumes: `PRACTICE_PARTS`, `type PracticePart`, `type SessionPlan` (Task 1); the chooser strings (Task 2).
- Produces:
  - `type PartChoice = PracticePart | 'all'`;
  - `PartChooser({ plan, onChoose, onClose }: { plan: SessionPlan | null; onChoose: (choice: PartChoice) => void; onClose: () => void })`.
  - The sheet is visible while `plan !== null`.
  - testIDs: `part-chooser`, `chooser-backdrop`, `choose-all`, `choose-<part>`.
  - `colors.scrim`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/home/PartChooser.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import type { SessionItem, SessionPlan } from '@/domain/session'
import { PartChooser } from './PartChooser'

const item = (atomId: string): SessionItem => ({ atomId, fade: 0, coaching: 'demo' })

// Day two: three moves are due, today's two new moves are in focus, and
// nothing is fluent enough to fade yet.
const today: SessionPlan = {
  blocks: [
    { kind: 'warmup', seconds: 45, items: [item('0+1'), item('0+2'), item('1+1')] },
    { kind: 'focus', seconds: 120, items: [item('0+3'), item('0+4')] },
    { kind: 'faderep', seconds: 90, items: [] },
    { kind: 'close', seconds: 30, items: [] },
  ],
  totalSeconds: 285,
}

function renderChooser(plan: SessionPlan | null = today) {
  const onChoose = jest.fn()
  const onClose = jest.fn()
  render(<PartChooser plan={plan} onChoose={onChoose} onClose={onClose} />)
  return { onChoose, onClose }
}

describe('PartChooser', () => {
  it('is not shown without a plan', () => {
    renderChooser(null)
    expect(screen.queryByTestId('part-chooser')).toBeNull()
  })

  it('asks what to practise', () => {
    renderChooser()
    expect(within(screen.getByTestId('part-chooser')).getByText('なにを練習しますか')).toBeTruthy()
  })

  it('offers the full session and each part, with what each holds', () => {
    renderChooser()
    const row = (testID: string) => within(screen.getByTestId(testID))
    expect(row('choose-all').getByText('ぜんぶ')).toBeTruthy()
    expect(row('choose-all').getByText('準備 → 集中 → 暗算・5分')).toBeTruthy()
    expect(row('choose-warmup').getByText('準備だけ')).toBeTruthy()
    expect(row('choose-warmup').getByText('おさらい・3つの動き')).toBeTruthy()
    expect(row('choose-focus').getByText('集中だけ')).toBeTruthy()
    expect(row('choose-focus').getByText('新しい動きと苦手な動き')).toBeTruthy()
    expect(row('choose-faderep').getByText('暗算だけ')).toBeTruthy()
    expect(row('choose-faderep').getByText('今はありません')).toBeTruthy()
  })

  it('cannot choose a part with nothing in it', () => {
    const { onChoose } = renderChooser()
    expect(screen.getByTestId('choose-faderep').props.accessibilityState).toMatchObject({ disabled: true })
    expect(screen.getByTestId('choose-warmup').props.accessibilityState).toMatchObject({ disabled: false })
    fireEvent.press(screen.getByTestId('choose-faderep'))
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('reports the choice', () => {
    const { onChoose } = renderChooser()
    fireEvent.press(screen.getByTestId('choose-all'))
    expect(onChoose).toHaveBeenLastCalledWith('all')
    fireEvent.press(screen.getByTestId('choose-focus'))
    expect(onChoose).toHaveBeenLastCalledWith('focus')
    fireEvent.press(screen.getByTestId('choose-warmup'))
    expect(onChoose).toHaveBeenLastCalledWith('warmup')
  })

  it('closes, starting nothing, when the dimmed area is tapped', () => {
    const { onChoose, onClose } = renderChooser()
    fireEvent.press(screen.getByTestId('chooser-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onChoose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/home/PartChooser.test.tsx`
Expected: FAIL with "Cannot find module './PartChooser'".

- [ ] **Step 3: Add the scrim colour**

In `src/ui/theme.ts`, add after the `shadow` line in `colors`:

```ts
  // Dims Home behind the practice chooser: ink at a little over a third.
  scrim: 'rgba(42, 35, 32, 0.38)',
```

- [ ] **Step 4: Create `src/ui/home/PartChooser.tsx`**

```tsx
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRACTICE_PARTS, type PracticePart, type SessionPlan } from '@/domain/session'
import { useStrings } from '@/i18n'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

export type PartChoice = PracticePart | 'all'

// Spec (choosing what to practise) §4: the start button asks what to practise.
// ぜんぶ is today's full session, unchanged; each part below practises that
// part alone. The counts come from the plan the session would build now, so a
// part with nothing in it is shown, but cannot be chosen.
export function PartChooser({
  plan,
  onChoose,
  onClose,
}: {
  plan: SessionPlan | null
  onChoose: (choice: PartChoice) => void
  onClose: () => void
}) {
  const strings = useStrings()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={plan !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable testID="chooser-backdrop" style={styles.backdrop} onPress={onClose} />
        <View testID="part-chooser" style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grab} />
          <Text style={styles.title}>{strings.chooseTitle}</Text>
          <Row
            testID="choose-all"
            primary
            name={strings.chooseAll}
            detail={strings.chooseAllDetail}
            onPress={() => onChoose('all')}
          />
          {PRACTICE_PARTS.map((part) => {
            const count = plan?.blocks.find((block) => block.kind === part)?.items.length ?? 0
            return (
              <Row
                key={part}
                testID={`choose-${part}`}
                name={strings.chooseOnly(part)}
                detail={count > 0 ? strings.chooseDetail(part, count) : strings.chooseEmpty}
                disabled={count === 0}
                onPress={() => onChoose(part)}
              />
            )
          })}
        </View>
      </View>
    </Modal>
  )
}

// One choice: its name over a line saying what it holds. VoiceOver reads the
// two together, since a Pressable groups its text.
function Row({
  testID,
  name,
  detail,
  primary = false,
  disabled = false,
  onPress,
}: {
  testID: string
  name: string
  detail: string
  primary?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        primary && styles.primaryRow,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.name, primary && styles.onPrimary]}>{name}</Text>
      <Text style={[styles.detail, primary && styles.onPrimary]}>{detail}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  grab: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.keyEdge,
    marginBottom: space.xs,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.ink,
    marginBottom: space.xs,
  },
  row: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardLine,
    borderRadius: radius.key,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: 2,
  },
  primaryRow: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderBottomWidth: 2,
    borderBottomColor: colors.accentShadow,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  name: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  detail: { fontSize: fontSizes.caption, color: colors.muted },
  onPrimary: { color: colors.onAccent },
})
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx jest src/ui/home && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/theme.ts src/ui/home/PartChooser.tsx src/ui/home/PartChooser.test.tsx
git commit -m "feat: add a sheet for choosing what to practise

ぜんぶ runs today's session; each part below practises that part alone,
and a part with nothing in it cannot be chosen.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 4: Ask on Home, and play the chosen part

**Files:**
- Modify: `app/index.tsx`, `app/session.tsx`
- Test: `__tests__/home.test.tsx`, `__tests__/session-screen.test.tsx`

**Interfaces:**
- Consumes:
  - `selectSession`, `planForPart`, `isPracticePart`, `type SessionPlan` (Task 1);
  - `PartChooser`, `type PartChoice` (Task 3);
  - expo-router's `router.push` and `useLocalSearchParams`.
- Produces the user-facing flow:
  - start → chooser → `router.push('/session')` or `router.push({ pathname: '/session', params: { part } })`;
  - `/session?part=<part>` plays `planForPart(selectSession(...), part)`.

- [ ] **Step 1: Write the failing Home tests**

In `__tests__/home.test.tsx`:

(a) Change the first import line to:

```ts
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
```

(b) In the `jest.mock('expo-router', …)` factory, add a `router` entry to the returned object, right after the `useFocusEffect` entry:

```ts
    router: { push: (href: unknown) => mockPush(href) },
```

and directly above `jest.mock('expo-router', …)` add:

```ts
const mockPush = jest.fn()
```

(c) In `offers today’s session to a learner who has not practised today`, delete the line

```ts
    expect(getByTestId('start').props.nativeID).toBe('/session')
```

(d) In `stamps the seal and offers another round once today is done`, delete the line

```ts
    expect(getByTestId('start').props.nativeID).toBe('/session')
```

(e) Append at the end of the file:

```ts
// Spec (choosing what to practise) §4: the start button asks what to practise.
describe('Home choosing what to practise', () => {
  async function openChooser() {
    mockLoad.mockResolvedValue(learner({}))
    const utils = renderHome()
    await waitFor(() => expect(utils.getByTestId('start')).toBeTruthy())
    fireEvent.press(utils.getByTestId('start'))
    return utils
  }

  it('asks before starting anything', async () => {
    const { getByTestId } = await openChooser()
    expect(getByTestId('part-chooser')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('starts the full session from ぜんぶ', async () => {
    const { getByTestId, queryByTestId } = await openChooser()
    fireEvent.press(getByTestId('choose-all'))
    expect(mockPush).toHaveBeenCalledWith('/session')
    expect(queryByTestId('part-chooser')).toBeNull()
  })

  it('starts just the chosen part', async () => {
    const { getByTestId } = await openChooser()
    fireEvent.press(getByTestId('choose-focus'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/session', params: { part: 'focus' } })
  })

  it('offers 準備 only when something is due', async () => {
    // A learner who has answered nothing has nothing due.
    const { getByTestId } = await openChooser()
    expect(getByTestId('choose-warmup').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('closes without starting anything', async () => {
    const { getByTestId, queryByTestId } = await openChooser()
    fireEvent.press(getByTestId('chooser-backdrop'))
    expect(queryByTestId('part-chooser')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Write the failing session-screen tests**

In `__tests__/session-screen.test.tsx`:

(a) Replace the `jest.mock('expo-router', …)` block with:

```ts
// The route's search parameters, set per test.
const mockParams: { current: Record<string, string> } = { current: {} }
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams.current,
}))
```

(b) In `beforeEach`, after `mockPlan.current = null`, add:

```ts
  mockParams.current = {}
```

(c) Append at the end of the file:

```ts
// Spec (choosing what to practise) §5: ?part= practises one part.
describe('Session screen practising one part', () => {
  it('plays only the part it is given, for the whole practice time', async () => {
    mockParams.current = { part: 'focus' }
    const { getByTestId, getAllByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('block-label').props.children).toBe('集中')
    expect(getAllByTestId(/^track-segment-/)).toHaveLength(1)
  })

  it('goes straight to the summary when the chosen part has nothing in it', async () => {
    // A new learner has nothing due, so 準備 is empty.
    mockParams.current = { part: 'warmup' }
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('session-summary')).toBeTruthy())
    expect(getByTestId('summary-result').props.children).toContain('0問中')
  })

  it('plays the full session for a part it does not know', async () => {
    mockParams.current = { part: 'close' }
    const { getByTestId, getAllByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getAllByTestId(/^track-segment-/)).toHaveLength(3)
  })
})
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx jest __tests__/home.test.tsx __tests__/session-screen.test.tsx`
Expected:
- FAIL: `part-chooser` is not found (the start button is still a Link).
- The session tests for `part=focus` and `part=warmup` fail (one track segment is expected; there are 3, and the prompt shows instead of the summary).
- The unknown-part test may already pass.

- [ ] **Step 4: Implement Home**

In `app/index.tsx`:
- change the expo-router import to

```ts
import { Link, Redirect, router, useFocusEffect } from 'expo-router'
```

- add these imports after `import { dayKey } from '@/domain/progress'`:

```ts
import { selectSession, type SessionPlan } from '@/domain/session'
```

and after `import { PlanBar } from '@/ui/home/PlanBar'`:

```ts
import { PartChooser, type PartChoice } from '@/ui/home/PartChooser'
```

- directly after the `const [today, setToday] = useState(() => dayKey(Date.now()))` line, add:

```ts
  // The plan the chooser describes while it is open; null while it is shut.
  // Built when the start button is pressed, never during render.
  const [chooserPlan, setChooserPlan] = useState<SessionPlan | null>(null)
```

- directly before `return (` of the main render (after `const mental = mentalCount(atomStates(progress))`), add:

```ts
  const openChooser = () => setChooserPlan(selectSession(progress, Date.now()))
  const choose = (choice: PartChoice) => {
    setChooserPlan(null)
    router.push(choice === 'all' ? '/session' : { pathname: '/session', params: { part: choice } })
  }
```

- replace the start button block, from the comment `{/* Practising again is offered, never pushed: …` through the closing `</Link>` of the `testID="start"` link, with:

```tsx
      {/* Practising again is offered, never pushed: after today's session the
          main button steps down to an outline. Either way it first asks what
          to practise. */}
      {practisedToday ? (
        <Button testID="start" variant="outline" label={strings.practiseAgain} onPress={openChooser} />
      ) : (
        <Button testID="start" label={strings.start} detail={strings.startMinutes} onPress={openChooser} />
      )}
      <PartChooser plan={chooserPlan} onChoose={choose} onClose={() => setChooserPlan(null)} />
```

- [ ] **Step 5: Implement the session route**

In `app/session.tsx`:
- change `import { router } from 'expo-router'` to

```ts
import { router, useLocalSearchParams } from 'expo-router'
```

- change `import { selectSession } from '@/domain/session'` to

```ts
import { isPracticePart, planForPart, selectSession } from '@/domain/session'
```

- directly after the `const [startedAt] = useState(() => Date.now())` line, add:

```ts
  // Spec (choosing what to practise) §5: ?part=focus practises that part alone.
  // No part, or one this app does not know (or a repeated ?part=), is the full
  // session: isPracticePart narrows string | string[] | undefined.
  const { part } = useLocalSearchParams()
```

- replace the `const plan = useMemo(…)` statement (with its comment and the eslint-disable line) with:

```ts
  // Planned once per mount: re-planning mid-session would reshuffle the queue
  // under the learner as their own answers change the schedule.
  const plan = useMemo(
    () => {
      if (!hydrated) return null
      const today = selectSession(progress, startedAt)
      return isPracticePart(part) ? planForPart(today, part) : today
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, startedAt, part],
  )
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx jest __tests__/home.test.tsx __tests__/session-screen.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: every suite passes, typecheck is clean, and lint shows 0 errors with only the known `kit.test.tsx` warning.

- [ ] **Step 8: Commit**

```bash
git add app/index.tsx app/session.tsx __tests__/home.test.tsx __tests__/session-screen.test.tsx
git commit -m "feat: ask what to practise, and play just the chosen part

The start button opens the chooser. ぜんぶ runs today's session as before;
a part opens /session?part=…, which practises that part alone for the whole
practice time, then the summary.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

---

### Task 5: Check on the simulator, then TestFlight build 8

**Files:**
- Modify: `app.json` (`ios.buildNumber` `"7"` → `"8"`) and `docs/superpowers/specs/2026-09-22-choose-part-design.md` (the Status line).
- Scratch only, not committed: `$SCRATCH=/private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/choose-part`.

**Interfaces:**
- Consumes: the whole app.
- Simulators: iPhone 17 Pro `F04F4F02-42DD-4A32-828E-C06E0DF317B9` and iPhone SE (3rd generation) `95DD5FBC-2595-4DA3-A55E-A31E0D49CDB8`. "IR Refactor Check" is not ours; never touch it.
- Maestro: `~/.maestro/bin/maestro --device <udid>`.
- Release process: `docs/release-ios.md`.
- Polling script: `node /private/tmp/claude-501/-Users-masashisaito-Documents-workspace-learning-abacus/50784e7c-c566-403f-a2f1-d13f6ee6e902/scratchpad/asc-builds.mjs`.

- [ ] **Step 1: Full automated checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: pass. Record the counts.

- [ ] **Step 2: Look at the chooser on the iPhone 17 Pro**

Restart Expo Go on this branch's bundle with a Maestro flow: `stopApp`, `openLink: "exp://127.0.0.1:8081"`, then wait for `start`. Take screenshots (`xcrun simctl io <udid> screenshot $SCRATCH/<name>.png`) and Read each one:
1. `01-chooser`: after tapping `start`. The sheet over a dimmed Home, the title, ぜんぶ first, the three part rows with their details, and an empty part greyed out.
2. `02-focus-only`: after tapping `choose-focus`. The first question, with the block label 集中 and a single-segment time bar.
3. `03-closed`: back on Home (quit with ✕ → やめる), open the chooser, tap the dimmed area. The sheet is gone and nothing has started.
4. `04-warmup-only`: if 準備 has moves on this simulator's learner, choose it and answer through: one pass, then まとめ. If 準備 is empty, record that its row is greyed out.

Compare with `docs/superpowers/specs/2026-09-22-choose-part-mockups/choose-part.html`. Fix any layout mismatch in `PartChooser.tsx` styles, rerun `npx jest src/ui/home`, re-shoot, and commit each fix separately.

- [ ] **Step 3: Check the small screen**

On the iPhone SE simulator, open the chooser and screenshot `05-se-chooser`. Check that all four rows and the title are on screen above the home indicator. If the SE display freezes, check `maestro hierarchy` for the four row bounds instead.

- [ ] **Step 4: Bump the build number and commit**

In `app.json`, change `"buildNumber": "7"` to `"buildNumber": "8"`.

```bash
git add app.json
git commit -m "Bump the iOS build number to 8

TestFlight build 8: choosing what to practise, from feature/choose-part.

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 5: Build and upload, following docs/release-ios.md**

```bash
CI=1 npx expo prebuild --platform ios
git checkout package.json        # prebuild rewrites scripts.ios to "expo run:ios"; this repo uses "expo start --ios"
git status --short               # must be clean
rm -rf ios/build/DerivedData ios/build/LearningAbacus.xcarchive
```

Archive with the exact `xcodebuild archive …` command from `docs/release-ios.md` step 3. It takes about 15 minutes; run it in the background and capture the log to `$SCRATCH/archive.log`. Expected: `** ARCHIVE SUCCEEDED **`.

Check the archive before uploading:

```bash
APP=ios/build/LearningAbacus.xcarchive/Products/Applications/LearningAbacus.app
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Info.plist"     # expect 8
for fw in $(otool -L "$APP/LearningAbacus" | sed -n 's|.*@rpath/\([^/]*\.framework\)/.*|\1|p'); do
  [ -d "$APP/Frameworks/$fw" ] || echo "MISSING: $fw — do not upload"
done
python3 -c "b=open('$APP/main.jsbundle','rb').read(); print('なにを練習しますか'.encode('utf-16-le') in b, b'choose-focus' in b)"   # expect True True
```

Expected: build 8, no `MISSING`, and `True True`. Then run the `xcodebuild -exportArchive …` command from `docs/release-ios.md` step 4. Expected: `Upload succeeded` and `** EXPORT SUCCEEDED **`. Three missing-dSYM warnings are expected.

- [ ] **Step 6: Wait for processing**

Poll every 45 s, for up to 30 min, with the polling script until the line for version `8` shows `VALID`. If it shows `INVALID` or `FAILED`, stop and report it.

- [ ] **Step 7: Mark the spec and commit**

Change the spec's Status line to `Status: Implemented on feature/choose-part (TestFlight build 8)`.

```bash
git add docs/superpowers/specs/2026-09-22-choose-part-design.md
git commit -m "docs: mark choosing what to practise as implemented

Co-Authored-By: <your model> <noreply@anthropic.com>"
```

- [ ] **Step 8: Push, open the PR, report**

Push `feature/choose-part` and open a PR against `main`. Report the test counts, the screenshots, any fixes, build 8's state and the PR link. Do not merge; the owner merges.
