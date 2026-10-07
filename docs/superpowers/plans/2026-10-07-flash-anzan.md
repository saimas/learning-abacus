# フラッシュ暗算 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add フラッシュ暗算 as a sixth kind on Home's grid: five numbers flash one at a time, the beads follow the running total after each of the first four, and the learner adds the fifth on the beads and answers, in runs like every other kind.

**Architecture:** A flash problem is its own type, `FlashProblem` (`{ op: 'flash', digits, terms }`), beside `MitoriProblem` under a shared `TermsProblem` union with an `isTermsProblem` guard, rather than widening `MitoriProblem`'s op: everything that means 見取算 alone (its signed generator, its `TermColumn` prompt, the `MitoriProblem`-typed tests) keeps meaning exactly that, and only the code the two share (answer, start, key, steps, sections) takes `TermsProblem`. The flash is a list of timed frames played by a `useFlash` hook inside `QuestionView` (which already owns locking, 手順を見る and the answer), drawn in the prompt's place by `FlashPrompt` through `renderPrompt` (which now also learns whether the step panel is open and which number is on show), with the beads jumping through a new `jump` prop on `Abacus`. `RunRunner` only tells the card on top it is uncovered (`revealed`, as it tells `RunResults`) and times points from the submission's `flashEndedAt`; the kind joins `OPERATIONS` (Home, the progress table, routes, stored ids) last, once it plays, so no commit has a Home cell that plays a half-built flash.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2 (`useEffectEvent`; the React Compiler is on in `app.json`), expo-router, TypeScript strict with `noUncheckedIndexedAccess`, Jest via jest-expo with @testing-library/react-native v13 (fake timers; `jest.now()` reads the fake clock), eslint-plugin-react-hooks v7.

**Spec:** `docs/superpowers/specs/2026-10-07-flash-anzan-design.md` — read it before starting; this plan argues from it and it is the binding authority.

## Global Constraints

- `Operation` gains `'flash'`, `OPERATIONS` lists it after `'mitori'`, and `OPERATION_SYMBOL.flash` is 「フ」.
- A flash problem has 見取算's shape: `{ op: 'flash', digits, terms }`, five terms, every term added (all positive). It is not a `PairOperation`.
- Generation: five numbers, each drawn from the size's range (1けた 1–9, 2けた 10–99, 3けた 100–999). Problems are distinct by their terms, as 見取算's are.
- The answer is the sum of the five. Rods: digits + 1, as 見取算 (5 × 999 = 4995 fits four rods).
- The steps are 見取算's column moves played number after number, all additions: the soroban starts with the first number set, and each later number is one section.
- The exercise: `expected` is the sum of all five; the learner's beads start at the sum of the first four (`start`), the soroban the flash leaves them on. The step replay (`states`) is 見取算's, from the first number set.
- `problemTargetMs` is computed as for 見取算 (every move of the column).
- Timing constants: `FLASH_LEAD_MS = 600`, `FLASH_SHOW_MS = 700`, `FLASH_GAP_MS = 300`. The flash lasts `FLASH_LEAD_MS + 5 × FLASH_SHOW_MS + 4 × FLASH_GAP_MS` (5.3 s).
- A fixed pace of about one number a second, the same at every level; the fading beads are what makes it harder.
- Each of the first four numbers shows for 0.7 s and disappears; the beads then jump (no animation) to the running total, and after 0.3 s the next number appears. The fifth flashes alone; the beads stay on the total of the first four.
- While the numbers play, the beads take no taps and こたえる and もどす are off. 手順を見る stays offered: opening it ends the flash at once, and an answer after it is "with help". The numbers cannot be replayed.
- Start: the flash starts when the card is uncovered, not while it is underneath the card swiping off. The first card of a run starts at once.
- The clock: the answer time used for points runs from the end of the flash to こたえる, not from the card being uncovered.
- 戻る shows the problem fresh: playing again from the start.
- Strings: the kind's name ja フラッシュ暗算, en Flash (「2けたのフラッシュ暗算、まだ」, "2-digit flash, not yet"); the counter 「1/5」; the end-of-flash announcement 「こたえてください」 / "Your answer"; the prompt 「フラッシュ暗算、5口」 / "Flash, 5 numbers". Each number is announced as it appears (「47」).
- No やりかた tile and no lesson for フラッシュ暗算.
- 見取算 behaves byte-for-byte as before: its tests pass unchanged, except where a test told a pair from a 見取算 problem by `p.op === 'mitori'` (now `isTermsProblem(p)`, and the pair-kind filter also leaves out `'flash'`) in `problem.test.ts` / `divisionWalk.test.ts` (Task 1), and the table row position its test assumes (Task 8).
- No `Animated.timing` other than the run's card swipe may use `duration: 300` (`ROLL_SWIPE_MS`): the swipe tests find the swipe by that duration. `FLASH_GAP_MS` is also 300 and must only ever drive a `setTimeout`.
- Queries for elements hidden from VoiceOver pass `{ includeHiddenElements: true }` (the repo's tests call it `hidden`).
- House style: no semicolons, single quotes, 2-space indent; comments say why and cite "Spec (flash) §N"; match the surrounding comment density.
- Every string goes in both `src/i18n/ja.ts` and `src/i18n/en.ts` (`Strings = typeof ja`; `en` must match).
- Commit messages: a sentence-case summary like the repo's history, then a blank line and exactly these two lines: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh`.
- Checks: `npx jest <path>` per task; `npm test && npm run typecheck && npm run lint` before each commit. `npm run typecheck` is what proves no exhaustive `switch (problem.op)` was missed (Jest's Babel transform does not typecheck).

## Review Focus

1. **A flash card laid underneath while the answered card swipes off**: its flash must not start (no number, nothing announced, soroban at 0) until the swipe ends; the first number appears 0.6 s after uncovering. Test in Task 7 (`starts the next card’s flash only once it is uncovered`).
2. **戻る pressed mid-flash**: the problem before must play fresh from its lead (soroban 0, こたえる off), and the card left must fire nothing more. Tests in Task 7 (`plays a problem gone back to afresh…`) and Task 4 (`fires nothing once unmounted`).
3. **✕ confirmed mid-flash, or the screen left mid-flash**: the card swipes off to the results with its flash frozen where it was and silent, `onEnd` once; nothing fires after unmount. Tests in Task 7 (`stops a flash where it is when ✕…`), Task 4 (`holds its frame while covered…`, `fires nothing once unmounted`) and Task 6 (`says nothing more once gone mid-flash`).
4. **手順を見る opened mid-flash**: the flash ends at once and for good (no later number, no 「こたえてください」), the panel opens on the first number, とじる leaves the beads free on the first four's total, and the answer counts with help. Tests in Task 6 (`ends the flash at once on 手順を見る…`) and Task 7 (`records an answer after 手順を見る mid-flash…`).
5. **The clock**: an answer at the bead target after the 5.3 s flash must earn the whole speed bonus, timed from the flash's end, not from the card being uncovered. Tests in Task 6 (`says when its flash ended…`) and Task 7 (`times the answer for points from the end of the flash`).

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/domain/problem.ts` | modify | `'flash'`, `TermsOperation`, `FlashProblem`, `TermsProblem`, `isTermsProblem`, `FLASH_TERMS`, generation, answer, start, key, steps, sections; `OPERATIONS` gains it in Task 8 |
| `src/domain/exercise.ts` | modify | A flash problem's `start`: the first four numbers' total |
| `src/domain/lessons.ts` | modify | `tryProblem` narrows with `isTermsProblem` |
| `src/i18n/ja.ts`, `src/i18n/en.ts` | modify | The kind's name and prompt (Task 1); `columnReading`, `flashCounter`, `flashAnswer` (Task 5) |
| `src/ui/abacus/Bead.tsx`, `Rod.tsx`, `Abacus.tsx` | modify | `jump`: beads jump to a new value instead of sliding |
| `src/ui/session/useFlash.ts` | create | The timing constants, `flashFrames`, `useFlash` |
| `src/ui/flash/FlashPrompt.tsx` | create | The flashed number and its counter in the prompt's place, the column's height always held; the column once the panel is open |
| `src/ui/session/QuestionView.tsx` | modify | `flash` prop: playing then answering, locks, 手順を見る ends it, announcements, `Submission.flashEndedAt`, `PromptState` for `renderPrompt` |
| `src/ui/round/ProblemQuestion.tsx` | modify | `revealed`; a flash problem's `flash` and `FlashPrompt` |
| `src/ui/round/RunRunner.tsx` | modify | Tells the card on top it is revealed; times points from `flashEndedAt` |
| `README.md` | modify | Describe フラッシュ暗算 |
| `src/ui/session/useFlash.test.ts`, `src/ui/flash/FlashPrompt.test.tsx`, `src/ui/round/ProblemQuestion.test.tsx` | create | Tests for the new units |

---

### Task 1: Add フラッシュ暗算 problems to the domain

**Files:**
- Modify: `src/domain/problem.ts`, `src/domain/lessons.ts`, `src/i18n/ja.ts`, `src/i18n/en.ts`
- Test: `src/domain/problem.test.ts`, `src/domain/lessons.test.ts`, `src/domain/divisionWalk.test.ts` (one narrowing), `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```ts
  // problem.ts
  export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'mitori' | 'flash'
  export type TermsOperation = 'mitori' | 'flash'
  export type PairOperation = Exclude<Operation, TermsOperation>
  export type FlashProblem = { op: 'flash'; digits: Digits; terms: number[] }
  export type TermsProblem = MitoriProblem | FlashProblem
  export type Problem = PairProblem | TermsProblem
  export const FLASH_TERMS = 5
  export function isTermsProblem(problem: Problem): problem is TermsProblem
  // OPERATION_SYMBOL.flash === 'フ'; generateProblems({ op: 'flash', digits }, n, random) gives FlashProblems;
  // answerOf, startOf, problemKey, problemSteps, problemSections, problemStates, problemTargetMs take one.
  // OPERATIONS is NOT changed here (Task 8).
  // ja.ts / en.ts: OP_NAME.flash ('フラッシュ暗算' / 'Flash');
  // problemPrompt(flash) === 'フラッシュ暗算、5口' / 'Flash, 5 numbers'
  ```

- [ ] **Step 1: Write the failing tests**

In `src/domain/problem.test.ts`:

1. In the import from `'./problem'`, add `FLASH_TERMS,` after `divisorFirstDigit,`, `isTermsProblem,` after `isPracticeId,`, and `type FlashProblem,` after `type Digits,`.
2. Below the `mitori` helper (`function mitori(digits: Digits, terms: number[]): MitoriProblem { … }`), add:

```ts
function flash(digits: Digits, terms: number[]): FlashProblem {
  return { op: 'flash', digits, terms }
}
```

3. In `describe('generateProblems', …)`, the pair-kind test now has to step past flash problems too (TypeScript no longer narrows a non-見取算 problem to a pair). Replace

```ts
  it.each(PRACTICE_KINDS.filter((kind) => kind.op !== 'mitori'))('gives 10 distinct problems of the right size for %o', (kind) => {
    const problems = generateProblems(kind, 10, seeded(7))
    expect(problems).toHaveLength(10)
    expect(new Set(problems.map((p) => (p.op === 'mitori' ? p.terms.join(',') : `${p.a},${p.b}`))).size).toBe(10)
    for (const p of problems) {
      if (p.op === 'mitori') throw new Error('expected a two-number problem')
```

with

```ts
  it.each(PRACTICE_KINDS.filter((kind) => kind.op !== 'mitori' && kind.op !== 'flash'))('gives 10 distinct problems of the right size for %o', (kind) => {
    const problems = generateProblems(kind, 10, seeded(7))
    expect(problems).toHaveLength(10)
    expect(new Set(problems.map((p) => (isTermsProblem(p) ? p.terms.join(',') : `${p.a},${p.b}`))).size).toBe(10)
    for (const p of problems) {
      if (isTermsProblem(p)) throw new Error('expected a two-number problem')
```

4. In `it('works a large sample of 3けた problems down to their quotients', …)`, replace `      if (p.op === 'mitori') throw new Error('expected a division')` with `      if (isTermsProblem(p)) throw new Error('expected a division')`.
5. In `it('has a symbol for every operation', …)`, replace the expectation with:

```ts
    expect(OPERATION_SYMBOL).toEqual({ add: '＋', sub: '−', mul: '×', div: '÷', mitori: '±', flash: 'フ' })
```

6. In `describe('problemKey', …)`, add after the 見取算 line:

```ts
    expect(problemKey(flash(1, [7, 3, 2, 8, 4]))).toBe('7,3,2,8,4')
```

7. Insert this block right after the closing `})` of `describe('見取算', …)` (before the comment `// Spec (core rounds) §11, the owner (2026-09-27/28): 手順を見る groups a`):

```ts
// Spec (flash) §3: 見取算's shape, five numbers, every one added. The first
// starts on the soroban for the steps; each later one is worked onto it,
// one section a number.
describe('フラッシュ暗算', () => {
  const example = flash(2, [47, 30, 23, 61, 19])

  it('adds up the five numbers, starting from the first on N + 1 rods', () => {
    expect(answerOf(example)).toBe(180)
    expect(startOf(example)).toBe(47)
    expect(rodsFor(example)).toBe(3)
    expect(rodsFor({ op: 'flash', digits: 3 })).toBe(4)
  })

  it('has a symbol of its own, and five numbers', () => {
    expect(OPERATION_SYMBOL.flash).toBe('フ')
    expect(FLASH_TERMS).toBe(5)
  })

  it('is a list of numbers, as 見取算 is, not a pair', () => {
    expect(isTermsProblem(example)).toBe(true)
    expect(isTermsProblem(mitori(2, [47, 30, -23, 61, -19]))).toBe(true)
    expect(isTermsProblem(problem('add', 47, 85))).toBe(false)
  })

  it('works each later number onto the soroban as an addition, tagged with its number', () => {
    const groups = problemSteps(example)
    expect(groups.map((g) => (g.kind === 'column' ? `${g.term}:${g.place}` : g.kind))).toEqual([
      '1:1',
      '1:0',
      '2:1',
      '2:0',
      '3:1',
      '3:0',
      '4:1',
      '4:0',
    ])
    const directions = groups.flatMap((g) => (g.kind === 'column' && g.atom !== null ? [g.atom.direction] : []))
    expect(directions.length).toBeGreaterThan(0)
    expect(directions.every((direction) => direction === 'add')).toBe(true)
    expectReplaysTo(example)
  })

  it('makes each later number a section, with the running total before and after it', () => {
    expect(problemSections(example)).toEqual([
      { kind: 'number', value: 30, before: 47, after: 77, groups: [0, 1] },
      { kind: 'number', value: 23, before: 77, after: 100, groups: [2, 3] },
      { kind: 'number', value: 61, before: 100, after: 161, groups: [4, 5] },
      { kind: 'number', value: 19, before: 161, after: 180, groups: [6, 7] },
    ])
  })

  it('reaches 4995 on four rods', () => {
    expectReplaysTo(flash(3, [999, 999, 999, 999, 999]))
  })

  // Spec (flash) §3: as for 見取算, every move of the column, so points
  // scale with the whole problem's work.
  it("targets each digit move's time plus typing the total, as 見取算 does", () => {
    const moves = problemSteps(example).reduce(
      (sum, g) => (g.kind === 'column' && g.atom !== null ? sum + latencyTargetMs(classify(g.atom), 900) : sum),
      0,
    )
    expect(problemTargetMs(example, 900)).toBe(moves + 3 * TYPING_ALLOWANCE_MS)
  })

  // Spec (flash) §3: five numbers, each from the size's range, all added,
  // problems distinct by their terms.
  it.each([1, 2, 3] as const)('generates five %i-digit numbers, all added, distinct by their terms', (digits) => {
    const problems = generateProblems({ op: 'flash', digits }, 200, seeded(digits))
    expect(problems).toHaveLength(200)
    expect(new Set(problems.map(problemKey)).size).toBe(200)
    for (const p of problems) {
      if (p.op !== 'flash') throw new Error('expected a フラッシュ暗算 problem')
      expect(p.digits).toBe(digits)
      expect(p.terms).toHaveLength(FLASH_TERMS)
      for (const term of p.terms) {
        expect(term).toBeGreaterThanOrEqual(10 ** (digits - 1))
        expect(term).toBeLessThanOrEqual(10 ** digits - 1)
      }
      expectReplaysTo(p)
    }
  })

  it('draws from the whole of the size’s range', () => {
    const terms = generateProblems({ op: 'flash', digits: 1 }, 200, seeded(3)).flatMap((p) => (isTermsProblem(p) ? p.terms : []))
    expect(Math.min(...terms)).toBe(1)
    expect(Math.max(...terms)).toBe(9)
  })

  it('generates the same numbers for the same seed', () => {
    const kind = { op: 'flash', digits: 2 } as const
    expect(generateProblems(kind, 10, seeded(5))).toEqual(generateProblems(kind, 10, seeded(5)))
  })
})
```

In `src/domain/divisionWalk.test.ts`: add `isTermsProblem,` to the import from `'./problem'` (after `generateProblems,`), and replace `        if (p.op === 'mitori') throw new Error('expected a division')` with `        if (isTermsProblem(p)) throw new Error('expected a division')`.

In `src/domain/lessons.test.ts`, in `it('opens a lesson before × and ÷ rounds only', …)`, add after the 見取算 line:

```ts
    // Spec (flash) §2: no new technique, so no lesson.
    expect(lessonForKind({ op: 'flash', digits: 2 })).toBeNull()
```

and in `it('finds a lesson by its id, and nothing for anything else', …)` add `    expect(isLessonId('flash:2')).toBe(false)` after the `mitori:2` line.

In `src/i18n/catalogs.test.ts`: change `import type { MitoriProblem, StepSection } from '@/domain/problem'` to `import type { FlashProblem, MitoriProblem, StepSection } from '@/domain/problem'`, and add right after `it('prompts a 見取算 column as one sentence', …)` (inside `describe('multi-digit strings', …)`):

```ts
  // Spec (flash) §2, §5: the kind's name wherever operations are named, and
  // its prompt as VoiceOver reads it: its count, never its numbers.
  it('names フラッシュ暗算 and prompts it by its count', () => {
    const numbers: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }
    expect(ja.problemPrompt(numbers)).toBe('フラッシュ暗算、5口')
    expect(en.problemPrompt(numbers)).toBe('Flash, 5 numbers')
    expect(ja.practiceCellLabel({ op: 'flash', digits: 2 }, 'unseen')).toBe('2けたのフラッシュ暗算、まだ')
    expect(en.practiceCellLabel({ op: 'flash', digits: 2 }, 'unseen')).toBe('2-digit flash, not yet')
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/domain/problem.test.ts src/domain/lessons.test.ts src/domain/divisionWalk.test.ts src/i18n/catalogs.test.ts`
Expected: FAIL — `isTermsProblem is not a function` (problem.test.ts, divisionWalk.test.ts), `OPERATION_SYMBOL.flash` undefined, generated flash problems have no `terms` (drawn as pairs), and `ja.problemPrompt(numbers)` returns undefined.

- [ ] **Step 3: The domain**

In `src/domain/problem.ts`:

1. Replace the header comment and types

```ts
// Spec (multi-digit ＋ − and ×) §3: practice of two numbers of the same
// size, chosen as an operation and a digit count. For ÷ (spec: division §1)
// the size is the divisor's and the quotient's: a ÷ problem is a × problem
// run backwards, a the dividend and b the divisor. 見取算 (spec: 見取算 §3) is
// a column of numbers instead of two: its terms are signed, the first always
// positive.
export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'mitori'
export type PairOperation = Exclude<Operation, 'mitori'>
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`
export type PairProblem = { op: PairOperation; digits: Digits; a: number; b: number }
export type MitoriProblem = { op: 'mitori'; digits: Digits; terms: number[] }
export type Problem = PairProblem | MitoriProblem
```

with

```ts
// Spec (multi-digit ＋ − and ×) §3: practice of two numbers of the same
// size, chosen as an operation and a digit count. For ÷ (spec: division §1)
// the size is the divisor's and the quotient's: a ÷ problem is a × problem
// run backwards, a the dividend and b the divisor. 見取算 (spec: 見取算 §3) is
// a column of numbers instead of two: its terms are signed, the first always
// positive. フラッシュ暗算 (spec (flash) §3) has 見取算's shape, every number
// added. It is a type of its own, so whatever means 見取算 alone (its signs,
// its column prompt) still does, and what the two share takes TermsProblem.
export type Operation = 'add' | 'sub' | 'mul' | 'div' | 'mitori' | 'flash'
export type TermsOperation = 'mitori' | 'flash'
export type PairOperation = Exclude<Operation, TermsOperation>
export type Digits = 1 | 2 | 3
export type PracticeKind = { op: Operation; digits: Digits }
export type PracticeId = `${Operation}:${Digits}`
export type PairProblem = { op: PairOperation; digits: Digits; a: number; b: number }
export type MitoriProblem = { op: 'mitori'; digits: Digits; terms: number[] }
export type FlashProblem = { op: 'flash'; digits: Digits; terms: number[] }
export type TermsProblem = MitoriProblem | FlashProblem
export type Problem = PairProblem | TermsProblem
```

2. Replace `export const OPERATION_SYMBOL: Record<Operation, string> = { add: '＋', sub: '−', mul: '×', div: '÷', mitori: '±' }` with

```ts
export const OPERATION_SYMBOL: Record<Operation, string> = {
  add: '＋',
  sub: '−',
  mul: '×',
  div: '÷',
  mitori: '±',
  // Spec (flash) §2: the sixth row's head.
  flash: 'フ',
}
```

3. After `export const MITORI_TERMS = 5`, add:

```ts

// Spec (flash) §1: five numbers at every size, classic フラッシュ暗算's 5口.
export const FLASH_TERMS = 5
```

4. Replace

```ts
// What makes two problems of one kind the same problem.
export function problemKey(problem: Problem): string {
  return problem.op === 'mitori' ? problem.terms.join(',') : `${problem.a},${problem.b}`
}
```

with

```ts
// A 見取算 or フラッシュ暗算 problem: a list of numbers rather than two.
export function isTermsProblem(problem: Problem): problem is TermsProblem {
  return problem.op === 'mitori' || problem.op === 'flash'
}

// What makes two problems of one kind the same problem.
export function problemKey(problem: Problem): string {
  return isTermsProblem(problem) ? problem.terms.join(',') : `${problem.a},${problem.b}`
}
```

5. In `answerOf`, replace

```ts
    case 'mitori':
      return problem.terms.reduce((sum, term) => sum + term, 0)
```

with

```ts
    case 'mitori':
    case 'flash':
      return problem.terms.reduce((sum, term) => sum + term, 0)
```

6. In the comment above `rodsFor`, replace `1998), and so does 見取算: five N-digit numbers never pass 5 × 999 = 4995. A` with `1998), and so do 見取算 and フラッシュ暗算: five N-digit numbers never pass 5 × 999 = 4995. A` (the code is unchanged: `default: return kind.digits + 1`).
7. Replace

```ts
// What the soroban shows before the first step: a for ＋ − (and the dividend
// for ÷), nothing for ×, and a 見取算 column's first number.
export function startOf(problem: Problem): number {
  switch (problem.op) {
    case 'mul':
      return 0
    case 'mitori':
      return problem.terms[0] ?? 0
```

with

```ts
// What the soroban shows before the first step: a for ＋ − (and the dividend
// for ÷), nothing for ×, and a 見取算 or フラッシュ暗算 list's first number.
export function startOf(problem: Problem): number {
  switch (problem.op) {
    case 'mul':
      return 0
    case 'mitori':
    case 'flash':
      return problem.terms[0] ?? 0
```

8. In the comment above `generateProblems`, replace `// is drawn whole and drawn again if it breaks its rules.` with

```ts
// is drawn whole and drawn again if it breaks its rules. A フラッシュ暗算
// list (spec (flash) §3) is five numbers, all added, never drawn again.
```

and replace `    const problem = kind.op === 'mitori' ? drawMitori(kind.digits, random) : drawPair(kind.op, kind.digits, random)` with

```ts
    const problem =
      kind.op === 'mitori'
        ? drawMitori(kind.digits, random)
        : kind.op === 'flash'
          ? drawFlash(kind.digits, random)
          : drawPair(kind.op, kind.digits, random)
```

9. Right after the closing `}` of `drawMitori`, add:

```ts

// Spec (flash) §3: five N-digit numbers, every one added. The running total
// only grows, so the soroban can always show it, and the last number always
// moves the beads off the first four's total the learner starts from, so
// こたえる (QuestionView's `moved`) can always be pressed.
function drawFlash(digits: Digits, random: () => number): FlashProblem {
  const low = 10 ** (digits - 1)
  const high = 10 ** digits - 1
  return { op: 'flash', digits, terms: Array.from({ length: FLASH_TERMS }, () => randomInt(random, low, high)) }
}
```

10. Replace

```ts
// borrow from, as it does for a > b in ＋ −.
function mitoriSteps(problem: MitoriProblem): StepGroup[] {
```

with

```ts
// borrow from, as it does for a > b in ＋ −. Spec (flash) §3: a フラッシュ暗算
// list's steps are the same column moves, every one an addition.
function termSteps(problem: TermsProblem): StepGroup[] {
```

11. In `problemSteps`, replace

```ts
    case 'mitori':
      return mitoriSteps(problem)
```

with

```ts
    case 'mitori':
    case 'flash':
      return termSteps(problem)
```

12. Replace

```ts
// The signed number a column group works: its 見取算 number, or a ＋ − problem's
// b, taken off for −. Only those two kinds have column groups.
function numberOf(problem: Problem, term: number | undefined): number {
  switch (problem.op) {
    case 'mitori':
      return problem.terms[term ?? 0] ?? 0
```

with

```ts
// The signed number a column group works: its 見取算 or フラッシュ暗算 number,
// or a ＋ − problem's b, taken off for −. Only those kinds have column groups.
function numberOf(problem: Problem, term: number | undefined): number {
  switch (problem.op) {
    case 'mitori':
    case 'flash':
      return problem.terms[term ?? 0] ?? 0
```

`OPERATIONS` stays `['add', 'sub', 'mul', 'div', 'mitori']` until Task 8.

In `src/domain/lessons.ts`:

1. Add `isTermsProblem,` to the import from `'./problem'` (after `generateProblems,`).
2. Replace

```ts
// Spec §4: the lesson a × or ÷ round opens first, its own 桁数's; ＋ and −
// open none.
```

with

```ts
// Spec §4: the lesson a × or ÷ round opens first, its own 桁数's; ＋, −,
// 見取算 and フラッシュ暗算 (spec (flash) §2: no new technique) open none.
```

3. Replace `    if (problem !== undefined && problem.op !== 'mitori' && !same(problem)) return problem` with `    if (problem !== undefined && !isTermsProblem(problem) && !same(problem)) return problem`.

- [ ] **Step 4: The kind's name and prompt**

In `src/i18n/ja.ts`, replace `const OP_NAME: Record<Operation, string> = { add: 'たし算', sub: 'ひき算', mul: 'かけ算', div: 'わり算', mitori: '見取算' }` with

```ts
const OP_NAME: Record<Operation, string> = {
  add: 'たし算',
  sub: 'ひき算',
  mul: 'かけ算',
  div: 'わり算',
  mitori: '見取算',
  flash: 'フラッシュ暗算',
}
```

and in `problemPrompt`, replace

```ts
          .join('、')}。`
    }
  },
```

with

```ts
          .join('、')}。`
      // Spec (flash) §5: its count, never its numbers: they flash.
      case 'flash':
        return `フラッシュ暗算、${problem.terms.length}口`
    }
  },
```

In `src/i18n/en.ts`, replace

```ts
  mitori: 'Columns',
}
```

with

```ts
  mitori: 'Columns',
  flash: 'Flash',
}
```

and in `problemPrompt`, replace

```ts
          .join(' ')
      default:
```

with

```ts
          .join(' ')
      case 'flash':
        return `Flash, ${problem.terms.length} numbers`
      default:
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx jest src/domain src/i18n`
Expected: PASS (the 見取算 tests included).

- [ ] **Step 6: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/domain/problem.ts src/domain/problem.test.ts src/domain/lessons.ts src/domain/lessons.test.ts src/domain/divisionWalk.test.ts src/i18n/ja.ts src/i18n/en.ts src/i18n/catalogs.test.ts
git commit -m "Add フラッシュ暗算 problems: five numbers, all added

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 2: Answer a flash problem from the first four numbers' total

**Files:**
- Modify: `src/domain/exercise.ts`
- Test: `src/domain/exercise.test.ts`

**Interfaces:**
- Consumes: `type FlashProblem`, `startOf`, `answerOf`, `problemStates` (Task 1).
- Produces: `exerciseForProblem(flash)` gives `{ rods: digits + 1, start: terms[0..3] summed, expected: all five summed, states: problemStates(flash) (from the first number), groupStarts: one per later number that moves a bead }`. Every other kind is unchanged.

- [ ] **Step 1: Write the failing test**

In `src/domain/exercise.test.ts`, change `import { problemStates, problemSteps, type MitoriProblem } from './problem'` to `import { problemStates, problemSteps, type FlashProblem, type MitoriProblem } from './problem'` and `import { emptySoroban, setValue, type Soroban } from './soroban'` to `import { emptySoroban, readValue, setValue, type Soroban } from './soroban'`. Add inside `describe('exerciseForProblem', …)`, after the 見取算 test:

```ts
  // Spec (flash) §3: the flash leaves the beads on the first four numbers'
  // total; the learner adds the fifth and answers all five's. The steps
  // still replay from the first number, as 見取算's do.
  it('starts a フラッシュ暗算 problem on the first four numbers’ total, and expects all five', () => {
    const problem: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }
    const exercise = exerciseForProblem(problem)
    expect(exercise.rods).toBe(3)
    expect(exercise.start).toBe(161)
    expect(exercise.expected).toBe(180)
    expect(exercise).not.toHaveProperty('onesPlace')
    expect(exercise.states).toEqual(problemStates(problem))
    expect(readValue(exercise.states[0] ?? emptySoroban(3))).toBe(47)
    expect(readValue(exercise.states[exercise.states.length - 1] ?? emptySoroban(3))).toBe(180)
    // One operation per number after the first, as 見取算's.
    expect(exercise.groupStarts).toHaveLength(4)
  })

  it('starts a 3けた flash on four rods when its four numbers pass 999', () => {
    expect(exerciseForProblem({ op: 'flash', digits: 3, terms: [999, 999, 999, 999, 999] })).toMatchObject({
      rods: 4,
      start: 3996,
      expected: 4995,
    })
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/domain/exercise.test.ts`
Expected: FAIL — `start` is 47 (the first number), expected 161; and 999, expected 3996.

- [ ] **Step 3: The start**

In `src/domain/exercise.ts`, replace

```ts
  return {
    rods: rodsFor(problem),
    start: startOf(problem),
```

with

```ts
  return {
    rods: rodsFor(problem),
    start: answerStart(problem),
```

and add right after the closing `}` of `exerciseForProblem`:

```ts

// Where the learner's beads start. Spec (flash) §3: a flash problem is
// answered from the soroban its flash leaves, the first four numbers'
// total, and the learner works the last number onto it. Its steps
// (`states`) still start from the first number set (startOf), as 見取算's.
function answerStart(problem: Problem): number {
  if (problem.op !== 'flash') return startOf(problem)
  return problem.terms.slice(0, -1).reduce((sum, term) => sum + term, 0)
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/domain/exercise.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/domain/exercise.ts src/domain/exercise.test.ts
git commit -m "Answer a フラッシュ暗算 problem from the first four numbers' total

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 3: Let the beads jump to a new value

**Files:**
- Modify: `src/ui/abacus/Bead.tsx`, `src/ui/abacus/Rod.tsx`, `src/ui/abacus/Abacus.tsx`
- Test: `src/ui/abacus/Abacus.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Bead` prop `jump?: boolean`, `Rod` prop `jump?: boolean`, `Abacus` prop `jump?: boolean` (default false everywhere): with it, a bead set to a new place is there at once instead of sliding for `BEAD_SLIDE_MS`.

- [ ] **Step 1: Write the failing test**

In `src/ui/abacus/Abacus.test.tsx`, change the first import to `import { act, fireEvent, render, screen, within } from '@testing-library/react-native'`, add `import { BEAD_SLIDE_MS } from './Bead'` after `import { Abacus, tintsFor } from './Abacus'`, and append at the end of the file:

```tsx
// Spec (flash) §2: the flash's running totals jump onto the beads with no
// slide; every other change slides as it always has.
describe('Abacus jumping', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const heavenTop = () => topOf(screen.getAllByTestId('bead-heaven')[0])
  function passTime(ms: number) {
    for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
  }

  it('puts the beads on a new value at once with jump', () => {
    render(<Abacus soroban={emptySoroban(1)} fade={0} jump />)
    const before = heavenTop()
    screen.rerender(<Abacus soroban={setValue(emptySoroban(1), 7)} fade={0} jump />)
    expect(heavenTop()).toBe(BEAM_TOP - BEAD_HEIGHT)
    expect(heavenTop()).not.toBe(before)
  })

  it('slides them without it, as always', () => {
    render(<Abacus soroban={emptySoroban(1)} fade={0} />)
    const before = heavenTop()
    screen.rerender(<Abacus soroban={setValue(emptySoroban(1), 7)} fade={0} />)
    expect(heavenTop()).toBe(before)
    passTime(BEAD_SLIDE_MS + 50)
    expect(heavenTop()).toBe(BEAM_TOP - BEAD_HEIGHT)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/abacus/Abacus.test.tsx`
Expected: FAIL in `puts the beads on a new value at once with jump` — the heaven bead is still at its old top right after the rerender (it slides).

- [ ] **Step 3: Bead, Rod and Abacus**

In `src/ui/abacus/Bead.tsx`:

1. Replace `// Slides rather than jumps when its place changes. A new place mid-slide` with `// Slides rather than jumps when its place changes, unless told to jump. A new place mid-slide`.
2. Replace

```tsx
  tint,
}: {
  kind: 'heaven' | 'earth'
  top: number
  scale?: number
  tint?: BeadTint
}) {
```

with

```tsx
  tint,
  jump = false,
}: {
  kind: 'heaven' | 'earth'
  top: number
  scale?: number
  tint?: BeadTint
  // Spec (flash) §2: to a new place at once, as the flash's running totals
  // go onto the beads.
  jump?: boolean
}) {
```

3. Replace

```tsx
  useEffect(() => {
    if (shown.current === top) return
    shown.current = top
    const slide = Animated.timing(y, { toValue: top, duration: BEAD_SLIDE_MS, useNativeDriver: false })
    slide.start()
    return () => slide.stop()
  }, [top, y])
```

with

```tsx
  useEffect(() => {
    if (shown.current === top) return
    shown.current = top
    // setValue also stops a slide still on its way.
    if (jump) {
      y.setValue(top)
      return
    }
    const slide = Animated.timing(y, { toValue: top, duration: BEAD_SLIDE_MS, useNativeDriver: false })
    slide.start()
    return () => slide.stop()
  }, [top, y, jump])
```

In `src/ui/abacus/Rod.tsx`:

1. Replace

```tsx
  easeOpacity = false,
  tints = [],
```

with

```tsx
  easeOpacity = false,
  jump = false,
  tints = [],
```

2. Replace

```tsx
  // Ease to a new beadOpacity instead of jumping (EasedFadeLayer).
  easeOpacity?: boolean
```

with

```tsx
  // Ease to a new beadOpacity instead of jumping (EasedFadeLayer).
  easeOpacity?: boolean
  // Put the beads in new places at once instead of sliding (Bead).
  jump?: boolean
```

3. Replace

```tsx
      <Bead kind="heaven" top={tops.heaven} scale={scale} tint={tintOf(tints, { kind: 'heaven' })} />
      {tops.earth.map((top, i) => (
        <Bead key={i} kind="earth" top={top} scale={scale} tint={tintOf(tints, { kind: 'earth', index: i })} />
      ))}
```

with

```tsx
      <Bead kind="heaven" top={tops.heaven} scale={scale} tint={tintOf(tints, { kind: 'heaven' })} jump={jump} />
      {tops.earth.map((top, i) => (
        <Bead
          key={i}
          kind="earth"
          top={top}
          scale={scale}
          tint={tintOf(tints, { kind: 'earth', index: i })}
          jump={jump}
        />
      ))}
```

In `src/ui/abacus/Abacus.tsx`:

1. Replace

```tsx
  easeFade = false,
}: {
```

with

```tsx
  easeFade = false,
  jump = false,
}: {
```

2. Replace

```tsx
  // Spec (runs) §5: ease the beads to a new fade level instead of jumping.
  easeFade?: boolean
}) {
```

with

```tsx
  // Spec (runs) §5: ease the beads to a new fade level instead of jumping.
  easeFade?: boolean
  // Spec (flash) §2: the beads jump to a new value instead of sliding.
  jump?: boolean
}) {
```

3. Replace `              easeOpacity={easeFade}` with

```tsx
              easeOpacity={easeFade}
              jump={jump}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/ui/abacus`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/ui/abacus/Bead.tsx src/ui/abacus/Rod.tsx src/ui/abacus/Abacus.tsx src/ui/abacus/Abacus.test.tsx
git commit -m "Let the beads jump to a new value instead of sliding

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 4: Play a flash frame by frame

**Files:**
- Create: `src/ui/session/useFlash.ts`
- Test: `src/ui/session/useFlash.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  ```ts
  export const FLASH_LEAD_MS = 600
  export const FLASH_SHOW_MS = 700
  export const FLASH_GAP_MS = 300
  export type FlashFrame = { shown: number | null; total: number }
  export function flashFrames(terms: readonly number[]): { frame: FlashFrame; ms: number }[]
  export function useFlash(options: {
    terms: readonly number[] | undefined
    revealed: boolean
    onShow: (index: number) => void
    onEnd: () => void
  }): { frame: FlashFrame | null; stop: () => void }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/ui/session/useFlash.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native'
import { FLASH_GAP_MS, FLASH_LEAD_MS, FLASH_SHOW_MS, flashFrames, useFlash } from './useFlash'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// 47, 30, 23, 61, 19: the beads follow 47, 77, 100 and 161.
const TERMS = [47, 30, 23, 61, 19]

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

// Spec (flash) §2: 0.6 s, then each number for 0.7 s; after each but the
// last the beads take the total with it, and 0.3 s pass before the next.
describe('flashFrames', () => {
  it('leads, shows each number, and puts the total so far on the beads between them', () => {
    expect(flashFrames(TERMS)).toEqual([
      { frame: { shown: null, total: 0 }, ms: 600 },
      { frame: { shown: 0, total: 0 }, ms: 700 },
      { frame: { shown: null, total: 47 }, ms: 300 },
      { frame: { shown: 1, total: 47 }, ms: 700 },
      { frame: { shown: null, total: 77 }, ms: 300 },
      { frame: { shown: 2, total: 77 }, ms: 700 },
      { frame: { shown: null, total: 100 }, ms: 300 },
      { frame: { shown: 3, total: 100 }, ms: 700 },
      { frame: { shown: null, total: 161 }, ms: 300 },
      // The fifth flashes alone: the beads stay on the first four's total.
      { frame: { shown: 4, total: 161 }, ms: 700 },
    ])
  })

  it('lasts 5.3 s, about one number a second', () => {
    expect([FLASH_LEAD_MS, FLASH_SHOW_MS, FLASH_GAP_MS]).toEqual([600, 700, 300])
    expect(flashFrames(TERMS).reduce((sum, { ms }) => sum + ms, 0)).toBe(5_300)
  })
})

describe('useFlash', () => {
  function play(revealed = true) {
    const onShow = jest.fn()
    const onEnd = jest.fn()
    const hook = renderHook(
      (props: { revealed: boolean }) => useFlash({ terms: TERMS, revealed: props.revealed, onShow, onEnd }),
      { initialProps: { revealed } },
    )
    return { ...hook, onShow, onEnd }
  }

  it('plays each frame for its time, then ends', () => {
    const { result, onShow, onEnd } = play()
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(FLASH_LEAD_MS - 1)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(1)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
    expect(onShow).toHaveBeenLastCalledWith(0)
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toEqual({ shown: null, total: 47 })
    advance(FLASH_GAP_MS)
    expect(result.current.frame).toEqual({ shown: 1, total: 47 })
    for (let k = 0; k < 3; k++) {
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
    }
    expect(result.current.frame).toEqual({ shown: 4, total: 161 })
    expect(onShow.mock.calls.map(([index]) => index)).toEqual([0, 1, 2, 3, 4])
    expect(onEnd).not.toHaveBeenCalled()
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
    advance(10_000)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  // Spec (flash) §4: not while the card lies underneath the one swiping off.
  it('waits until revealed', () => {
    const { result, rerender, onShow } = play(false)
    advance(5_000)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    expect(onShow).not.toHaveBeenCalled()
    rerender({ revealed: true })
    advance(FLASH_LEAD_MS - 1)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(1)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
  })

  // Review focus: a card swiped off mid-flash (✕ confirmed) is covered
  // again; its flash holds where it is and says nothing more.
  it('holds its frame while covered, and goes on from it if uncovered again', () => {
    const { result, rerender, onShow } = play()
    advance(FLASH_LEAD_MS)
    rerender({ revealed: false })
    advance(5_000)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
    expect(onShow).toHaveBeenCalledTimes(1)
    rerender({ revealed: true })
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toEqual({ shown: null, total: 47 })
  })

  // Spec (flash) §4: 手順を見る ends the flash at once.
  it('ends at once when stopped, and fires nothing after', () => {
    const { result, onShow, onEnd } = play()
    advance(FLASH_LEAD_MS + 100)
    act(() => result.current.stop())
    expect(result.current.frame).toBeNull()
    advance(10_000)
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  // Review focus: the question gone mid-flash (戻る, ✕, leaving the screen).
  it('fires nothing once unmounted', () => {
    const { unmount, onShow, onEnd } = play()
    advance(FLASH_LEAD_MS + 100)
    unmount()
    advance(10_000)
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('is over from the start for a question with no flash', () => {
    const { result } = renderHook(() => useFlash({ terms: undefined, revealed: true, onShow: jest.fn(), onEnd: jest.fn() }))
    expect(result.current.frame).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/session/useFlash.test.ts`
Expected: FAIL, "Cannot find module './useFlash'".

- [ ] **Step 3: The hook**

Create `src/ui/session/useFlash.ts`:

```ts
import { useEffect, useEffectEvent, useState } from 'react'

// Spec (flash) §1, §4: the flash's pace, about one number a second and the
// same at every level: the fading beads are what makes it harder. They only
// ever drive timers, never an Animated.timing: the swipe tests find the card
// swipe by its 300 ms (ROLL_SWIPE_MS), which FLASH_GAP_MS equals.
export const FLASH_LEAD_MS = 600
export const FLASH_SHOW_MS = 700
export const FLASH_GAP_MS = 300

// What the flash shows at a moment: the number on show, by its index in the
// terms, or null before the first and between numbers; and the running
// total the beads show (spec (flash) §2).
export type FlashFrame = { shown: number | null; total: number }

type TimedFrame = { frame: FlashFrame; ms: number }

// Spec (flash) §2: the flash frame by frame, each with how long it lasts.
// The first number appears 0.6 s after the card is uncovered; each shows for
// 0.7 s, and after each but the last the beads take the total with it and
// 0.3 s pass before the next. The last flashes alone, the beads staying on
// the total before it: that step is the learner's.
export function flashFrames(terms: readonly number[]): TimedFrame[] {
  const frames: TimedFrame[] = [{ frame: { shown: null, total: 0 }, ms: FLASH_LEAD_MS }]
  let total = 0
  terms.forEach((term, index) => {
    frames.push({ frame: { shown: index, total }, ms: FLASH_SHOW_MS })
    if (index === terms.length - 1) return
    total += term
    frames.push({ frame: { shown: null, total }, ms: FLASH_GAP_MS })
  })
  return frames
}

// Spec (flash) §4: plays a フラッシュ暗算 problem's flash from its first
// frame while `revealed`: its card uncovered, not lying underneath the card
// swiping off nor on its way off itself. `terms` undefined is no flash.
// `frame` is what is on show, or null once the flash is over, run to its
// end (onEnd) or ended at once by stop() (手順を見る). Each frame's timer
// starts as the frame is shown, so none is cut short; covered again, the
// flash holds its frame; a timer left when the question goes (戻る, ✕,
// leaving) is cleared with it and fires nothing. `onShow` hears each number
// as it appears, by its index in `terms`.
export function useFlash({
  terms,
  revealed,
  onShow,
  onEnd,
}: {
  terms: readonly number[] | undefined
  revealed: boolean
  onShow: (index: number) => void
  onEnd: () => void
}): { frame: FlashFrame | null; stop: () => void } {
  // The question is keyed by problem, so its terms never change under it.
  const [frames] = useState<TimedFrame[]>(() => (terms === undefined ? [] : flashFrames(terms)))
  // The frame on show, an index into frames; frames.length once over.
  const [at, setAt] = useState(0)
  const reached = useEffectEvent((next: number) => {
    setAt(next)
    const shown = frames[next]?.frame.shown
    if (shown !== undefined && shown !== null) onShow(shown)
    if (next === frames.length) onEnd()
  })
  useEffect(() => {
    const ms = frames[at]?.ms
    if (!revealed || ms === undefined) return
    const timer = setTimeout(() => reached(at + 1), ms)
    return () => clearTimeout(timer)
  }, [revealed, at, frames])
  return { frame: frames[at]?.frame ?? null, stop: () => setAt(frames.length) }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/ui/session/useFlash.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/ui/session/useFlash.ts src/ui/session/useFlash.test.ts
git commit -m "Play a flash's numbers frame by frame once its card is uncovered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 5: Draw the flash in the prompt's place

**Files:**
- Create: `src/ui/flash/FlashPrompt.tsx`
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`
- Test: `src/ui/flash/FlashPrompt.test.tsx`, `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes: `TermColumn` (`src/ui/mitori/TermColumn.tsx`), `SHORT_WINDOW_HEIGHT` (`src/ui/abacus/geometry.ts`).
- Produces:
  ```ts
  // ja.ts / en.ts (Strings)
  columnReading: (terms: readonly number[]) => string   // the 見取算 prompt's sentence, now shared
  flashCounter: (index: number, total: number) => string // '1/5'
  flashAnswer: string                                    // 'こたえてください' / 'Your answer'
  // FlashPrompt.tsx
  export const FLASH_FONT_SIZE = 64
  export const FLASH_SHORT_FONT_SIZE = 44
  export function FlashPrompt(props: {
    terms: readonly number[]
    label: string        // 'フラッシュ暗算、5口'
    columnLabel: string  // columnReading(terms)
    shown: number | null // index of the number on show
    columnShown: boolean // the step panel is open
    activeTerm?: number
  }): JSX.Element
  // testIDs: 'prompt' (the box, or the column), 'flash-number', 'flash-counter', 'flash-column-space' (hidden)
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/i18n/catalogs.test.ts`:

```ts
// Spec (flash) §2, §5.
describe('フラッシュ暗算 strings', () => {
  it('counts the numbers as they flash', () => {
    expect([ja.flashCounter(1, 5), en.flashCounter(5, 5)]).toEqual(['1/5', '5/5'])
  })

  it('asks for the answer once the flash is over', () => {
    expect([ja.flashAnswer, en.flashAnswer]).toEqual(['こたえてください', 'Your answer'])
  })

  // The column a flash shows with its steps reads as a 見取算 prompt does.
  it('reads a column of numbers as one sentence', () => {
    expect(ja.columnReading([47, 30, 23, 61, 19])).toBe('47、たす30、たす23、たす61、たす19。')
    expect(en.columnReading([47, 30, 23, 61, 19])).toBe('47 + 30 + 23 + 61 + 19')
    expect(ja.columnReading([47, 85, -23])).toBe('47、たす85、ひく23。')
    expect(en.columnReading([47, 85, -23])).toBe('47 + 85 − 23')
  })
})
```

Create `src/ui/flash/FlashPrompt.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { FLASH_FONT_SIZE, FLASH_SHORT_FONT_SIZE, FlashPrompt } from './FlashPrompt'

const TERMS = [47, 30, 23, 61, 19]
const LABEL = 'フラッシュ暗算、5口'
const COLUMN = '47、たす30、たす23、たす61、たす19。'

// The column held under the flash is hidden from VoiceOver, which the
// queries skip unless asked.
const hidden = { includeHiddenElements: true }

let restoreWindow = () => {}
afterEach(() => {
  restoreWindow()
  restoreWindow = () => {}
})

function windowOf(width: number, height: number) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in TermColumn.test.tsx: `require` reaches the module object the component's own import reads from
  const reactNative = require('react-native')
  const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width, height, scale: 2, fontScale: 1 })
  restoreWindow = () => spy.mockRestore()
}

function prompt(shown: number | null, columnShown = false, activeTerm?: number) {
  return (
    <FlashPrompt
      terms={TERMS}
      label={LABEL}
      columnLabel={COLUMN}
      shown={shown}
      columnShown={columnShown}
      activeTerm={activeTerm}
    />
  )
}

describe('FlashPrompt', () => {
  // Spec (flash) §2: large, with a small counter.
  it('shows the number on show, large, with its counter', () => {
    render(prompt(0))
    expect(screen.getByTestId('flash-number').props.children).toBe('47')
    expect(screen.getByTestId('flash-counter').props.children).toBe('1/5')
    screen.rerender(prompt(4))
    expect(screen.getByTestId('flash-number').props.children).toBe('19')
    expect(screen.getByTestId('flash-counter').props.children).toBe('5/5')
  })

  // Before, between and after the numbers; they cannot be seen again.
  it('shows no number when none is on show', () => {
    render(prompt(null))
    expect(screen.queryByTestId('flash-number')).toBeNull()
    expect(screen.queryByTestId('flash-counter')).toBeNull()
    for (const term of TERMS) expect(screen.queryByText(String(term))).toBeNull()
  })

  // The soroban under the prompt must not move as numbers come and go or
  // the panel opens, so the column's height is always held.
  it('holds the column’s height, drawn unseen and hidden from VoiceOver', () => {
    render(prompt(2))
    const room = screen.getByTestId('flash-column-space', hidden)
    expect(StyleSheet.flatten(room.props.style).opacity).toBe(0)
    expect(room.props.accessibilityElementsHidden).toBe(true)
    expect(room.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(within(room).getByTestId('term-4', hidden)).toBeTruthy()
    expect(screen.queryByTestId('term-4')).toBeNull()
  })

  // Spec (flash) §5: VoiceOver names the problem; the numbers are announced.
  it('reads as the problem’s name, not its numbers', () => {
    render(prompt(1))
    const box = screen.getByTestId('prompt')
    expect(box.props.accessible).toBe(true)
    expect(box.props.accessibilityLabel).toBe(LABEL)
  })

  // Spec (flash) §2: the steps show the five numbers as 見取算's column.
  it('shows the five numbers as a column once the panel is open, lit and read as one sentence', () => {
    render(prompt(null, true, 2))
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe(COLUMN)
    expect(screen.queryByTestId('flash-column-space', hidden)).toBeNull()
    const lit = within(screen.getByTestId('term-2')).getByText('23')
    expect(StyleSheet.flatten(lit.props.style).color).toBe(colors.accent)
  })

  it('shows the column, not a number, whenever the panel is open', () => {
    render(prompt(1, true))
    expect(screen.queryByTestId('flash-number')).toBeNull()
    expect(screen.getByTestId('term-1')).toBeTruthy()
  })

  it('flashes large, and smaller on a short window', () => {
    windowOf(402, 874)
    const { unmount } = render(prompt(0))
    expect(StyleSheet.flatten(screen.getByTestId('flash-number').props.style).fontSize).toBe(FLASH_FONT_SIZE)
    unmount()
    windowOf(375, 667)
    render(prompt(0))
    expect(StyleSheet.flatten(screen.getByTestId('flash-number').props.style).fontSize).toBe(FLASH_SHORT_FONT_SIZE)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/ui/flash src/i18n/catalogs.test.ts`
Expected: FAIL — "Cannot find module './FlashPrompt'"; `ja.flashCounter is not a function`.

- [ ] **Step 3: The strings**

In `src/i18n/ja.ts`:

1. Add right above `export const ja = {`:

```ts
// Spec (見取算) §4: a column of numbers read as one sentence, signs and all,
// since the column writes no plus signs. A フラッシュ暗算 problem's column
// reads the same once its steps show it (spec (flash) §2).
function columnReading(terms: readonly number[]): string {
  return `${terms
    .map((term, index) => (index === 0 ? `${term}` : `${term < 0 ? 'ひく' : 'たす'}${Math.abs(term)}`))
    .join('、')}。`
}

```

2. In `problemPrompt`, replace

```ts
      case 'mitori':
        return `${problem.terms
          .map((term, index) => (index === 0 ? `${term}` : `${term < 0 ? 'ひく' : 'たす'}${Math.abs(term)}`))
          .join('、')}。`
```

with

```ts
      case 'mitori':
        return columnReading(problem.terms)
```

3. Replace

```ts
  columnLine,
  sectionHeading,
```

with

```ts
  columnReading,
  // Spec (flash) §2, §5: the counter with a flashed number, and what
  // VoiceOver hears once the flash is over and the beads are the learner's.
  flashCounter: (index: number, total: number) => `${index}/${total}`,
  flashAnswer: 'こたえてください',
  columnLine,
  sectionHeading,
```

In `src/i18n/en.ts`:

1. Add right above `export const en: Strings = {`:

```ts
// As ja's: the signs the column leaves unwritten, read aloud.
function columnReading(terms: readonly number[]): string {
  return terms.map((term, index) => (index === 0 ? `${term}` : `${term < 0 ? '−' : '+'} ${Math.abs(term)}`)).join(' ')
}

```

2. In `problemPrompt`, replace

```ts
      case 'mitori':
        return problem.terms
          .map((term, index) => (index === 0 ? `${term}` : `${term < 0 ? '−' : '+'} ${Math.abs(term)}`))
          .join(' ')
```

with

```ts
      case 'mitori':
        return columnReading(problem.terms)
```

3. Replace

```ts
  columnLine,
  sectionHeading,
```

with

```ts
  columnReading,
  flashCounter: (index, total) => `${index}/${total}`,
  flashAnswer: 'Your answer',
  columnLine,
  sectionHeading,
```

- [ ] **Step 4: The prompt**

Create `src/ui/flash/FlashPrompt.tsx`:

```tsx
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useStrings } from '@/i18n'
import { SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { colors, fonts, fontSizes } from '@/ui/theme'

// A flashed number's size: large (spec (flash) §2), and within the five
// lines of the column whose height the prompt holds: about 190 pt at the
// column's 28 pt, about 150 pt at its 22 pt on a 375 × 667 phone.
export const FLASH_FONT_SIZE = 64
export const FLASH_SHORT_FONT_SIZE = 44

// Spec (flash) §2, §4: a フラッシュ暗算 problem in the prompt's place. While
// the flash plays, the number on show (`shown`, an index into `terms`),
// large, under its counter (「1/5」), or nothing before and between
// numbers. Once it is over, nothing: the numbers are not seen again, as in
// real フラッシュ暗算, until the step panel opens (`columnShown`: 手順を見る,
// or a miss's review), where they stand as 見取算's column, the number
// stepped to lit (`activeTerm`) and read as one sentence (`columnLabel`).
// Whatever it shows, it takes that column's height: the column is drawn
// unseen underneath and hidden from VoiceOver, so the soroban below never
// moves as numbers come and go or the panel opens (the owner, 2026-09-24,
// found the soroban moving distracting). VoiceOver reads the box as the
// problem's name (`label`); each number is announced as it appears
// (QuestionView).
export function FlashPrompt({
  terms,
  label,
  columnLabel,
  shown,
  columnShown,
  activeTerm,
}: {
  terms: readonly number[]
  label: string
  columnLabel: string
  shown: number | null
  columnShown: boolean
  activeTerm?: number
}) {
  const strings = useStrings()
  const { height } = useWindowDimensions()
  if (columnShown) return <TermColumn terms={terms} label={columnLabel} activeTerm={activeTerm} />
  const term = shown === null ? undefined : terms[shown]
  const fontSize = height < SHORT_WINDOW_HEIGHT ? FLASH_SHORT_FONT_SIZE : FLASH_FONT_SIZE
  return (
    <View testID="prompt" accessible accessibilityLabel={label}>
      <View
        testID="flash-column-space"
        style={styles.unseen}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TermColumn terms={terms} label={columnLabel} />
      </View>
      {shown === null || term === undefined ? null : (
        <View style={styles.flash} pointerEvents="none">
          <Text testID="flash-counter" style={styles.counter}>
            {strings.flashCounter(shown + 1, terms.length)}
          </Text>
          <Text testID="flash-number" style={[styles.number, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}>
            {String(term)}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Holds the column's height without showing it.
  unseen: { opacity: 0 },
  // Over the unseen column, centred in it.
  flash: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  counter: { fontSize: fontSizes.small, color: colors.muted },
  number: { fontFamily: fonts.display, fontVariant: ['tabular-nums'], color: colors.ink },
})
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx jest src/ui/flash src/ui/mitori src/i18n`
Expected: PASS (the 見取算 prompt tests included: `columnReading` gives the same sentences).

- [ ] **Step 6: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/ui/flash src/i18n/ja.ts src/i18n/en.ts src/i18n/catalogs.test.ts
git commit -m "Draw a flashed number in the prompt's place, holding the column's height

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 6: Flash a problem's numbers before it can be answered

**Files:**
- Modify: `src/ui/session/QuestionView.tsx`, `src/ui/round/ProblemQuestion.tsx`
- Create (test): `src/ui/round/ProblemQuestion.test.tsx`

**Interfaces:**
- Consumes: `useFlash`, `FLASH_*` (Task 4); `FlashPrompt`, `strings.columnReading`, `strings.flashAnswer` (Task 5); `Abacus`'s `jump` (Task 3); `exerciseForProblem(flash).start` = the first four's total (Task 2).
- Produces:
  ```ts
  // QuestionView.tsx
  export type Submission = { correct: boolean; latencyMs: number | null; t: number; assisted: boolean; flashEndedAt?: number }
  export type PromptState = { panelOpen: boolean; flashShown: number | null }
  // QuestionView props: renderPrompt?: (activeStep: number | undefined, state: PromptState) => ReactNode
  //                     flash?: { terms: readonly number[]; revealed: boolean }
  // ProblemQuestion props: revealed?: boolean (default true)
  ```
  `flashEndedAt` is present only for a flash problem: the moment its flash ended (run out, or ended by 手順を見る).

- [ ] **Step 1: Write the failing test**

Create `src/ui/round/ProblemQuestion.test.tsx`:

```tsx
import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import type { FlashProblem } from '@/domain/problem'
import { BEAD_SLIDE_MS } from '@/ui/abacus/Bead'
import { setBeads, textOf } from '@/ui/session/testing'
import { FLASH_GAP_MS, FLASH_LEAD_MS, FLASH_SHOW_MS } from '@/ui/session/useFlash'
import { colors } from '@/ui/theme'
import { ProblemQuestion } from './ProblemQuestion'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The beads follow 47, 77, 100 and 161; the answer is 180. Two digits:
// three rods.
const numbers: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }

// The column held under the flash is hidden from VoiceOver.
const hidden = { includeHiddenElements: true }

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

// Lets `ms` pass a frame at a time, as a phone renders.
function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// The whole flash, frame by frame: each frame's time starts once it is shown.
function playThrough() {
  advance(FLASH_LEAD_MS)
  for (let k = 0; k < 4; k++) {
    advance(FLASH_SHOW_MS)
    advance(FLASH_GAP_MS)
  }
  advance(FLASH_SHOW_MS)
}

// The three rods, highest place first.
const rods = () => [0, 1, 2].map((i) => screen.getByTestId(`rod-${i}`).props.accessibilityValue.text).join('')
const flashed = () => screen.queryByTestId('flash-number')?.props.children ?? null
const counter = () => screen.queryByTestId('flash-counter')?.props.children ?? null
// A rod takes taps and VoiceOver's adjustments only while the beads are free.
const beadsFree = () => screen.getByTestId('rod-2').props.accessibilityRole === 'adjustable'
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true
const HINT = '珠をタップして動かします'

type Options = { fade?: FadeLevel; revealed?: boolean }

function question(options: Options, onSubmit: jest.Mock) {
  return (
    <ProblemQuestion
      problem={numbers}
      fade={options.fade ?? 0}
      revealed={options.revealed ?? true}
      shownAt={0}
      // The fake clock, so a flash's end is the moment its last timer fired.
      now={() => jest.now()}
      onSubmit={onSubmit}
      onMoveOn={jest.fn()}
    />
  )
}

function renderFlash(options: Options = {}) {
  const onSubmit = jest.fn()
  render(question(options, onSubmit))
  return { onSubmit, rerender: (next: Options) => screen.rerender(question(next, onSubmit)) }
}

// Spec (flash) §2: the numbers flash one at a time in the prompt's place and
// the beads follow the running total; the last step is the learner's.
describe('ProblemQuestion with a フラッシュ暗算 problem', () => {
  it('flashes each number in turn, the beads following the running total', () => {
    renderFlash()
    // The card arrives with the soroban at 0 and nothing flashed yet.
    expect([flashed(), counter(), rods()]).toEqual([null, null, '000'])
    advance(FLASH_LEAD_MS)
    expect([flashed(), counter(), rods()]).toEqual(['47', '1/5', '000'])
    advance(FLASH_SHOW_MS)
    expect([flashed(), counter(), rods()]).toEqual([null, null, '047'])
    advance(FLASH_GAP_MS)
    expect([flashed(), counter(), rods()]).toEqual(['30', '2/5', '047'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('077')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter()]).toEqual(['23', '3/5'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('100')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter()]).toEqual(['61', '4/5'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('161')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter(), rods()]).toEqual(['19', '5/5', '161'])
    // The fifth flashes alone: the beads stay on the first four's total.
    advance(FLASH_SHOW_MS)
    expect([flashed(), counter(), rods()]).toEqual([null, null, '161'])
  })

  it('jumps the beads to each total, with no slide', () => {
    renderFlash()
    const heavenTop = () =>
      StyleSheet.flatten(within(screen.getByTestId('rod-2')).getByTestId('bead-heaven').props.style).top
    const before = heavenTop()
    advance(FLASH_LEAD_MS)
    advance(FLASH_SHOW_MS)
    // 47: the ones rod shows 7, its heaven bead down at once.
    const jumped = heavenTop()
    expect(jumped).not.toBe(before)
    passTime(BEAD_SLIDE_MS + 50)
    expect(heavenTop()).toBe(jumped)
  })

  it('takes no taps and no answer while the numbers play, and both once they are over', () => {
    const { onSubmit } = renderFlash()
    expect(beadsFree()).toBe(false)
    expect(disabled('submit')).toBe(true)
    expect(disabled('reset-beads')).toBe(true)
    // The beads take no taps, so no hint says to tap them.
    expect(screen.queryByText(HINT)).toBeNull()
    fireEvent(screen.getByTestId('rod-2'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    fireEvent.press(screen.getByTestId('submit'))
    expect(rods()).toBe('000')
    expect(onSubmit).not.toHaveBeenCalled()
    // 手順を見る stays offered.
    expect(screen.getByTestId('steps-open')).toBeTruthy()

    playThrough()
    expect(beadsFree()).toBe(true)
    expect(disabled('reset-beads')).toBe(false)
    expect(screen.getByText(HINT)).toBeTruthy()
    // こたえる waits for the beads to move off the four's total.
    expect(disabled('submit')).toBe(true)
    setBeads(screen.getByTestId, 180, 3)
    expect(disabled('submit')).toBe(false)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: false }))
  })

  // Spec (flash) §4: the flash starts when the card is uncovered, not while
  // it lies underneath the card swiping off.
  it('waits for its card to be uncovered', () => {
    const { rerender } = renderFlash({ revealed: false })
    advance(5_000)
    expect([flashed(), rods()]).toEqual([null, '000'])
    expect(beadsFree()).toBe(false)
    rerender({ revealed: true })
    advance(FLASH_LEAD_MS - 1)
    expect(flashed()).toBeNull()
    advance(1)
    expect(flashed()).toBe('47')
  })

  it('says each number as it appears, then asks for the answer', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderFlash()
      announce.mockClear()
      playThrough()
      expect(announce.mock.calls.map(([said]) => said)).toEqual(['47', '30', '23', '61', '19', 'こたえてください'])
    } finally {
      announce.mockRestore()
    }
  })

  // Review focus: 手順を見る mid-flash ends it at once, and for good.
  it('ends the flash at once on 手順を見る, with the panel open on the five numbers', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { onSubmit } = renderFlash()
      advance(FLASH_LEAD_MS)
      expect(flashed()).toBe('47')
      announce.mockClear()
      fireEvent.press(screen.getByTestId('steps-open'))
      expect([flashed(), counter()]).toEqual([null, null])
      // The steps show every number, as 見取算's column, from the first.
      expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、たす23、たす61、たす19。')
      expect(screen.getByTestId('term-4')).toBeTruthy()
      expect(rods()).toBe('047')
      // Nothing more flashes, and nothing more is said.
      advance(10_000)
      expect(flashed()).toBeNull()
      expect(announce).not.toHaveBeenCalled()
      // Closed: the beads are the learner's, on the four's total.
      fireEvent.press(screen.getByTestId('steps-close'))
      expect(rods()).toBe('161')
      expect(beadsFree()).toBe(true)
      expect(flashed()).toBeNull()
      setBeads(screen.getByTestId, 180, 3)
      // Past the guard after とじる.
      advance(500)
      fireEvent.press(screen.getByTestId('submit'))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: true }))
    } finally {
      announce.mockRestore()
    }
  })

  // Spec (flash) §2: the numbers are not seen again until the steps show them.
  it('shows nothing in the prompt’s place once the flash is over, holding the column’s height', () => {
    renderFlash()
    playThrough()
    expect(flashed()).toBeNull()
    expect(screen.queryByText('19')).toBeNull()
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('フラッシュ暗算、5口')
    expect(screen.getByTestId('term-4', hidden)).toBeTruthy()
  })

  // Spec (flash) §2: the review shows the five numbers as a column, and how
  // the total builds number by number.
  it('shows the five numbers as a column under a miss, lit as its steps are stepped through', () => {
    renderFlash()
    playThrough()
    setBeads(screen.getByTestId, 170, 3)
    fireEvent.press(screen.getByTestId('submit'))
    // F0 coaches: the panel opens with the ✕, on the first number.
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、たす23、たす61、たす19。')
    expect(textOf(screen.getByTestId('correction-heading-0'))).toBe('30をたす　47 → 77')
    expect(rods()).toBe('047')
    fireEvent.press(screen.getByTestId('step-next'))
    const thirty = within(screen.getByTestId('term-1')).getByText('30')
    expect(StyleSheet.flatten(thirty.props.style).color).toBe(colors.accent)
  })

  // Review focus, spec (flash) §4: the answer's clock runs from the flash's end.
  it('says when its flash ended, for the answer’s clock', () => {
    const { onSubmit } = renderFlash()
    const uncovered = jest.now()
    playThrough()
    const ended = jest.now()
    expect(ended - uncovered).toBe(5_300)
    advance(2_000)
    setBeads(screen.getByTestId, 180, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, t: ended + 2_000, flashEndedAt: ended }),
    )
  })

  // Spec (flash) §2: from level 3 the beads that follow along fade too.
  it('draws the beads it follows at the level’s fade', () => {
    renderFlash({ fade: 3 })
    advance(FLASH_LEAD_MS)
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('047')
    for (const layer of within(screen.getByTestId('soroban-wrap')).getAllByTestId('fade-layer')) {
      expect(StyleSheet.flatten(layer.props.style).opacity).toBe(0.35)
    }
  })

  // Review focus: the question gone mid-flash (戻る, ✕, leaving) says nothing more.
  it('says nothing more once gone mid-flash', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderFlash()
      advance(FLASH_LEAD_MS)
      screen.unmount()
      announce.mockClear()
      expect(() => advance(10_000)).not.toThrow()
      expect(announce).not.toHaveBeenCalled()
    } finally {
      announce.mockRestore()
    }
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/round/ProblemQuestion.test.tsx`
Expected: FAIL — no `flash-number` ever appears (a flash problem still shows the text prompt 「フラッシュ暗算、5口」), the soroban starts at '161' instead of '000', and the rods take taps from the start.

- [ ] **Step 3: QuestionView**

In `src/ui/session/QuestionView.tsx`:

1. Replace `import { useStepper } from './useStepper'` with

```ts
import { useFlash } from './useFlash'
import { useStepper } from './useStepper'
```

2. Replace

```ts
// steps with 手順を見る before answering (spec (core rounds) §5).
export type Submission = { correct: boolean; latencyMs: number | null; t: number; assisted: boolean }
```

with

```ts
// steps with 手順を見る before answering (spec (core rounds) §5).
// `flashEndedAt` is when a フラッシュ暗算 problem's flash ended, which its
// answer is timed from (spec (flash) §4); absent for every other question.
export type Submission = {
  correct: boolean
  latencyMs: number | null
  t: number
  assisted: boolean
  flashEndedAt?: number
}
```

3. Replace `export type AfterAnswer = { leaveLabel: string; onLeave: () => void; againLabel: string }` with

```ts
export type AfterAnswer = { leaveLabel: string; onLeave: () => void; againLabel: string }

// What a problem drawn in the prompt's place (renderPrompt) is drawn for,
// besides the step on show: whether the step panel is open, and a
// フラッシュ暗算 problem's number on show (spec (flash) §4), by its index in
// the problem's terms, or null (between numbers, after the flash, or no
// flash at all).
export type PromptState = { panelOpen: boolean; flashShown: number | null }
```

4. Replace

```ts
  easeFade,
  missNote,
}: {
```

with

```ts
  easeFade,
  missNote,
  flash,
}: {
```

5. Replace

```ts
  // Spec (見取算) §4: a problem drawn in place of the text prompt — a 見取算
  // column — following the same `activeStep` as the step lines. `prompt`
  // is not drawn when this is given. Drawn above the soroban, where the text
  // prompt stands for every other question.
  renderPrompt?: (activeStep: number | undefined) => ReactNode
```

with

```ts
  // Spec (見取算) §4: a problem drawn in place of the text prompt — a 見取算
  // column, or a フラッシュ暗算 problem's flash (spec (flash) §2) — following
  // the same `activeStep` as the step lines, and told whether the panel is
  // open and which number is flashing (PromptState). `prompt` is not drawn
  // when this is given. Drawn above the soroban, where the text prompt
  // stands for every other question.
  renderPrompt?: (activeStep: number | undefined, state: PromptState) => ReactNode
```

6. Replace

```ts
  easeFade?: boolean
  missNote?: string
}) {
```

with

```ts
  easeFade?: boolean
  missNote?: string
  // Spec (flash) §4: a フラッシュ暗算 problem's numbers, played in the
  // prompt's place before the question can be answered (useFlash), and
  // whether its card is uncovered, which the flash waits for. Absent for
  // every other question, which is answered from the start.
  flash?: { terms: readonly number[]; revealed: boolean }
}) {
```

7. Replace

```ts
  const guardFrom = useRef<number | null>(null)

  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
```

with

```ts
  const guardFrom = useRef<number | null>(null)
  // Spec (flash) §4: when the flash ended, run to its end or ended by
  // 手順を見る, which the answer is timed from (Submission).
  const [flashEndedAt, setFlashEndedAt] = useState<number | null>(null)
  // Spec (flash) §2, §4: the flash, until it runs out or 手順を見る ends
  // it. VoiceOver hears each number as it appears, then is asked for the
  // answer; 手順を見る's panel speaks for itself, so ending there says
  // nothing.
  const flashPlay = useFlash({
    terms: flash?.terms,
    revealed: flash?.revealed ?? true,
    onShow: (index) => {
      const term = flash?.terms[index]
      if (term !== undefined) AccessibilityInfo.announceForAccessibility(String(term))
    },
    onEnd: () => {
      setFlashEndedAt(now())
      AccessibilityInfo.announceForAccessibility(strings.flashAnswer)
    },
  })
  // While the numbers play the beads show the running total and take no
  // taps, and もどす and こたえる are off (spec (flash) §2).
  const playing = flashPlay.frame !== null

  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // Spec (flash) §2: the running total the flash has reached, which the
  // beads jump to as each number goes; null once the flash is over.
  const flashBeads = flashPlay.frame === null ? null : setValue(emptySoroban(exercise.rods), flashPlay.frame.total)
```

8. Replace `    onSubmit({ correct, latencyMs, t, assisted: assisted.current })` with

```ts
    onSubmit({ correct, latencyMs, t, assisted: assisted.current, ...(flashEndedAt === null ? {} : { flashEndedAt }) })
```

9. Replace

```ts
  function openSteps() {
    assisted.current = true
```

with

```ts
  function openSteps() {
    // Spec (flash) §4: 手順を見る ends a flash at once: the steps show every
    // number, and the question is answered from here on.
    if (playing) {
      setFlashEndedAt(now())
      flashPlay.stop()
    }
    assisted.current = true
```

10. Replace `      renderPrompt(activeStep)` with `      renderPrompt(activeStep, { panelOpen, flashShown: flashPlay.frame?.shown ?? null })`.
11. Replace

```ts
  // The beads take no taps while the question is answered (under review)
  // or while they show the steps before an answer.
  const locked = review !== null || beforeAnswer || answeredRight
```

with

```ts
  // The beads take no taps while the question is answered (under review),
  // while they show the steps before an answer, or while a flash plays
  // (spec (flash) §2).
  const locked = review !== null || beforeAnswer || answeredRight || playing
```

12. Replace

```tsx
        <Abacus
          soroban={stepper.soroban ?? shownBeads}
          fade={shownFade}
          easeFade={easeFade}
```

with

```tsx
        <Abacus
          soroban={stepper.soroban ?? flashBeads ?? shownBeads}
          fade={shownFade}
          easeFade={easeFade}
          jump={playing}
```

13. Replace

```tsx
          from the one-line hint to the taller ◀ ▶ row distracting. */}
```

with

```tsx
          from the one-line hint to the taller ◀ ▶ row distracting. While
          a flash plays the beads take no taps, so no hint says to tap
          them (spec (flash) §2). */}
```

and replace

```tsx
        ) : (
          <Text style={styles.hint}>{strings.beadHint}</Text>
        )}
```

with

```tsx
        ) : playing ? null : (
          <Text style={styles.hint}>{strings.beadHint}</Text>
        )}
```

14. Replace

```tsx
              label={strings.resetBeads}
              onPress={() => setBeads(null)}
            />
          </View>
          <View style={styles.submitSlot}>
            <Button testID="submit" label={strings.answer} disabled={!moved} onPress={submit} />
```

with

```tsx
              label={strings.resetBeads}
              disabled={playing}
              onPress={() => setBeads(null)}
            />
          </View>
          <View style={styles.submitSlot}>
            <Button testID="submit" label={strings.answer} disabled={playing || !moved} onPress={submit} />
```

- [ ] **Step 4: ProblemQuestion**

In `src/ui/round/ProblemQuestion.tsx`:

1. Replace `import { TermColumn } from '@/ui/mitori/TermColumn'` with

```ts
import { FlashPrompt } from '@/ui/flash/FlashPrompt'
import { TermColumn } from '@/ui/mitori/TermColumn'
```

2. Replace

```ts
// One problem as a question: QuestionView with the problem's correction
// card, its 見取算 column or its operand board. A round and a lesson's
// やってみよう ask problems the same way.
```

with

```ts
// One problem as a question: QuestionView with the problem's correction
// card, its 見取算 column, its フラッシュ暗算 flash or its operand board. A
// round and a lesson's やってみよう ask problems the same way.
```

3. Replace

```ts
  easeFade,
  missNote,
}: {
  problem: Problem
```

with

```ts
  easeFade,
  missNote,
  revealed = true,
}: {
  problem: Problem
```

4. Replace

```ts
  easeFade?: boolean
  missNote?: string
}) {
  const strings = useStrings()
```

with

```ts
  easeFade?: boolean
  missNote?: string
  // Spec (flash) §4: whether the card is uncovered, which a flash waits
  // for. A card on top at rest is; a lesson's やってみよう never asks a flash.
  revealed?: boolean
}) {
  const strings = useStrings()
```

5. Replace

```tsx
      // Spec (見取算) §2: a 見取算 problem is a column in the prompt's place,
      // lighting the number the move stepped to belongs to.
      renderPrompt={
        problem.op === 'mitori'
          ? (activeStep) => {
            const group = groupOf(activeStep)
            return (
              <TermColumn
                terms={problem.terms}
                label={strings.problemPrompt(problem)}
                activeTerm={group?.kind === 'column' ? group.term : undefined}
              />
            )
          }
          : undefined
      }
```

with

```tsx
      // Spec (見取算) §2: a 見取算 problem is a column in the prompt's place,
      // lighting the number the move stepped to belongs to. Spec (flash) §2:
      // a フラッシュ暗算 problem flashes its numbers there, and shows them as
      // that column once the step panel is open.
      renderPrompt={
        problem.op === 'mitori'
          ? (activeStep) => {
            const group = groupOf(activeStep)
            return (
              <TermColumn
                terms={problem.terms}
                label={strings.problemPrompt(problem)}
                activeTerm={group?.kind === 'column' ? group.term : undefined}
              />
            )
          }
          : problem.op === 'flash'
            ? (activeStep, { panelOpen, flashShown }) => {
              const group = groupOf(activeStep)
              return (
                <FlashPrompt
                  terms={problem.terms}
                  label={strings.problemPrompt(problem)}
                  columnLabel={strings.columnReading(problem.terms)}
                  shown={flashShown}
                  columnShown={panelOpen}
                  activeTerm={group?.kind === 'column' ? group.term : undefined}
                />
              )
            }
            : undefined
      }
```

6. Replace

```tsx
      easeFade={easeFade}
      missNote={missNote}
    />
```

with

```tsx
      easeFade={easeFade}
      missNote={missNote}
      flash={problem.op === 'flash' ? { terms: problem.terms, revealed } : undefined}
    />
```

If `npm run lint` asks for a different indentation of the nested ternary, run `npx eslint --fix src/ui/round/ProblemQuestion.tsx` and keep its result.

- [ ] **Step 5: Run them to see them pass**

Run: `npx jest src/ui/round src/ui/session`
Expected: PASS (every existing QuestionView and RunRunner test included: a question with no `flash` plays nothing and is answered from the start, as before).

- [ ] **Step 6: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/ui/session/QuestionView.tsx src/ui/round/ProblemQuestion.tsx src/ui/round/ProblemQuestion.test.tsx
git commit -m "Flash a フラッシュ暗算 problem's numbers before it can be answered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 7: Play フラッシュ暗算 in runs

**Files:**
- Modify: `src/ui/round/RunRunner.tsx`
- Test: `src/ui/round/RunRunner.test.tsx`

**Interfaces:**
- Consumes: `ProblemQuestion`'s `revealed`, `Submission.flashEndedAt` (Task 6); `FLASH_*` (Task 4); `problemTargetMs` (Task 1); `answerPoints`, `BEAD_SPEED_FACTOR` (`src/domain/score.ts`).
- Produces: no new exports. The card on top at rest gets `revealed`; a card underneath the swipe or swiping off does not. A flash answer's `answerMs` is `t − flashEndedAt`.

- [ ] **Step 1: Write the failing tests**

In `src/ui/round/RunRunner.test.tsx`:

1. Change `import { problemSteps, type MitoriProblem, type Problem } from '@/domain/problem'` to `import { problemSteps, problemTargetMs, type FlashProblem, type MitoriProblem, type Problem } from '@/domain/problem'`, change `import { answerPoints } from '@/domain/score'` to `import { answerPoints, BEAD_SPEED_FACTOR } from '@/domain/score'`, and add `import { FLASH_GAP_MS, FLASH_LEAD_MS, FLASH_SHOW_MS } from '@/ui/session/useFlash'` after `import { setBeads, tintedBeads } from '@/ui/session/testing'`.
2. Insert this block right before the comment `// Spec (card swipe, 2026-09-29): the next problem is already in its place`:

```tsx
// Spec (flash) §2, §4: a フラッシュ暗算 run plays each card's flash once the
// card is uncovered, then takes the total on the beads.
describe('RunRunner with フラッシュ暗算', () => {
  // The beads follow 47, 77, 100 and 161; the answer is 180.
  const numbers: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }
  // 12, 46, 102 and 180; the answer is 270.
  const more: FlashProblem = { op: 'flash', digits: 2, terms: [12, 34, 56, 78, 90] }
  const flashRun: RunOverrides = { kind: { op: 'flash', digits: 2 }, problems: [numbers, more] }
  // The three rods of the card on screen, highest place first.
  const rods = () => [0, 1, 2].map((i) => screen.getByTestId(`rod-${i}`).props.accessibilityValue.text).join('')
  const flashed = () => screen.queryByTestId('flash-number')?.props.children ?? null

  function advance(ms: number) {
    act(() => {
      jest.advanceTimersByTime(ms)
    })
  }

  // The whole flash, frame by frame: each frame's time starts once it is shown.
  function playThrough() {
    advance(FLASH_LEAD_MS)
    for (let k = 0; k < 4; k++) {
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
    }
    advance(FLASH_SHOW_MS)
  }

  // Holds each card swipe in mid-flight until finish(), so a card can lie
  // underneath, or be on its way off, for as long as a test needs.
  function holdSwipes() {
    const timing = Animated.timing
    const held: { finish?: () => void } = {}
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const animation = timing(value, config)
      if (config.duration !== ROLL_SWIPE_MS) return animation
      return {
        ...animation,
        start: (callback) => {
          held.finish = () => callback?.({ finished: true })
        },
      }
    })
    return { finish: () => act(() => held.finish?.()), restore: () => spy.mockRestore() }
  }

  // Answers the first card right, then uncovers the second under the swipe.
  function onToTheSecond(swipes: ReturnType<typeof holdSwipes>) {
    playThrough()
    answerBeads(180)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    swipes.finish()
  }

  it('plays each card’s flash, then takes the total on the beads', () => {
    const swipes = holdSwipes()
    try {
      const { onAttempt } = renderRun(flashRun)
      // The run's first card: nothing swipes over it, so it plays at once.
      expect(rods()).toBe('000')
      advance(FLASH_LEAD_MS)
      expect(flashed()).toBe('47')
      for (let k = 0; k < 4; k++) {
        advance(FLASH_SHOW_MS)
        advance(FLASH_GAP_MS)
      }
      advance(FLASH_SHOW_MS)
      expect([flashed(), rods()]).toEqual([null, '161'])
      answerBeads(180)
      expect(onAttempt).toHaveBeenCalledWith({ id: 'flash:2', correct: true, pace: null, assisted: false, fade: 0 })
      expect(screen.getByTestId('maru')).toBeTruthy()
      passTime(ROLL_HOLD_MS)
      passUntilSwiping()
      swipes.finish()
      playThrough()
      expect(rods()).toBe('180')
      answerBeads(260)
      expect(onAttempt).toHaveBeenLastCalledWith({ id: 'flash:2', correct: false, pace: null, assisted: false, fade: 0 })
      // A miss reviews the five numbers as a column.
      expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('12、たす34、たす56、たす78、たす90。')
    } finally {
      swipes.restore()
    }
  })

  // Review focus: the next card is laid underneath while the answered one
  // swipes off; its flash must wait until it is uncovered.
  it('starts the next card’s flash only once it is uncovered', () => {
    const swipes = holdSwipes()
    try {
      renderRun(flashRun)
      playThrough()
      answerBeads(180)
      passTime(ROLL_HOLD_MS)
      passUntilSwiping()
      // Underneath the card swiping off, however long it takes: the soroban
      // at 0, nothing flashed.
      advance(5_000)
      const below = within(screen.getByTestId('card'))
      expect(below.queryByTestId('flash-number')).toBeNull()
      expect([0, 1, 2].map((i) => below.getByTestId(`rod-${i}`).props.accessibilityValue.text).join('')).toBe('000')
      swipes.finish()
      expect(screen.queryByTestId('card-leaving')).toBeNull()
      advance(FLASH_LEAD_MS - 1)
      expect(flashed()).toBeNull()
      advance(1)
      expect(flashed()).toBe('12')
    } finally {
      swipes.restore()
    }
  })

  // Review focus, spec (flash) §4: the clock runs from the end of the flash;
  // from the card being uncovered, the 5.3 s flash would cost the bonus.
  it('times the answer for points from the end of the flash', () => {
    const { onPoints } = renderRun({ ...flashRun, now: () => jest.now() })
    playThrough()
    // Answered at its bead target exactly: the whole speed bonus.
    const delay = problemTargetMs(numbers, 900) * BEAD_SPEED_FACTOR
    advance(delay)
    answerBeads(180)
    const scored = (answerMs: number) =>
      answerPoints({ problem: numbers, calibrationMs: 900, level: 0, combo: 1, answerMs })
    expect(onPoints).toHaveBeenCalledWith(scored(delay))
    expect(scored(delay)).not.toBe(scored(delay + 5_300))
  })

  // Review focus: 手順を見る mid-flash ends it; the answer is with help.
  it('records an answer after 手順を見る mid-flash as with help, scoring nothing', () => {
    const { onAttempt, onPoints } = renderRun(flashRun)
    advance(FLASH_LEAD_MS)
    fireEvent.press(screen.getByTestId('steps-open'))
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(rods()).toBe('161')
    answerBeads(180)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'flash:2', correct: true, pace: null, assisted: true, fade: 0 })
    expect(onPoints).not.toHaveBeenCalled()
  })

  // Spec (flash) §4: 戻る shows the problem fresh, playing again from the
  // start. Review focus: pressed mid-flash, the card left says nothing more.
  it('plays a problem gone back to afresh, its flash from the start, and stops the one left', () => {
    const swipes = holdSwipes()
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderRun(flashRun)
      onToTheSecond(swipes)
      advance(FLASH_LEAD_MS)
      expect(flashed()).toBe('12')
      announce.mockClear()
      fireEvent.press(screen.getByTestId('go-back'))
      // The run's first problem, as if shown for the first time.
      expect([flashed(), rods()]).toEqual([null, '000'])
      expect(screen.getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
      advance(FLASH_LEAD_MS)
      expect([flashed(), rods()]).toEqual(['47', '000'])
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
      expect([flashed(), rods()]).toEqual(['30', '047'])
      // Only the problem on show speaks: never 34, from the problem left.
      expect(announce.mock.calls.map(([said]) => said)).toEqual(['47', '30'])
    } finally {
      announce.mockRestore()
      swipes.restore()
    }
  })

  // Review focus: ✕ confirmed mid-flash ends on the results once, the card
  // going off with its flash frozen where it was.
  it('stops a flash where it is when ✕ sends its card off to the results', () => {
    const swipes = holdSwipes()
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { onEnd } = renderRun(flashRun)
      onToTheSecond(swipes)
      advance(FLASH_LEAD_MS)
      expect(flashed()).toBe('12')
      announce.mockClear()
      fireEvent.press(screen.getByTestId('quit'))
      expect(onEnd).toHaveBeenCalledTimes(1)
      // On its way off, held there: frozen on 12, and silent.
      advance(5_000)
      expect(within(screen.getByTestId('card-leaving')).getByTestId('flash-number').props.children).toBe('12')
      expect(announce).not.toHaveBeenCalled()
      swipes.finish()
      expect(screen.getByTestId('run-results')).toBeTruthy()
      expect(screen.queryByTestId('card-leaving')).toBeNull()
      expect(onEnd).toHaveBeenCalledTimes(1)
    } finally {
      announce.mockRestore()
      swipes.restore()
    }
  })
})

```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/ui/round/RunRunner.test.tsx -t フラッシュ暗算`
Expected: FAIL in `starts the next card’s flash only once it is uncovered` (the card underneath has already flashed), `times the answer for points from the end of the flash` (points reckoned 5.3 s slower), and `stops a flash where it is when ✕ …` (the leaving card's flash plays on and is announced). The others may already pass: they pin what Task 6 built.

- [ ] **Step 3: The runner**

In `src/ui/round/RunRunner.tsx`:

1. Replace `    function submitted({ correct, assisted, t }: Submission) {` with `    function submitted({ correct, assisted, t, flashEndedAt }: Submission) {`.
2. Replace `        answerMs: t - shownAt,` with

```ts
        // Spec (flash) §4: a flash problem's clock runs from the end of its
        // flash, not from the card being uncovered.
        answerMs: t - (flashEndedAt ?? shownAt),
```

3. Replace

```tsx
    // Underneath the card going off, a new look is still the old one.
    const underneath = leaving !== null && at === index
```

with

```tsx
    // Underneath the card going off, a new look is still the old one.
    const underneath = leaving !== null && at === index
    // Spec (flash) §4: a flash plays only on the card on top, at rest: not
    // underneath the card swiping off, and not on its way off itself (✕
    // confirmed mid-flash), where it holds where it is and says nothing.
    const revealed = leaving === null && at === index
```

4. Replace

```tsx
        missNote={strings.livesLeft(run.lives - 1)}
        shownAt={shownAt}
```

with

```tsx
        missNote={strings.livesLeft(run.lives - 1)}
        revealed={revealed}
        shownAt={shownAt}
```

5. In the comment above `function goBack()`, replace

```ts
  // time, and its clock with it; nothing of the problem left is kept. Its
```

with

```ts
  // time, and its clock with it (a フラッシュ暗算 problem plays its flash
  // again from the start, spec (flash) §4); nothing of the problem left is
  // kept. Its
```

(the comment's following lines stay as they are).

- [ ] **Step 4: Run them to see them pass**

Run: `npx jest src/ui/round`
Expected: PASS (every existing RunRunner test included).

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/ui/round/RunRunner.tsx src/ui/round/RunRunner.test.tsx
git commit -m "Play フラッシュ暗算 in runs: start on uncovering, score from the flash's end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 8: Put フラッシュ暗算 on Home and the progress table

**Files:**
- Modify: `src/domain/problem.ts`
- Test: `src/domain/problem.test.ts`, `src/domain/run.test.ts`, `src/storage/progressStore.test.ts`, `src/ui/progress/PracticeTable.test.tsx`, `__tests__/home.test.tsx`, `__tests__/progress-screen.test.tsx`, `__tests__/round-screen.test.tsx`

**Interfaces:**
- Consumes: everything above; `PracticeTable` already draws a row per `OPERATIONS` entry, and `parsePracticeId` / `isPracticeId` (routes, stored practices and best runs) read `PRACTICE_KINDS`.
- Produces: `OPERATIONS = ['add', 'sub', 'mul', 'div', 'mitori', 'flash']`, so `PRACTICE_KINDS` has 18 kinds and `flash:1`–`flash:3` are known ids everywhere.

- [ ] **Step 1: Write the failing tests**

In `src/domain/problem.test.ts`, in `describe('practice ids', …)`: rename `it('names the fifteen kinds', …)` to `it('names the eighteen kinds', …)` and add `'flash:1',`, `'flash:2',`, `'flash:3',` after `'mitori:3',` in its list; in `it('parses only the ids it knows', …)` add at the end:

```ts
    expect(parsePracticeId('flash:2')).toEqual({ op: 'flash', digits: 2 })
    expect(isPracticeId('flash:4')).toBe(false)
```

In `src/domain/run.test.ts`, in `describe('nextProblem', …)`, add `    { op: 'flash', digits: 1 },` after `    { op: 'mitori', digits: 1 },`.

In `src/storage/progressStore.test.ts`, add after `it('keeps 見取算 records and drops a size that does not exist', …)`:

```ts
  // Spec (flash) §2: stored ids accept フラッシュ暗算's three sizes.
  it('keeps フラッシュ暗算 records and best runs, and drops a size that does not exist', async () => {
    const good = { fade: 3, consecutiveCorrect: 0, consecutiveWrong: 1, lastPractisedAt: 7 }
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        ...emptyProgress(),
        practices: { 'flash:1': good, 'flash:4': good },
        bestRuns: { 'flash:3': 420, 'flash:0': 10 },
      }),
    )
    const loaded = await loadProgress()
    expect(loaded.practices).toEqual({ 'flash:1': good })
    expect(loaded.bestRuns).toEqual({ 'flash:3': 420 })
  })
```

In `src/ui/progress/PracticeTable.test.tsx`, in `it('has a ± row for 見取算 below ÷', …)` replace `    expect(cells.slice(-3)).toEqual(['practice-cell-mitori:1', 'practice-cell-mitori:2', 'practice-cell-mitori:3'])` with `    expect(cells.slice(12, 15)).toEqual(['practice-cell-mitori:1', 'practice-cell-mitori:2', 'practice-cell-mitori:3'])` (the fifth row, wherever rows follow it), and add after that test:

```tsx
  // Spec (flash) §2: a sixth row, headed フ, under 見取算.
  it('has a フ row for フラッシュ暗算 under 見取算', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByText('フ')).toBeTruthy()
    expect(screen.getByTestId('practice-cell-flash:2').props.accessibilityLabel).toBe('2けたのフラッシュ暗算、まだ')
    const cells = screen.getAllByTestId(/^practice-cell-/).map((cell) => cell.props.testID as string)
    expect(cells).toHaveLength(18)
    expect(cells.slice(-3)).toEqual(['practice-cell-flash:1', 'practice-cell-flash:2', 'practice-cell-flash:3'])
  })

  it('colours and levels a フラッシュ暗算 cell like the others', () => {
    const progress = { ...emptyProgress(), practices: { 'flash:3': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-flash:3').props.accessibilityLabel).toBe(
      '3けたのフラッシュ暗算、うすい珠、レベル 4',
    )
    expect(screen.getByTestId('practice-level-flash:3').props.children).toBe('レベル 4')
  })
```

In `__tests__/home.test.tsx`, add after `it('starts a 見取算 round from its cell', …)`:

```tsx
  // Spec (flash) §2: the sixth row's cells start a フラッシュ暗算 run.
  it('starts a フラッシュ暗算 run from its cell', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    fireEvent.press(getByTestId('practice-cell-flash:2'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'flash:2' } })
  })
```

In `__tests__/progress-screen.test.tsx`, add at the end of `describe('ProgressScreen', …)`:

```tsx
  // Spec (flash) §2: the progress screen's table gains the same row.
  it('shows a row for フラッシュ暗算', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <ProgressScreen />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(getByTestId('practice-cell-flash:3').props.accessibilityLabel).toBe('3けたのフラッシュ暗算、まだ')
  })
```

In `__tests__/round-screen.test.tsx`, add `import { FLASH_LEAD_MS } from '@/ui/session/useFlash'` after `import { setBeads } from '@/ui/session/testing'`, and add after `it('never opens a lesson before ＋ or −', …)`:

```tsx
  // Spec (flash) §2: no lesson opens before フラッシュ暗算; its run starts
  // with the flash.
  it('plays a フラッシュ暗算 run with no lesson first', async () => {
    mockParams.current = { kind: 'flash:2' }
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.accessibilityLabel).toBe('フラッシュ暗算、5口')
    expect(mockRedirect).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(FLASH_LEAD_MS))
    expect(getByTestId('flash-counter').props.children).toBe('1/5')
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/domain/problem.test.ts src/domain/run.test.ts src/storage src/ui/progress __tests__/home.test.tsx __tests__/progress-screen.test.tsx __tests__/round-screen.test.tsx`
Expected: FAIL — no `practice-cell-flash:*` cells, `parsePracticeId('flash:2')` is null, the stored `flash:1` record is dropped, and the round screen redirects home for `flash:2`.

- [ ] **Step 3: The sixth kind**

In `src/domain/problem.ts`, replace `export const OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul', 'div', 'mitori']` with

```ts
// Spec (flash) §2: フラッシュ暗算 is the sixth row, under 見取算.
export const OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul', 'div', 'mitori', 'flash']
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx jest src/domain src/storage src/ui/progress __tests__`
Expected: PASS (`covers every step of every kind of problem, in order` now walks flash problems too).

- [ ] **Step 5: Commit**

```bash
npm test && npm run typecheck && npm run lint
git add src/domain/problem.ts src/domain/problem.test.ts src/domain/run.test.ts src/storage/progressStore.test.ts src/ui/progress/PracticeTable.test.tsx __tests__/home.test.tsx __tests__/progress-screen.test.tsx __tests__/round-screen.test.tsx
git commit -m "Put フラッシュ暗算 on Home's grid and the progress table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 9: Describe フラッシュ暗算 in the README

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: README**

Use the Edit tool on these passages of `README.md`:

1. Replace

```markdown
The practice is **けたの練習**: ＋ − × ÷ with 1-, 2- or 3-digit numbers, and 見取算 (a column of
five), in endless runs, started from the grid on Home. The learner works each problem on the
```

with

```markdown
The practice is **けたの練習**: ＋ − × ÷ with 1-, 2- or 3-digit numbers, 見取算 (a column of five)
and フラッシュ暗算 (five numbers flashed one at a time), in endless runs, started from the grid on
Home. The learner works each problem on the
```

2. Replace `| ± (見取算) | 7, 3, −2, 8, −4 | 47, 30, −23, 61, −19 | five 3-digit numbers |` with

```markdown
| ± (見取算) | 7, 3, −2, 8, −4 | 47, 30, −23, 61, −19 | five 3-digit numbers |
| フ (フラッシュ暗算) | 7, 3, 2, 8, 4, flashed | 47, 30, 23, 61, 19, flashed | five 3-digit numbers, flashed |
```

3. Replace

```markdown
  grouped under a heading per number (「59をひく　77 → 18」).
- **手順を見る** on every question opens the steps: ◀ ▶ play one bead move
```

with

```markdown
  grouped under a heading per number (「59をひく　77 → 18」).
- **フ**, フラッシュ暗算: five numbers, all added, flash one at a time in the prompt's place once
  the card is uncovered, about one a second (the first after 0.6 s, each for 0.7 s, 0.3 s apart),
  with a counter (1/5). After each of the first four the beads jump to the running total; the
  fifth flashes alone, and the learner adds it on the beads and answers the total. Until the flash
  ends the beads take no taps and こたえる is off; 手順を見る ends it at once and shows the five
  numbers as 見取算's column, and 戻る plays it again from the start. The numbers cannot be
  replayed. As the level rises the beads that follow along fade like any others, until the whole
  running total is held in the head. Its points are timed from the end of the flash.
- **手順を見る** on every question opens the steps: ◀ ▶ play one bead move
```

4. Replace

```markdown
  minutes), and longer 見取算 columns than five. Complement technique itself sits below 珠算能力検定
```

with

```markdown
  minutes), longer 見取算 columns than five, and フラッシュ暗算 of other lengths (3口, 10口), at
  other speeds or with a replay. Complement technique itself sits below 珠算能力検定
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Describe フラッシュ暗算 in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017V5SFEDUKdTGePuJQVohMh"
```

---

### Task 10: See it on the simulator, then hand over

**Files:** none changed unless the simulator shows a problem (then fix it in the owning file, test first, and commit as in that file's task).

- [ ] **Step 1: Full checks**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 2: Simulator, per the project's recipe**

Follow the memory note "Simulator UI verification" (Expo Go + Maestro): `npm run ios` (or `CI=1 npx expo start --ios` if Expo Go reports the project incompatible). On the 17 Pro simulator, before each deep link run `xcrun simctl terminate <udid> host.exp.Exponent`, then `xcrun simctl openurl <udid> "exp://127.0.0.1:8081/--/round?kind=flash:1"` (a second `openurl` if Expo Go stays in the background). Screenshot with `xcrun simctl io <udid> screenshot <file>.png`:
- Home: the sixth row headed 「フ」 under ±, its three cells coloured like the others (scroll the grid if needed).
- A number mid-flash, large, with its counter (「2/5」); the soroban on the running total.
- The answering state: nothing in the prompt's place, the soroban on the first four's total, the hint back, こたえる enabled once a bead moves.
- 手順を見る pressed mid-flash: the five numbers as a column, the soroban in the same place as before it opened (compare the frame's y in the two screenshots), the panel at the first number.
- A miss's review: the column, the headings 「30をたす　47 → 77」 etc.

- [ ] **Step 3: Record the pace and the beads following along**

For a 1けた and then a 3けた run (`kind=flash:1`, `kind=flash:3`): start `xcrun simctl io <udid> recordVideo --codec=h264 --force flash-1.mp4 &`, wait for "Recording started", open the deep link, wait about 8 s, then `kill -INT` the recorder. List the change timestamps with `ffmpeg -i flash-1.mp4 -vf "select='gt(scene,0.001)',showinfo" -f null - 2>&1 | grep pts_time`, extract the flash's window with `-fps_mode passthrough` into numbered PNGs and tile them (`tile=8x3`) into one contact sheet. Check: the first number about 0.6 s after the card shows; each number on for about 0.7 s and gone for about 0.3 s; the beads change in a single frame at the start of each gap (no in-between frames of a slide); after the fifth number the beads stay on the first four's total; 3けた numbers fit the prompt at 64 pt.

- [ ] **Step 4: A small phone and a faded level**

- On the SE (3rd gen) simulator (copy Expo Go as the memory note describes; close its dev-menu intro with Maestro `tapOn: { point: "89%,49%" }`), open `kind=flash:3` and screenshot mid-flash and after 手順を見る: the soroban does not move between the two, and 手順を見る, もどす and こたえる are on screen.
- Temporarily change `level={progress.practices[runId]?.fade ?? 0}` in `app/round.tsx` to `level={3}`, open `kind=flash:2`, and screenshot mid-flash: the running totals drawn dimmed. Repeat with `level={6}`: nothing drawn, the counter and numbers still flash. Then `git checkout app/round.tsx`; never commit it.

- [ ] **Step 5: Hand over**

Report to the owner what was built, with the screenshots and the contact sheets, and that the pace (0.6 / 0.7 / 0.3 s) is fixed by the spec and worth a feel on a phone. Shipping (a TestFlight build from this branch, then a PR) follows `docs/release-ios.md` and the owner's usual workflow, once they say to.
