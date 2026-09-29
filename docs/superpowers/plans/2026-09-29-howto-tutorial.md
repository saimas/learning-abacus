# やりかた Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Home's やりかた section into a tutorial of its own: 18 lessons across ＋ − × ÷ and 1けた/2けた/3けた, each a walkthrough of a worked example that ends with やってみよう (one similar problem to try, not recorded).

**Architecture:**
- A pure lesson catalogue (`src/domain/lessons.ts`) holds each lesson's id, operation, 桁数, technique and worked example, plus a rule for drawing a similar problem.
- The existing walkthrough components play any lesson's example: `MethodIntro` (generalised) for ＋ − ×, and `DivideWalkthrough` for ÷.
- やってみよう reuses the round's question wiring, extracted as `ProblemQuestion`.
- Two new routes: `/howto/[op]` (an operation's page) and `/lesson/[id]` (a lesson). They replace `/multiply-intro` and `/divide-intro`.
- Progress remembers `lessonsSeen`, carrying over the two old walkthrough flags.

**Tech Stack:** Expo SDK 57, expo-router (typed routes), React Native 0.86, React 19.2 (`useEffectEvent` available), TypeScript strict with `noUncheckedIndexedAccess`, Jest 30 + @testing-library/react-native 13, React Compiler lint.

**Spec:** `docs/superpowers/specs/2026-09-29-howto-tutorial-design.md`

## Global Constraints

- **Lessons.** Eighteen of them: ＋ 6, − 6, × 3, ÷ 3.
  - The ids are `add:direct`, `add:five`, `add:ten`, `add:both` (and the same for `sub`) for the 1けた ＋ − lessons, and `<op>:<digits>` for every other lesson.
  - The examples are exactly those in spec §2.
- **やってみよう records nothing:**
  - no attempt, no fade move, no day practised;
  - only `lessonsSeen` changes.
- **When a lesson counts as done:** the learner reaches やってみよう, presses 練習をはじめる (before a round), or leaves with ✕.
- **Opening by itself.** A × or ÷ round opens its kind's lesson only when that lesson is not done **and** the kind has no practice record. ＋ and − never open one by themselves.
- **Stored progress.** No schema bump.
  - A stored `multiplyIntroDone: true` loads as `mul:2` done, and `divideIntroDone: true` as `div:2` done.
  - The two flags are no longer written.
- **Strings.** `ja.ts` defines the `Strings` type (`typeof ja`), and `en.ts` must implement every key.
- **Home's four buttons** are 54 pt kit Buttons (`BUTTON_HEIGHT`), two rows of two. They stack one per row from `fontScale >= 1.2` (the existing `HOW_TO_STACK_SCALE`).
- **Typed routes are on** (`app.json` `experiments.typedRoutes`). After adding or removing a file under `app/`, regenerate `.expo/types/router.d.ts` before `npm run typecheck`, as the task says.
- **Checks.** Every task ends green on `npx jest`, `npm run -s typecheck` and `npx expo lint .`.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Style.** Match the surrounding code: comments cite the spec (`Spec (howto tutorial) §N`) and the owner's words where relevant; no `useRef().current` reads during render (React Compiler lint).

## Review Focus

1. **Every lesson's example must render and page through to its last button.** That includes 13 − 5 and 12 − 6 on two rods, the 12-group 3けた ÷, and the nine-九九 3けた ×. Pinned in Task 4 ("pages through every lesson to its last button").
2. **A lesson opened before progress has loaded must not save over it.** Pinned in Task 6 ("shows a loading state before progress has hydrated").
3. **A deep link with an unknown lesson id or operation goes Home.** Pinned in Task 6 ("goes Home for a lesson it does not know") and Task 7 ("goes Home for an operation it does not know").
4. **Double taps push or save once:** on 練習をはじめる and ✕, on a lesson row, and on Home's buttons. Pinned in Tasks 6, 7 and 8.
5. **A borrowing やってみよう problem is answerable.** Such a problem starts at 10–18 on two rods. Pinned in Task 5 ("takes a borrowing move from 1 on the tens rod").

---

### Task 1: The lesson catalogue

**Files:**
- Create: `src/domain/lessons.ts`
- Test: `src/domain/lessons.test.ts`

**Interfaces:**
- Consumes (existing):
  - from `src/domain/atoms.ts`: `ATOMS`, `classify(atom)`, `startValue(atom)`, `type AtomClass`;
  - from `src/domain/problem.ts`: `generateProblems(kind, count, random)`, `problemSteps`, `type Digits`, `type PairOperation`, `type PairProblem`, `type PracticeKind`.
- Produces:
  - `type TechniqueOperation = 'add' | 'sub'`
  - `type LessonId = \`${TechniqueOperation}:${AtomClass}\` | \`${PairOperation}:${Digits}\``
  - `type Lesson = { id: LessonId; op: PairOperation; digits: Digits; technique?: AtomClass; example: PairProblem }`
  - `TECHNIQUES: readonly AtomClass[]` (`['direct', 'five', 'ten', 'both']`)
  - `LESSONS: readonly Lesson[]` (18, in page order)
  - `lessonsFor(op: PairOperation): Lesson[]`
  - `lessonById(value: unknown): Lesson | null`
  - `isLessonId(value: unknown): value is LessonId`
  - `lessonForKind(kind: PracticeKind): Lesson | null`
  - `techniqueOf(lesson: Lesson): { op: TechniqueOperation; technique: AtomClass } | null`
  - `tryProblem(lesson: Lesson, random: () => number, previous?: PairProblem): PairProblem`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/lessons.test.ts`:

```ts
import { classify } from './atoms'
import {
  isLessonId,
  LESSONS,
  lessonById,
  lessonForKind,
  lessonsFor,
  TECHNIQUES,
  techniqueOf,
  tryProblem,
} from './lessons'
import { problemSteps, type PairOperation, type PairProblem } from './problem'

// A small seeded generator (mulberry32), as in divisionWalk.test.ts, so a
// run of draws is repeatable.
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The class of a problem that is one move on the ones rod, or null.
function oneMoveClass(problem: PairProblem) {
  const groups = problemSteps(problem)
  const [group] = groups
  if (groups.length !== 1 || group?.kind !== 'column' || group.atom === null) return null
  return classify(group.atom)
}

const OPS: PairOperation[] = ['add', 'sub', 'mul', 'div']

describe('the lesson catalogue', () => {
  it('has eighteen lessons, each operation from 1けた to 3けた', () => {
    expect(LESSONS).toHaveLength(18)
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(18)
    for (const op of OPS) {
      const digits = lessonsFor(op).map((lesson) => lesson.digits)
      expect(digits).toEqual([...digits].sort())
      expect(new Set(digits)).toEqual(new Set([1, 2, 3]))
    }
  })

  // Spec (howto tutorial) §2: 1けた ＋ and − are taught by technique.
  it('teaches 1けた ＋ and − by technique, each example one move of exactly that class', () => {
    for (const op of ['add', 'sub'] as const) {
      const techniques = lessonsFor(op).filter((lesson) => lesson.technique !== undefined)
      expect(techniques.map((lesson) => lesson.technique)).toEqual(TECHNIQUES)
      for (const lesson of techniques) {
        expect(lesson.id).toBe(`${op}:${lesson.technique}`)
        expect(lesson.digits).toBe(1)
        expect(oneMoveClass(lesson.example)).toBe(lesson.technique)
      }
    }
  })

  it('gives every other lesson one worked example of its own operation and 桁数', () => {
    for (const lesson of LESSONS.filter((candidate) => candidate.technique === undefined)) {
      expect(lesson.id).toBe(`${lesson.op}:${lesson.digits}`)
      expect(lesson.example.op).toBe(lesson.op)
      expect(lesson.example.digits).toBe(lesson.digits)
    }
    expect(lessonsFor('mul').map((lesson) => lesson.example)).toEqual([
      { op: 'mul', digits: 1, a: 7, b: 8 },
      { op: 'mul', digits: 2, a: 47, b: 36 },
      { op: 'mul', digits: 3, a: 473, b: 256 },
    ])
    expect(lessonsFor('div').map((lesson) => lesson.example)).toEqual([
      { op: 'div', digits: 1, a: 56, b: 7 },
      { op: 'div', digits: 2, a: 1692, b: 36 },
      { op: 'div', digits: 3, a: 121088, b: 256 },
    ])
  })

  // Spec §2: 3けた shows what 2けた cannot, a carry rippling through a 9.
  it('carries the ＋ 3けた example through a 9', () => {
    const example = lessonById('add:3')?.example
    expect(example).toEqual({ op: 'add', digits: 3, a: 595, b: 427 })
    expect(example !== undefined && problemSteps(example).some((group) => group.cascades)).toBe(true)
  })

  it('finds a lesson by its id, and nothing for anything else', () => {
    expect(lessonById('add:five')?.example).toEqual({ op: 'add', digits: 1, a: 4, b: 3 })
    expect(lessonById('add:4')).toBeNull()
    expect(lessonById(undefined)).toBeNull()
    expect(lessonById(['add:five'])).toBeNull()
    expect(isLessonId('div:3')).toBe(true)
    expect(isLessonId('mitori:2')).toBe(false)
  })

  // Spec §4: only × and ÷ rounds open a lesson first, their own 桁数's.
  it('opens a lesson before × and ÷ rounds only', () => {
    expect(lessonForKind({ op: 'mul', digits: 1 })?.id).toBe('mul:1')
    expect(lessonForKind({ op: 'div', digits: 3 })?.id).toBe('div:3')
    expect(lessonForKind({ op: 'add', digits: 2 })).toBeNull()
    expect(lessonForKind({ op: 'mitori', digits: 2 })).toBeNull()
  })

  it('narrows a technique lesson to its move, and nothing else', () => {
    const five = lessonById('sub:five')
    const worked = lessonById('sub:2')
    expect(five === null ? null : techniqueOf(five)).toEqual({ op: 'sub', technique: 'five' })
    expect(worked === null ? undefined : techniqueOf(worked)).toBeNull()
  })
})

// Spec §2: やってみよう's problem.
describe('tryProblem', () => {
  it('draws a 1けた move of the technique lesson’s own class, never from 0', () => {
    const random = seeded(7)
    for (const lesson of LESSONS.filter((candidate) => candidate.technique !== undefined)) {
      for (let i = 0; i < 200; i++) {
        const problem = tryProblem(lesson, random)
        expect(problem.op).toBe(lesson.op)
        expect(problem.digits).toBe(1)
        expect(problem.a).toBeGreaterThan(0)
        expect(oneMoveClass(problem)).toBe(lesson.technique)
      }
    }
  })

  it('draws the other lessons’ problems of their own kind', () => {
    const random = seeded(11)
    for (const lesson of LESSONS.filter((candidate) => candidate.technique === undefined)) {
      for (let i = 0; i < 50; i++) {
        const problem = tryProblem(lesson, random)
        expect(problem.op).toBe(lesson.op)
        expect(problem.digits).toBe(lesson.digits)
        if (problem.op === 'div') expect(problem.a % problem.b).toBe(0)
      }
    }
  })

  it('does not draw the problem it is told was just asked', () => {
    for (const lesson of LESSONS) {
      const first = tryProblem(lesson, () => 0)
      expect(tryProblem(lesson, () => 0, first)).not.toEqual(first)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/domain/lessons.test.ts`
Expected: FAIL, with "Cannot find module './lessons'".

- [ ] **Step 3: Write the catalogue**

Create `src/domain/lessons.ts`:

```ts
import { ATOMS, classify, startValue, type AtomClass } from './atoms'
import {
  generateProblems,
  type Digits,
  type PairOperation,
  type PairProblem,
  type PracticeKind,
} from './problem'

// Spec (howto tutorial) §2: the やりかた section's lessons. 1けた ＋ and −
// are taught by technique, one lesson per class of move; every other
// operation and size has one worked example.
export type TechniqueOperation = 'add' | 'sub'
export type LessonId = `${TechniqueOperation}:${AtomClass}` | `${PairOperation}:${Digits}`

export type Lesson = {
  id: LessonId
  op: PairOperation
  digits: Digits
  // The class of move a 1けた ＋ − lesson is about; undefined for the rest.
  technique?: AtomClass
  example: PairProblem
}

export const TECHNIQUES: readonly AtomClass[] = ['direct', 'five', 'ten', 'both']

function techniqueLesson(op: TechniqueOperation, technique: AtomClass, a: number, b: number): Lesson {
  return { id: `${op}:${technique}`, op, digits: 1, technique, example: { op, digits: 1, a, b } }
}

function workedLesson(op: PairOperation, digits: Digits, a: number, b: number): Lesson {
  return { id: `${op}:${digits}`, op, digits, example: { op, digits, a, b } }
}

// In the order an operation's page lists them, each example chosen for the
// moves it shows (spec §2). A 1けた subtraction never borrows (9 − 3 at
// most), so the borrowing lessons take a 1けた number from a 2-digit one.
export const LESSONS: readonly Lesson[] = [
  techniqueLesson('add', 'direct', 3, 1),
  techniqueLesson('add', 'five', 4, 3),
  techniqueLesson('add', 'ten', 8, 5),
  techniqueLesson('add', 'both', 6, 7),
  workedLesson('add', 2, 47, 38),
  workedLesson('add', 3, 595, 427),
  techniqueLesson('sub', 'direct', 4, 3),
  techniqueLesson('sub', 'five', 6, 3),
  techniqueLesson('sub', 'ten', 13, 5),
  techniqueLesson('sub', 'both', 12, 6),
  workedLesson('sub', 2, 82, 37),
  workedLesson('sub', 3, 613, 258),
  workedLesson('mul', 1, 7, 8),
  workedLesson('mul', 2, 47, 36),
  workedLesson('mul', 3, 473, 256),
  workedLesson('div', 1, 56, 7),
  workedLesson('div', 2, 1692, 36),
  workedLesson('div', 3, 121088, 256),
]

export function lessonsFor(op: PairOperation): Lesson[] {
  return LESSONS.filter((lesson) => lesson.op === op)
}

// For values from outside the app's own code, such as a route parameter.
export function lessonById(value: unknown): Lesson | null {
  return LESSONS.find((lesson) => lesson.id === value) ?? null
}

export function isLessonId(value: unknown): value is LessonId {
  return lessonById(value) !== null
}

// Spec §4: the lesson a × or ÷ round opens first, its own 桁数's; ＋ and −
// open none.
export function lessonForKind(kind: PracticeKind): Lesson | null {
  if (kind.op !== 'mul' && kind.op !== 'div') return null
  return lessonById(`${kind.op}:${kind.digits}`)
}

// A 1けた ＋ − lesson's move, narrowed for its words and its draws; null for
// every other lesson.
export function techniqueOf(lesson: Lesson): { op: TechniqueOperation; technique: AtomClass } | null {
  if (lesson.technique === undefined || (lesson.op !== 'add' && lesson.op !== 'sub')) return null
  return { op: lesson.op, technique: lesson.technique }
}

// Spec §2: やってみよう's problem. A technique lesson draws a 1けた move of
// its own class from the single moves, set up as a 基礎 move was: a borrow
// starts from 1 on the tens rod (startValue). A move from 0 is left out, as a
// round never starts from an empty soroban. Every other lesson draws a
// problem of its kind from the round's own generator. `previous`, the
// problem just asked, is not drawn again while there is another.
export function tryProblem(lesson: Lesson, random: () => number, previous?: PairProblem): PairProblem {
  const same = (problem: PairProblem) =>
    previous !== undefined && problem.a === previous.a && problem.b === previous.b
  const move = techniqueOf(lesson)
  if (move !== null) {
    const moves = ATOMS.filter(
      (atom) => atom.direction === move.op && classify(atom) === move.technique && startValue(atom) > 0,
    ).map((atom): PairProblem => ({ op: move.op, digits: 1, a: startValue(atom), b: atom.operand }))
    const fresh = moves.filter((problem) => !same(problem))
    const pool = fresh.length > 0 ? fresh : moves
    return pool[Math.floor(random() * pool.length)] ?? lesson.example
  }
  for (let tries = 0; tries < 20; tries++) {
    const [problem] = generateProblems({ op: lesson.op, digits: lesson.digits }, 1, random)
    if (problem !== undefined && problem.op !== 'mitori' && !same(problem)) return problem
  }
  return lesson.example
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/domain/lessons.test.ts src/domain/purity.test.ts`
Expected: PASS. (The purity test checks the new domain file imports nothing from the UI.)

- [ ] **Step 5: Commit**

```bash
git add src/domain/lessons.ts src/domain/lessons.test.ts
git commit -m "Add the やりかた lesson catalogue

Eighteen lessons: 1けた ＋ − by technique, one worked example for every
other operation and size, and the rule やってみよう draws a similar
problem by.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Progress remembers lessons

**Files:**
- Modify: `src/domain/progress.ts` (the `Progress` type, `emptyProgress`, and a new `markLessonSeen`)
- Modify: `src/storage/progressStore.ts` (load `lessonsSeen`, carry the old flags over)
- Modify: `src/ui/ProgressProvider.tsx` (`completeLesson` replaces `completeMultiplyIntro` / `completeDivideIntro`)
- Modify (callers, to stay green): `app/multiply-intro.tsx`, `app/divide-intro.tsx`, `app/round.tsx`
- Test:
  - `src/domain/progress.test.ts`
  - `src/storage/progressStore.test.ts`
  - `src/ui/ProgressProvider.test.tsx`
  - `__tests__/round-screen.test.tsx`
  - `__tests__/multiply-intro-screen.test.tsx`
  - `__tests__/divide-intro-screen.test.tsx`

**Interfaces:**
- Consumes (Task 1): `type LessonId`, `isLessonId(value)`.
- Produces:
  - `Progress.lessonsSeen: LessonId[]`. `multiplyIntroDone` and `divideIntroDone` are removed from `Progress`.
  - `markLessonSeen(progress: Progress, id: LessonId): Progress`
  - `useProgress().completeLesson: (id: LessonId) => Promise<void>` (saved at once)

- [ ] **Step 1: Write the failing tests**

In `src/domain/progress.test.ts`:
- add `markLessonSeen` to the import from `./progress`;
- the two tests `'has not yet shown how multiplication works'` and `'has not yet shown how division works'` are the last two in `describe('emptyProgress', …)`. Replace them, from the first `it(` through the second test's closing `})`, with the snippet below. The `})` that closed `describe('emptyProgress')` stays where it is, and now closes the new `describe('markLessonSeen')`:

```ts
  it('has done no lessons yet', () => {
    expect(emptyProgress().lessonsSeen).toEqual([])
  })
})

// Spec (howto tutorial) §4: the lessons done, each once.
describe('markLessonSeen', () => {
  it('adds a lesson once', () => {
    const once = markLessonSeen(emptyProgress(), 'add:five')
    expect(once.lessonsSeen).toEqual(['add:five'])
    expect(markLessonSeen(once, 'add:five')).toBe(once)
    expect(markLessonSeen(once, 'mul:2').lessonsSeen).toEqual(['add:five', 'mul:2'])
  })
```

(The snippet's own `})` before `// Spec` now closes `describe('emptyProgress')`.)

In `src/storage/progressStore.test.ts`, replace the whole `describe('multiplyIntroDone', …)` and `describe('divideIntroDone', …)` blocks with:

```ts
// Spec (howto tutorial) §4: the lessons done, added without a schema bump.
// A document from before lessons existed has a flag per walkthrough seen,
// and those walkthroughs are now the × and ÷ 2けた lessons.
describe('lessonsSeen', () => {
  // A document as a phone had it before lessons existed.
  function before(flags: Record<string, unknown>) {
    const { lessonsSeen: _, ...rest } = { ...emptyProgress(), daysPracticed: 5 }
    return JSON.stringify({ ...rest, ...flags })
  }

  it('loads a document written before lessons existed with none done', async () => {
    mockGetItem.mockResolvedValue(before({}))
    const result = await loadProgress()
    expect(result.lessonsSeen).toEqual([])
    expect(result.daysPracticed).toBe(5)
  })

  it('keeps the lessons it knows and drops the rest', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), lessonsSeen: ['add:five', 'add:9', 7, 'div:3'] }),
    )
    expect((await loadProgress()).lessonsSeen).toEqual(['add:five', 'div:3'])
  })

  it('discards a lessonsSeen that is not a list', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), lessonsSeen: 'mul:2' }))
    expect((await loadProgress()).lessonsSeen).toEqual([])
  })

  it.each([
    [{ multiplyIntroDone: true }, ['mul:2']],
    [{ divideIntroDone: true }, ['div:2']],
    [{ multiplyIntroDone: true, divideIntroDone: true }, ['mul:2', 'div:2']],
    [{ multiplyIntroDone: 'yes', divideIntroDone: 1 }, []],
  ])('carries the walkthrough flags %p over as the lessons %p', async (flags, lessons) => {
    mockGetItem.mockResolvedValue(before(flags))
    const result = await loadProgress()
    expect(result.lessonsSeen).toEqual(lessons)
    expect(result).not.toHaveProperty('multiplyIntroDone')
    expect(result).not.toHaveProperty('divideIntroDone')
  })

  it('counts a lesson once when both its flag and its id are stored', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), lessonsSeen: ['mul:2'], multiplyIntroDone: true }),
    )
    expect((await loadProgress()).lessonsSeen).toEqual(['mul:2'])
  })
})
```

In `src/ui/ProgressProvider.test.tsx`, replace the two tests `'completeMultiplyIntro sets …'` and `'completeDivideIntro sets …'` with:

```ts
  // Spec (howto tutorial) §4.
  it('completeLesson marks the lesson done, persists immediately, and changes nothing else', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      await api?.completeLesson('add:five')
    })
    await waitFor(() => expect(api?.progress?.lessonsSeen).toEqual(['add:five']))
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.calls[0]?.[0]).toEqual({ ...emptyProgress(), daysPracticed: 3, lessonsSeen: ['add:five'] })
  })

  it('completeLesson keeps a lesson done once', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      await api?.completeLesson('mul:2')
      await api?.completeLesson('mul:2')
    })
    expect(api?.progress?.lessonsSeen).toEqual(['mul:2'])
  })
```

The screen tests also change, from the old flags to the lessons:
- `__tests__/round-screen.test.tsx`:
  - replace every `multiplyIntroDone: true` with `lessonsSeen: ['mul:2']`;
  - replace every `divideIntroDone: true` with `lessonsSeen: ['div:2']`;
  - where a test sets both flags, use `lessonsSeen: ['mul:2', 'div:2']`.
- `__tests__/multiply-intro-screen.test.tsx`: replace each `toMatchObject({ multiplyIntroDone: true` with `toMatchObject({ lessonsSeen: ['mul:2']`, keeping the rest of each object.
- `__tests__/divide-intro-screen.test.tsx`: replace each `divideIntroDone: true` in `toMatchObject` with `lessonsSeen: ['div:2']`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/domain/progress.test.ts src/storage src/ui/ProgressProvider.test.tsx`
Expected: FAIL: `markLessonSeen` is not exported, `lessonsSeen` is undefined, and `completeLesson` is not a function.

- [ ] **Step 3: Implement**

In `src/domain/progress.ts`:
- add `import type { LessonId } from './lessons'` below the existing imports;
- in the `Progress` type, replace the `multiplyIntroDone` and `divideIntroDone` fields and their comments with:

```ts
  // The やりかた lessons done (spec (howto tutorial) §4), for their ✓ and for
  // whether a × or ÷ round opens its lesson first. Added without a schema
  // bump; it takes over the two walkthrough flags that came before it (see
  // progressStore).
  lessonsSeen: LessonId[]
```

- in `emptyProgress()`, replace `multiplyIntroDone: false, divideIntroDone: false,` with `lessonsSeen: [],`;
- append:

```ts
// Spec (howto tutorial) §4: a lesson is done once, however often it is
// finished or left.
export function markLessonSeen(progress: Progress, id: LessonId): Progress {
  if (progress.lessonsSeen.includes(id)) return progress
  return { ...progress, lessonsSeen: [...progress.lessonsSeen, id] }
}
```

In `src/storage/progressStore.ts`:
- add `import { isLessonId, type LessonId } from '@/domain/lessons'`;
- add, above `loadProgress`:

```ts
// Spec (howto tutorial) §4: the lessons done, keeping the ids it knows. A
// document from before lessons existed has a flag per walkthrough seen
// instead, and those walkthroughs are now the × and ÷ 2けた lessons.
function asLessonsSeen(stored: Record<string, unknown>): LessonId[] {
  const kept = Array.isArray(stored.lessonsSeen) ? stored.lessonsSeen.filter(isLessonId) : []
  const carried: LessonId[] = [
    ...(stored.multiplyIntroDone === true ? (['mul:2'] as const) : []),
    ...(stored.divideIntroDone === true ? (['div:2'] as const) : []),
  ]
  return [...new Set([...kept, ...carried])]
}
```

- in `loadProgress`'s returned object, replace the `multiplyIntroDone:` and `divideIntroDone:` entries and their comments with:

```ts
      lessonsSeen: asLessonsSeen(parsed as Record<string, unknown>),
```

In `src/ui/ProgressProvider.tsx`:
- add `markLessonSeen` to the import from `@/domain/progress`;
- add `import type { LessonId } from '@/domain/lessons'`;
- in `ProgressApi`, replace `completeMultiplyIntro` and `completeDivideIntro` with `completeLesson: (id: LessonId) => Promise<void>`;
- replace `markIntroDone`, `completeMultiplyIntro` and `completeDivideIntro` (and the comment above them) with:

```ts
  // Saved at once, as completeTutorial is: a lesson that opens before a
  // round does so only until it is done, so a crash before the next flush
  // must not bring it back.
  const completeLesson = useCallback(async (id: LessonId) => {
    const next = markLessonSeen(latest.current, id)
    latest.current = next
    setProgress(next)
    await saveProgress(next)
  }, [])
```

- in the provider's `value`, replace the two old entries with `completeLesson`.

Update the callers so the app still builds (Tasks 6–8 replace them):
- `app/multiply-intro.tsx`: in `MultiplyIntroScreen`, use `const { completeLesson } = useProgress()` and `complete={() => completeLesson('mul:2')}`.
- `app/divide-intro.tsx`: use `const { completeLesson } = useProgress()` and `complete={() => completeLesson('div:2')}`.
- `app/round.tsx`: replace `!progress.multiplyIntroDone` with `!progress.lessonsSeen.includes('mul:2')`, and `!progress.divideIntroDone` with `!progress.lessonsSeen.includes('div:2')`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all suites pass; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A src/domain/progress.ts src/domain/progress.test.ts src/storage src/ui/ProgressProvider.tsx src/ui/ProgressProvider.test.tsx app/multiply-intro.tsx app/divide-intro.tsx app/round.tsx __tests__
git commit -m "Remember the lessons done, carrying the walkthrough flags over

Progress keeps lessonsSeen instead of multiplyIntroDone/divideIntroDone.
A stored flag loads as the × or ÷ 2けた lesson done; no schema bump.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The lessons' words

**Files:**
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts`
- Test: `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes (Task 1): `techniqueOf`, `type Lesson`, `type TechniqueOperation`.
- Produces (keys on `Strings`):
  - `howToButton(op: PairOperation): string`
  - `howToTitle(op: PairOperation): string`
  - `lessonTitle(lesson: Lesson): string`
  - `lessonRow(lesson: Lesson): string`
  - `lessonRowLabel(lesson: Lesson, done: boolean): string`
  - `techniqueIntro(op: TechniqueOperation, technique: AtomClass): string`
  - `lessonMethod(op: TechniqueOperation): string`
  - `multiplyPlacement(digits: Digits): string`
  - `lessonResult(problem: PairProblem, answer: number): string`
  - `lessonTry`, `lessonAgain`, `lessonStartRound`
- This task only adds keys. Old ones are removed by the tasks that stop using them (Task 4: `introTitle`, `introPlacement`, `introResult`, `divideIntroTitle`; Task 8: `homeHowTo`, `homeHowToDivide`, `homeHowToButton`, `homeHowToDivideButton`).

- [ ] **Step 1: Write the failing tests**

Append to `src/i18n/catalogs.test.ts` (it already imports `ja` and `en`); add `import { lessonById, type Lesson } from '@/domain/lessons'` at the top:

```ts
// Spec (howto tutorial) §2–3: the やりかた lessons' words.
describe('lesson strings', () => {
  const lesson = (id: string): Lesson => {
    const found = lessonById(id)
    if (found === null) throw new Error(`no lesson ${id}`)
    return found
  }

  it('names Home’s four buttons and each operation’s page', () => {
    expect((['add', 'sub', 'mul', 'div'] as const).map(ja.howToButton)).toEqual(['＋ たし算', '− ひき算', '× かけ算', '÷ わり算'])
    expect((['add', 'sub', 'mul', 'div'] as const).map(en.howToButton)).toEqual(['+ Add', '− Subtract', '× Multiply', '÷ Divide'])
    expect(ja.howToTitle('add')).toBe('たし算のやりかた')
    expect(en.howToTitle('div')).toBe('How division works')
  })

  it('titles a lesson by its move, or by its size and operation', () => {
    expect(ja.lessonTitle(lesson('add:direct'))).toBe('そのまま')
    expect(ja.lessonTitle(lesson('add:both'))).toBe('十の繰上と五の分解')
    expect(ja.lessonTitle(lesson('sub:both'))).toBe('十の繰下と五の合成')
    expect(ja.lessonTitle(lesson('mul:3'))).toBe('3けたのかけ算')
    expect(en.lessonTitle(lesson('sub:ten'))).toBe('Borrow ten')
    expect(en.lessonTitle(lesson('add:2'))).toBe('2-digit addition')
  })

  it('lists a lesson as its move and example, or its example alone', () => {
    expect(ja.lessonRow(lesson('add:five'))).toBe('五の合成　4＋3')
    expect(ja.lessonRow(lesson('sub:ten'))).toBe('十の繰下　13−5')
    expect(ja.lessonRow(lesson('mul:2'))).toBe('47×36')
    expect(ja.lessonRow(lesson('div:1'))).toBe('56÷7')
    expect(en.lessonRow(lesson('add:five'))).toBe('Five complement  4 + 3')
    expect(ja.lessonRowLabel(lesson('add:five'), true)).toBe('五の合成　4＋3、できた')
    expect(ja.lessonRowLabel(lesson('add:five'), false)).toBe('五の合成　4＋3')
    expect(en.lessonRowLabel(lesson('div:2'), true)).toBe('1692 ÷ 36, done')
  })

  it('explains each move with its own example, and ＋ − worked by place', () => {
    expect(ja.techniqueIntro('add', 'five')).toContain('4に3をたす')
    expect(ja.techniqueIntro('add', 'both')).toContain('−3 は −5 +2')
    expect(ja.techniqueIntro('sub', 'ten')).toContain('13から5をひく')
    expect(ja.techniqueIntro('sub', 'both')).toContain('+4 は +5 −1')
    expect(en.techniqueIntro('add', 'ten')).toContain('8 + 5 is +10 −5')
    expect(ja.lessonMethod('add')).toContain('繰り上がり')
    expect(ja.lessonMethod('sub')).toContain('繰り下がり')
  })

  it('tells × where a 九九’s digits go, for each size', () => {
    expect(ja.multiplyPlacement(1)).toContain('一の位')
    expect(ja.multiplyPlacement(2)).toContain('十の位どうしなら百の位')
    expect(ja.multiplyPlacement(3)).toContain('百の位どうしなら万の位')
    expect(en.multiplyPlacement(3)).toContain('hundreds × hundreds on the ten-thousands rod')
  })

  it('gives the result, やってみよう and its buttons', () => {
    expect(ja.lessonResult({ op: 'mul', digits: 2, a: 47, b: 36 }, 1692)).toBe('47×36 = 1692')
    expect(en.lessonResult({ op: 'mul', digits: 2, a: 47, b: 36 }, 1692)).toBe('47 × 36 = 1692')
    expect(ja.lessonResult({ op: 'sub', digits: 1, a: 13, b: 5 }, 8)).toBe('13−5 = 8')
    expect([ja.lessonTry, ja.lessonAgain, ja.lessonStartRound]).toEqual(['やってみよう', 'もう一問', '練習をはじめる'])
    expect([en.lessonTry, en.lessonAgain, en.lessonStartRound]).toEqual(['Try one', 'Another', 'Start practising'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/i18n/catalogs.test.ts`
Expected: FAIL: `ja.howToButton is not a function`, and so on.

- [ ] **Step 3: Add the strings**

In `src/i18n/ja.ts`:
- change the atoms import to `import { classify, type Atom, type AtomClass } from '@/domain/atoms'` (already so);
- add `type PairOperation` to the `@/domain/problem` import list;
- add `import { techniqueOf, type Lesson, type TechniqueOperation } from '@/domain/lessons'`.

Then, below `const PLACE …` (line ~32), add:

```ts
// Spec (howto tutorial) §2–3: the やりかた lessons' names and words.
const HOW_TO_SYMBOL: Record<PairOperation, string> = { add: '＋', sub: '−', mul: '×', div: '÷' }

function techniqueName(op: TechniqueOperation, technique: AtomClass): string {
  return technique === 'direct' ? 'そのまま' : TECHNIQUE[technique][op]
}

function lessonExample(problem: PairProblem): string {
  return `${problem.a}${HOW_TO_SYMBOL[problem.op]}${problem.b}`
}

function lessonRow(lesson: Lesson): string {
  const move = techniqueOf(lesson)
  const example = lessonExample(lesson.example)
  return move === null ? example : `${techniqueName(move.op, move.technique)}　${example}`
}

// What each move is and when it is used, with the lesson's own example.
const TECHNIQUE_INTRO: Record<TechniqueOperation, Record<AtomClass, string>> = {
  add: {
    direct: 'たす数の一の珠や五の珠が、その位にそのまま入るときは、そのまま入れます。3に1をたすなら、一の珠を1つ上げます。',
    five: 'たす数の一の珠が足りないときは、五の珠を入れて、入れすぎた分の一の珠をはらいます（五の合成）。4に3をたすなら、+5 −2 です。',
    ten: 'その位が10をこえるときは、左の位に1を入れて（+10）、入れすぎた分をはらいます（十の繰上）。8に5をたすなら、+10 −5 です。',
    both: '左の位に1を入れて（+10）から入れすぎた分をはらうとき、一の珠だけではらえなければ、五の珠をはらって一の珠を入れます。6に7をたすなら、+10 −3 で、−3 は −5 +2 です。',
  },
  sub: {
    direct: 'ひく数の一の珠や五の珠が、その位からそのままはらえるときは、そのままはらいます。4から3をひくなら、一の珠を3つ下げます。',
    five: 'ひく数の一の珠が足りないときは、五の珠をはらって、はらいすぎた分の一の珠を入れます（五の分解）。6から3をひくなら、−5 +2 です。',
    ten: 'その位からひけないときは、左の位から1をはらって（−10）、ひきすぎた分を入れます（十の繰下）。13から5をひくなら、−10 +5 です。',
    both: '左の位から1をはらって（−10）からひきすぎた分を入れるとき、一の珠だけで入れられなければ、五の珠を入れて一の珠をはらいます。12から6をひくなら、−10 +4 で、+4 は +5 −1 です。',
  },
}

// The ＋ − 2けた and 3けた lessons' method: by place, from the highest.
const LESSON_METHOD: Record<TechniqueOperation, string> = {
  add: 'たし算は、上の位から順に、位ごとにたしていきます。その位が10をこえたら、左の位に1を入れます（繰り上がり）。左の位が9のときは、その1がさらに左の位へ上がります。',
  sub: 'ひき算は、上の位から順に、位ごとにひいていきます。その位からひけないときは、左の位から1をかります（繰り下がり）。',
}

// Where a 九九's digits go, stated for each size (spec §2): the 2けた rule is
// the one the × walkthrough has always given.
const MULTIPLY_PLACEMENT: Record<Digits, string> = {
  1: '九九の答えは、十の位を左の位に、一の位をその右の一の位に入れます。',
  2: '九九の答えの一の位は、一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしなら百の位に入れます。十の位は、その一つ上の位です。',
  3: '九九の答えの一の位は、かけた二つの数の位を合わせた位に入れます。一の位どうしなら一の位、十の位と一の位なら十の位、十の位どうしや百の位と一の位なら百の位、百の位と十の位なら千の位、百の位どうしなら万の位です。十の位は、その一つ上の位です。',
}
```

In the `ja` object, after `homeHowToSection`, add:

```ts
  // Spec (howto tutorial) §3: Home's four buttons, and each operation's page
  // title, which VoiceOver reads for its button too.
  howToButton: (op: PairOperation) => `${HOW_TO_SYMBOL[op]} ${OP_NAME[op]}`,
  howToTitle: (op: PairOperation) => `${OP_NAME[op]}のやりかた`,
  // A lesson: its title, its row on the operation page (and what VoiceOver
  // reads for the row, done or not), its words and its result.
  lessonTitle: (lesson: Lesson) => {
    const move = techniqueOf(lesson)
    return move === null ? roundName({ op: lesson.op, digits: lesson.digits }) : techniqueName(move.op, move.technique)
  },
  lessonRow,
  lessonRowLabel: (lesson: Lesson, done: boolean) => `${lessonRow(lesson)}${done ? '、できた' : ''}`,
  techniqueIntro: (op: TechniqueOperation, technique: AtomClass) => TECHNIQUE_INTRO[op][technique],
  lessonMethod: (op: TechniqueOperation) => LESSON_METHOD[op],
  multiplyPlacement: (digits: Digits) => MULTIPLY_PLACEMENT[digits],
  lessonResult: (problem: PairProblem, answer: number) => `${lessonExample(problem)} = ${answer}`,
  lessonTry: 'やってみよう',
  lessonAgain: 'もう一問',
  lessonStartRound: '練習をはじめる',
```

In `src/i18n/en.ts`:
- change `import type { Atom } from '@/domain/atoms'` to `import type { Atom, AtomClass } from '@/domain/atoms'`;
- add `type Digits` and `type PairOperation` to the `@/domain/problem` import list;
- add `import { techniqueOf, type Lesson, type TechniqueOperation } from '@/domain/lessons'`.

Then, below `roundName`, add:

```ts
// Spec (howto tutorial) §2–3: the lessons' names and words. English names
// the moves plainly; Japanese keeps the curriculum's own terms.
const HOW_TO_SYMBOL: Record<PairOperation, string> = { add: '+', sub: '−', mul: '×', div: '÷' }
const HOW_TO_BUTTON: Record<PairOperation, string> = { add: '+ Add', sub: '− Subtract', mul: '× Multiply', div: '÷ Divide' }
const TECHNIQUE_NAME: Record<TechniqueOperation, Record<AtomClass, string>> = {
  add: { direct: 'Straight', five: 'Five complement', ten: 'Carry ten', both: 'Carry ten, five complement' },
  sub: { direct: 'Straight', five: 'Five complement', ten: 'Borrow ten', both: 'Borrow ten, five complement' },
}

function lessonExample(problem: PairProblem): string {
  return `${problem.a} ${HOW_TO_SYMBOL[problem.op]} ${problem.b}`
}

function lessonRow(lesson: Lesson): string {
  const move = techniqueOf(lesson)
  const example = lessonExample(lesson.example)
  return move === null ? example : `${TECHNIQUE_NAME[move.op][move.technique]}  ${example}`
}

const TECHNIQUE_INTRO: Record<TechniqueOperation, Record<AtomClass, string>> = {
  add: {
    direct: 'When the beads for the number you add fit on the rod as they are, just move them in. 3 + 1: push one earth bead up.',
    five: 'When there are not enough earth beads, bring the heaven bead down and take off the earth beads you added too many (five complement). 4 + 3 is +5 −2.',
    ten: 'When the rod would go past 9, add 1 on the rod to the left (+10) and take off what you added too many (carry ten). 8 + 5 is +10 −5.',
    both: 'When, after the +10, the earth beads alone cannot take off what you added too many, take off the heaven bead and put earth beads back. 6 + 7 is +10 −3, and −3 is −5 +2.',
  },
  sub: {
    direct: 'When the beads for the number you subtract can come off the rod as they are, just take them off. 4 − 3: push three earth beads down.',
    five: 'When there are not enough earth beads, take the heaven bead off and put back the earth beads you took too many (five complement). 6 − 3 is −5 +2.',
    ten: 'When the rod cannot give that much, take 1 off the rod to the left (−10) and put back what you took too many (borrow ten). 13 − 5 is −10 +5.',
    both: 'When, after the −10, the earth beads alone cannot put back what you took too many, bring the heaven bead down and take earth beads off. 12 − 6 is −10 +4, and +4 is +5 −1.',
  },
}

const LESSON_METHOD: Record<TechniqueOperation, string> = {
  add: 'Add from the highest place down, one rod at a time. When a rod would go past 9, add 1 on the rod to its left (a carry). If that rod is a 9, the 1 carries on further left.',
  sub: 'Subtract from the highest place down, one rod at a time. When a rod cannot give that much, borrow 1 from the rod to its left.',
}

const MULTIPLY_PLACEMENT: Record<Digits, string> = {
  1: 'The answer’s tens digit goes on the left rod and its ones digit on the ones rod.',
  2: 'Each answer’s ones digit goes on the rod for the two places together: ones × ones on the ones rod, tens × ones on the tens rod, tens × tens on the hundreds rod. Its tens digit goes one rod to the left.',
  3: 'Each answer’s ones digit goes on the rod for the two places together: ones × ones on the ones rod, tens × ones on the tens rod, tens × tens or hundreds × ones on the hundreds rod, hundreds × tens on the thousands rod, hundreds × hundreds on the ten-thousands rod. Its tens digit goes one rod to the left.',
}
```

In the `en` object, after `homeHowToSection`, add:

```ts
  howToButton: (op) => HOW_TO_BUTTON[op],
  howToTitle: (op) => `How ${OP_NAME[op].toLowerCase()} works`,
  lessonTitle: (lesson) => {
    const move = techniqueOf(lesson)
    return move === null
      ? roundName({ op: lesson.op, digits: lesson.digits })
      : TECHNIQUE_NAME[move.op][move.technique]
  },
  lessonRow,
  lessonRowLabel: (lesson, done) => `${lessonRow(lesson)}${done ? ', done' : ''}`,
  techniqueIntro: (op, technique) => TECHNIQUE_INTRO[op][technique],
  lessonMethod: (op) => LESSON_METHOD[op],
  multiplyPlacement: (digits) => MULTIPLY_PLACEMENT[digits],
  lessonResult: (problem, answer) => `${lessonExample(problem)} = ${answer}`,
  lessonTry: 'Try one',
  lessonAgain: 'Another',
  lessonStartRound: 'Start practising',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/i18n && npm run -s typecheck && npx expo lint .`
Expected: PASS; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "Add the やりかた lessons' words in both languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Walkthroughs for every lesson

**Files:**
- Modify: `src/ui/intro/MethodIntro.tsx`:
  - `IntroTexts` becomes `{ title, pages, result }`;
  - text pages come before the step groups;
  - the board is drawn under × only.
- Modify: `src/ui/intro/DivideWalkthrough.tsx` (a `title` prop in place of `strings.divideIntroTitle`)
- Create: `src/ui/lesson/lessonIntro.ts`, `src/ui/lesson/LessonWalkthrough.tsx`
- Modify: `app/multiply-intro.tsx`, `app/divide-intro.tsx` (play their lessons through `LessonWalkthrough`)
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts` (remove `introTitle`, `introPlacement`, `introResult`, `divideIntroTitle`)
- Test:
  - `src/ui/lesson/LessonWalkthrough.test.tsx` (new)
  - `src/ui/intro/MethodIntro.test.tsx`
  - `src/ui/intro/DivideWalkthrough.test.tsx`
  - `src/i18n/catalogs.test.ts`
  - `__tests__/multiply-intro-screen.test.tsx`
  - `__tests__/divide-intro-screen.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `LESSONS`, `lessonById`, `techniqueOf`, `type Lesson`;
  - from Task 3: `strings.lessonTitle`, `strings.techniqueIntro`, `strings.lessonMethod`, `strings.multiplyPlacement`, `strings.lessonResult`;
  - existing: `strings.introMethod`.
- Produces:
  - `type IntroTexts = { title: string; pages: string[]; result: string }` (MethodIntro)
  - `DivideWalkthrough` props `{ problem; title: string; finishLabel; onFinish }`
  - `lessonIntro(strings: Strings, lesson: Lesson): IntroTexts`
  - `LessonWalkthrough({ lesson, finishLabel, onFinish }: { lesson: Lesson; finishLabel: string; onFinish: () => void })`
  - Unchanged testIDs: `intro-next`, `intro-back` and `intro-finish` (both walkthroughs finish on `intro-finish`), `intro-text`, `intro-soroban`, `walk-next`, `walk-problem`.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/lesson/LessonWalkthrough.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { LESSONS, lessonById, type Lesson } from '@/domain/lessons'
import { ja } from '@/i18n/ja'
import { textOf } from '@/ui/session/testing'
import { LessonWalkthrough } from './LessonWalkthrough'

beforeEach(() => {
  // The bead steps play on timers.
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function lesson(id: string): Lesson {
  const found = lessonById(id)
  if (found === null) throw new Error(`no lesson ${id}`)
  return found
}

function renderLesson(id: string, onFinish = jest.fn()) {
  render(<LessonWalkthrough lesson={lesson(id)} finishLabel="やってみよう" onFinish={onFinish} />)
  return onFinish
}

// ▶ until the last button, whichever walkthrough it is (at most 80 presses).
function pageToEnd() {
  for (let i = 0; i < 80 && screen.queryByTestId('intro-finish') === null; i++) {
    fireEvent.press(screen.queryByTestId('intro-next') ?? screen.getByTestId('walk-next'))
  }
}

const rods = () =>
  ['rod-0', 'rod-1'].map((id) => within(screen.getByTestId('intro-soroban')).getByTestId(id).props.accessibilityValue.text)

describe('LessonWalkthrough', () => {
  // Spec (howto tutorial) §2: intro, one page per step group, result.
  it('walks a technique lesson: what the move is, its one move, the result', () => {
    const onFinish = renderLesson('add:five')
    expect(screen.getByText('五の合成')).toBeTruthy()
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.techniqueIntro('add', 'five'))
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toContain('五の合成')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('4＋3 = 7')
    expect(screen.getByText('やってみよう')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('starts ＋ and − from the first number set on the soroban', () => {
    renderLesson('add:five')
    expect(rods()).toEqual(['0', '4'])
  })

  it('draws the number board under × only', () => {
    renderLesson('add:2')
    expect(screen.queryByTestId('operand-a')).toBeNull()
    screen.unmount()
    renderLesson('mul:1')
    expect(screen.getByTestId('operand-a')).toBeTruthy()
  })

  it('works ＋ − 2けた and 3けた by place', () => {
    renderLesson('sub:3')
    expect(screen.getByText('3けたのひき算')).toBeTruthy()
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.lessonMethod('sub'))
  })

  it('tells × where a 九九’s digits go, for its size', () => {
    renderLesson('mul:3')
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.introMethod)
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe(ja.multiplyPlacement(3))
  })

  it('walks ÷ with the division walk, titled for its size', () => {
    renderLesson('div:1')
    expect(screen.getByText('1けたのわり算')).toBeTruthy()
    expect(textOf(screen.getByTestId('walk-problem'))).toContain('56')
  })

  // Review focus: every example renders and reaches its last button,
  // 13 − 5 on two rods and the long 3けた × and ÷ among them.
  it.each(LESSONS.map((each) => [each.id]))('pages through %s to its last button', (id) => {
    renderLesson(id)
    pageToEnd()
    expect(screen.getByTestId('intro-finish')).toBeTruthy()
  })
})
```

In `src/ui/intro/MethodIntro.test.tsx`, replace `MULTIPLY_TEXTS` with:

```ts
const MULTIPLY_TEXTS: IntroTexts = {
  title: '2けたのかけ算',
  pages: [ja.introMethod, ja.multiplyPlacement(2)],
  result: ja.lessonResult(MULTIPLY, 1692),
}
```

Then:
- replace every `ja.introPlacement` in the file with `ja.multiplyPlacement(2)`;
- change the comment above it from "as its route sets it up (app/multiply-intro.tsx)" to "as the × 2けた lesson sets it up (lessonIntro)";
- in `'shows the title and the problem it is given'`, change `expect(screen.getByText('かけ算のやりかた')).toBeTruthy()` to `expect(screen.getByText('2けたのかけ算')).toBeTruthy()`.

In `src/ui/intro/DivideWalkthrough.test.tsx`, change `renderWalk`'s render to `<DivideWalkthrough problem={PROBLEM} title="わり算のやりかた" finishLabel="はじめる" onFinish={onFinish} />`.

In `src/i18n/catalogs.test.ts`:
- replace the test `'gives the walkthrough its title, its explanations and its result'` with:

```ts
  it('explains how the × walkthrough works', () => {
    expect(ja.introMethod).toContain('両落とし')
  })
```

- delete the test `'gives the walkthrough its title'` (the one on `divideIntroTitle`).

In `__tests__/multiply-intro-screen.test.tsx`, change `expect(screen.getByText('かけ算のやりかた')).toBeTruthy()` to `expect(screen.getByText('2けたのかけ算')).toBeTruthy()`.

In `__tests__/divide-intro-screen.test.tsx`, change `expect(screen.getByText('わり算のやりかた')).toBeTruthy()` to `expect(screen.getByText('2けたのわり算')).toBeTruthy()`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/ui/lesson src/ui/intro`
Expected: FAIL: `Cannot find module './LessonWalkthrough'`, and MethodIntro rejects `pages`.

- [ ] **Step 3: Implement**

In `src/ui/intro/MethodIntro.tsx`, replace the `IntroTexts` and `Page` types with:

```ts
// What a lesson's walkthrough says around its worked problem: its title, the
// pages before the steps (what the move or method is, and for × where each
// digit goes), and the result. The step pages need no text of their own:
// they read as the answer card's lines.
export type IntroTexts = {
  title: string
  pages: string[]
  result: string
}

// The pages: the text pages, one page per step group (its bead steps play as
// the page opens), and the result.
type Page = { kind: 'text'; index: number } | { kind: 'group'; index: number } | { kind: 'result' }
```

Then make these edits:
- **The component comment** becomes:

```ts
// Spec (howto tutorial) §2: a ＋ − × lesson's walkthrough, working its
// example through on the soroban from its start (the first number for ＋
// −; nothing for ×, since 両落とし builds only the product), with × 's two
// numbers on the board beneath. ÷ has DivideWalkthrough.
```

- **The `pages` array** becomes:

```ts
  const pages: Page[] = [
    ...intro.pages.map((_, index) => ({ kind: 'text' as const, index })),
    ...groups.map((_, index) => ({ kind: 'group' as const, index })),
    { kind: 'result' },
  ]
```

- **The comment above `shown`** becomes: `// Before the first group plays, the soroban shows the example's start: the first number for ＋ −, nothing for × (両落とし builds only the product).`
- **`back()`'s comment:** replace "landing on the method or placement page just stops the replay, so `shown` falls back to that page's first state (the empty soroban)" with "landing on a text page just stops the replay, so `shown` falls back to the example's start".
- **`pageText()`** becomes:

```ts
  function pageText(): string {
    switch (current.kind) {
      case 'text':
        return intro.pages[current.index] ?? ''
      case 'result':
        return intro.result
      case 'group':
        return group === undefined ? '' : (groupLine(strings, problem, group) ?? '')
    }
  }
```

- **The board** is replaced by:

```tsx
        {/* × only: 両落とし leaves both numbers off the soroban, so they
            are on a board beneath it, a 九九's page pointing at its digits
            for as long as it is open. ＋ − start with the first number on
            the soroban itself. */}
        {problem.op === 'mul' ? <OperandBoard problem={problem} activeGroup={group} /> : null}
```

- **Imports:** remove `answerOf` from the `@/domain/problem` import if it is no longer used.

In `src/ui/intro/DivideWalkthrough.tsx`:
- add `title: string` to the props (`title,` in the destructuring, `title: string` in the type);
- replace `{strings.divideIntroTitle}` with `{title}`.

Create `src/ui/lesson/lessonIntro.ts`:

```ts
import { techniqueOf, type Lesson } from '@/domain/lessons'
import { answerOf } from '@/domain/problem'
import type { Strings } from '@/i18n/ja'
import type { IntroTexts } from '@/ui/intro/MethodIntro'

// Spec (howto tutorial) §2: a ＋ − × lesson's words. A technique lesson says
// what its move is; a ＋ − 2けた or 3けた lesson how the operation is worked
// by place; × how 両落とし works and where a 九九's digits go at its size.
export function lessonIntro(strings: Strings, lesson: Lesson): IntroTexts {
  const move = techniqueOf(lesson)
  const pages =
    move !== null
      ? [strings.techniqueIntro(move.op, move.technique)]
      : lesson.op === 'add' || lesson.op === 'sub'
        ? [strings.lessonMethod(lesson.op)]
        : [strings.introMethod, strings.multiplyPlacement(lesson.digits)]
  return {
    title: strings.lessonTitle(lesson),
    pages,
    result: strings.lessonResult(lesson.example, answerOf(lesson.example)),
  }
}
```

Create `src/ui/lesson/LessonWalkthrough.tsx`:

```tsx
import type { Lesson } from '@/domain/lessons'
import { useStrings } from '@/i18n'
import { DivideWalkthrough } from '@/ui/intro/DivideWalkthrough'
import { MethodIntro } from '@/ui/intro/MethodIntro'
import { lessonIntro } from './lessonIntro'

// Spec (howto tutorial) §2: a lesson's walkthrough of its example. ÷ keeps
// its own bead-by-bead walk (spec: division walkthrough), which takes any
// problem; ＋ − × are played by MethodIntro.
export function LessonWalkthrough({
  lesson,
  finishLabel,
  onFinish,
}: {
  lesson: Lesson
  finishLabel: string
  onFinish: () => void
}) {
  const strings = useStrings()
  if (lesson.op === 'div') {
    return (
      <DivideWalkthrough
        problem={lesson.example}
        title={strings.lessonTitle(lesson)}
        finishLabel={finishLabel}
        onFinish={onFinish}
      />
    )
  }
  return (
    <MethodIntro
      problem={lesson.example}
      intro={lessonIntro(strings, lesson)}
      finishLabel={finishLabel}
      onFinish={onFinish}
    />
  )
}
```

Replace `app/multiply-intro.tsx` with:

```tsx
import { lessonById } from '@/domain/lessons'
import { IntroScreen } from '@/ui/intro/IntroScreen'
import { LessonWalkthrough } from '@/ui/lesson/LessonWalkthrough'
import { useProgress } from '@/ui/ProgressProvider'

const LESSON = lessonById('mul:2')

function Walkthrough({ finishLabel, onFinish }: { finishLabel: string; onFinish: () => void }) {
  return LESSON === null ? null : <LessonWalkthrough lesson={LESSON} finishLabel={finishLabel} onFinish={onFinish} />
}

// The × 2けた lesson, before the first × round and from Home's かけ算 button,
// until /lesson/[id] takes over (spec (howto tutorial) §3).
export default function MultiplyIntroScreen() {
  const { completeLesson } = useProgress()
  return <IntroScreen op="mul" complete={() => completeLesson('mul:2')} walkthrough={Walkthrough} />
}
```

Replace `app/divide-intro.tsx` with the same shape: `lessonById('div:2')`, `op="div"`, `completeLesson('div:2')`, and the comment "The ÷ 2けた lesson …".

In `src/i18n/ja.ts` and `src/i18n/en.ts`, delete the keys `introTitle`, `introPlacement`, `introResult` and `divideIntroTitle`, with their comments. Keep `introMethod`, `introBack` and `introExit`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all pass, including every `pages through … to its last button` case; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A src/ui/intro src/ui/lesson src/i18n app/multiply-intro.tsx app/divide-intro.tsx __tests__
git commit -m "Play any lesson's example through the walkthroughs

MethodIntro takes its text pages from the lesson (a move's intro, the ＋ −
method, or ×'s method and placement for its size) and draws the board
under × only. DivideWalkthrough takes the lesson's title.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: やってみよう

**Files:**
- Create: `src/ui/round/ProblemQuestion.tsx` (RoundRunner's per-problem QuestionView wiring, moved)
- Modify: `src/ui/round/RoundRunner.tsx` (use `ProblemQuestion`)
- Modify: `src/ui/session/QuestionView.tsx` (the `afterAnswer` prop; guard the moment after any answer)
- Create: `src/ui/lesson/LessonTry.tsx`
- Test:
  - `src/ui/session/QuestionView.test.tsx`
  - `src/ui/lesson/LessonTry.test.tsx` (new)
  - existing `src/ui/round/RoundRunner.test.tsx` (must pass unchanged)

**Interfaces:**
- Consumes:
  - from Task 1: `tryProblem`, `lessonById`, `type Lesson`;
  - from Task 3: `strings.lessonTry`, `strings.lessonAgain`;
  - existing: `strings.done` ('おわる').
- Produces:
  - `type AfterAnswer = { leaveLabel: string; onLeave: () => void; againLabel: string }`, exported from QuestionView.
  - QuestionView prop `afterAnswer?: AfterAnswer`, with testIDs `after-leave` and `after-again`.
  - `ProblemQuestion(props: { problem: Problem; fade: FadeLevel; shownAt: number; now: () => number; onSubmit: (submission: Submission) => void; onMoveOn: () => void; afterAnswer?: AfterAnswer })`
  - `LessonTry(props: { lesson: Lesson; onLeave: () => void; random?: () => number })`

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/session/QuestionView.test.tsx`:

```tsx
// Spec (howto tutorial) §2: outside a round, an answered question offers
// leaving or another problem in place of its bottom row.
describe('QuestionView after an answer outside a round', () => {
  const afterAnswer = (onLeave = jest.fn()) => ({ leaveLabel: 'おわる', onLeave, againLabel: 'もう一問' })

  it('offers leaving or another problem once a right answer is in', () => {
    const onLeave = jest.fn()
    const { onMoveOn } = renderView({ afterAnswer: afterAnswer(onLeave) })
    expect(screen.queryByTestId('after-again')).toBeNull()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(screen.getByTestId('after-again')).toHaveTextContent('もう一問')
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    expect(onMoveOn).toHaveBeenCalledTimes(1)
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('offers them in place of つぎへ under a miss', () => {
    const { onMoveOn } = renderView({ afterAnswer: afterAnswer() })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('review-next')).toBeNull()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    expect(onMoveOn).toHaveBeenCalledTimes(1)
  })

  // A double tap on こたえる must not skip the 〇 or the review.
  it('ignores both in the moment after an answer', () => {
    const onLeave = jest.fn()
    const { onMoveOn } = renderView({ afterAnswer: afterAnswer(onLeave) })
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    fireEvent.press(screen.getByTestId('after-again'))
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onMoveOn).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('takes the keypad’s place in keypad mode', () => {
    renderView({ fade: 3, coaching: 'silent', afterAnswer: afterAnswer() })
    for (const digit of '857') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('key-1')).toBeNull()
    expect(screen.getByTestId('after-again')).toBeTruthy()
  })
})
```

Create `src/ui/lesson/LessonTry.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { lessonById, tryProblem, type Lesson } from '@/domain/lessons'
import { answerOf } from '@/domain/problem'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import { ProgressProvider } from '@/ui/ProgressProvider'
import { setBeads } from '@/ui/session/testing'
import { LessonTry } from './LessonTry'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
})

function lesson(id: string): Lesson {
  const found = lessonById(id)
  if (found === null) throw new Error(`no lesson ${id}`)
  return found
}

// A random that always picks the first choice, so the problem is known.
const first = () => 0

async function renderTry(id: string, onLeave = jest.fn()) {
  render(
    <ProgressProvider>
      <LessonTry lesson={lesson(id)} onLeave={onLeave} random={first} />
    </ProgressProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
  return onLeave
}

describe('LessonTry', () => {
  it('asks a problem like the lesson’s, on the solid beads', async () => {
    await renderTry('add:five')
    expect(screen.getByText('やってみよう')).toBeTruthy()
    const problem = tryProblem(lesson('add:five'), first)
    expect(screen.getByTestId('prompt').props.children).toBe(`${problem.a}に${problem.b}をたす。`)
    expect(screen.getByTestId('soroban-wrap')).toBeTruthy()
  })

  it('stamps a right answer, then draws another problem', async () => {
    await renderTry('add:five')
    const problem = tryProblem(lesson('add:five'), first)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    const next = tryProblem(lesson('add:five'), first, problem)
    expect(screen.getByTestId('prompt').props.children).toBe(`${next.a}に${next.b}をたす。`)
    expect(screen.queryByTestId('maru')).toBeNull()
  })

  it('leaves through おわる', async () => {
    const onLeave = await renderTry('mul:1')
    const problem = tryProblem(lesson('mul:1'), first)
    setBeads(screen.getByTestId, answerOf(problem) + 1, 2)
    fireEvent.press(screen.getByTestId('submit'))
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  // Spec §2: nothing here reaches progress.
  it('records nothing', async () => {
    await renderTry('add:five')
    const problem = tryProblem(lesson('add:five'), first)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    await act(async () => {})
    expect(mockSave).not.toHaveBeenCalled()
  })

  // Review focus: a borrow starts from 1 on the tens rod.
  it('takes a borrowing move from 1 on the tens rod', async () => {
    await renderTry('sub:ten')
    const problem = tryProblem(lesson('sub:ten'), first)
    expect(problem.a).toBeGreaterThanOrEqual(10)
    expect(screen.getByTestId('prompt').props.children).toBe(`${problem.a}から${problem.b}をひく。`)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/ui/session/QuestionView.test.tsx src/ui/lesson/LessonTry.test.tsx`
Expected: FAIL: there is no `after-again`, and `Cannot find module './LessonTry'`.

- [ ] **Step 3: Implement**

In `src/ui/session/QuestionView.tsx`:
- after the `Submission` type's export, add:

```ts
// Outside a round (a lesson's やってみよう, spec (howto tutorial) §2): once
// the question is answered, right or wrong, its bottom row offers leaving,
// or another problem through onMoveOn, in place of もどす/こたえる, the
// keypad, or つぎへ. A round leaves it out: a right answer rolls on by
// itself, and a miss has つぎへ.
export type AfterAnswer = { leaveLabel: string; onLeave: () => void; againLabel: string }
```

- add `afterAnswer,` to the destructured props and `afterAnswer?: AfterAnswer` to the props type;
- in `submit()`, move `guardFrom.current = t` from the miss branch to just before `if (correct) {`, with this comment above it:

```ts
    // Either way, the moment after an answer takes no つぎへ, もう一問 or
    // おわる: a double tap on こたえる must not skip the 〇 or the review.
```

- just after the `answered` / `given` constants, add:

```tsx
  const afterAnswerRow =
    afterAnswer !== undefined && answered ? (
      <View style={styles.buttonRow}>
        <View style={styles.reviewSlot}>
          <Button
            testID="after-leave"
            variant="outline"
            label={afterAnswer.leaveLabel}
            onPress={() => {
              if (!guarded(now())) afterAnswer.onLeave()
            }}
          />
        </View>
        <View style={styles.reviewSlot}>
          <Button testID="after-again" label={afterAnswer.againLabel} onPress={moveOn} />
        </View>
      </View>
    ) : null
```

- in bead mode, wrap the bottom-row expression `{review !== null ? (reviewButtons) : beforeAnswer ? null : (…row…)}` as `{afterAnswerRow ?? (review !== null ? (reviewButtons) : beforeAnswer ? null : (…row…))}`;
- in keypad mode, replace the final `{review !== null ? (<>…</>) : beforeAnswer ? (stepControls) : (<AnswerPad … />)}` with:

```tsx
      {afterAnswerRow !== null ? (
        <>
          {review !== null ? stepControls : null}
          {afterAnswerRow}
        </>
      ) : review !== null ? (
        <>
          {stepControls}
          {reviewButtons}
        </>
      ) : beforeAnswer ? (
        stepControls
      ) : (
        <AnswerPad
          value={answer}
          onChange={setAnswer}
          onSubmit={submit}
          submitLabel={strings.answer}
          submitTestID="submit"
          // The answer always fits the soroban's rods: 2 for a single move,
          // the operands' digit count + 1 for ＋ −, that count × 2 for ×,
          // and 2N + 1 for ÷, whose quotient has only N digits.
          maxDigits={exercise.rods}
        />
      )}
```

Create `src/ui/round/ProblemQuestion.tsx`. It moves the body of RoundRunner's `question()` (from `const exercise = …` through the `<QuestionView …/>`), keeping every comment:

```tsx
import { exerciseForProblem } from '@/domain/exercise'
import { answerModeForFade, coachingForFade, type FadeLevel } from '@/domain/fade'
import { groupOfStep, problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { QuestionView, type AfterAnswer, type Submission } from '@/ui/session/QuestionView'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'

// One problem as a question: QuestionView with the problem's correction
// card, its 見取算 column or its operand board. A round and a lesson's
// やってみよう ask problems the same way.
export function ProblemQuestion({
  problem,
  fade,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
  afterAnswer,
}: {
  problem: Problem
  fade: FadeLevel
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: () => void
  afterAnswer?: AfterAnswer
}) {
  const strings = useStrings()
  const exercise = exerciseForProblem(problem)
  // QuestionView decides bead vs. keypad from the same fade (see its own
  // `mode`). The review card needs it too: a ÷ miss's beads were checked
  // against expectedBeads (the final soroban reading), so only in bead mode
  // does its answer line say more than the quotient.
  const mode = answerModeForFade(fade)
  const groups = problemSteps(problem)
  // The group of the move the learner has stepped to, if any: an index into
  // `groups` for the answer card's lines, and the group itself for the
  // operand (or divisor) board. Both follow it.
  const groupIndexOf = (activeStep: number | undefined) =>
    activeStep === undefined ? undefined : groupOfStep(groups, activeStep)
  const groupOf = (activeStep: number | undefined) => {
    const found = groupIndexOf(activeStep)
    return found === undefined ? undefined : groups[found]
  }

  return (
    <QuestionView
      exercise={exercise}
      fade={fade}
      coaching={coachingForFade(fade)}
      prompt={strings.problemPrompt(problem)}
      renderSteps={({ activeStep, showAnswer, given }) => (
        <ProblemCorrectionCard
          problem={problem}
          expected={exercise.expected}
          expectedBeads={mode === 'beads' ? exercise.expectedBeads : undefined}
          activeGroup={groupIndexOf(activeStep)}
          showAnswer={showAnswer}
          given={given}
        />
      )}
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
      // 両落とし leaves both numbers off the soroban, so a × problem shows
      // them on a board of their own beneath it, and 商除法 leaves the
      // divisor off, so a ÷ problem shows that (see OperandBoard).
      renderBeneath={
        problem.op === 'mul' || problem.op === 'div'
          ? (activeStep) => <OperandBoard problem={problem} activeGroup={groupOf(activeStep)} />
          : undefined
      }
      shownAt={shownAt}
      now={now}
      onSubmit={onSubmit}
      onMoveOn={() => onMoveOn()}
      afterAnswer={afterAnswer}
    />
  )
}
```

In `src/ui/round/RoundRunner.tsx`, replace `question()` with:

```tsx
  function question(at: number, problem: Problem) {
    function submitted({ correct, latencyMs, assisted }: Submission) {
      const pace = latencyMs === null ? null : latencyMs / problemTargetMs(problem, calibrationMs)
      // An answer with help counts in the tally below all the same; it is the
      // record that leaves it out (spec (core rounds) §5).
      onAttempt({ id: practiceId(kind), correct, pace, assisted })
      setTally((previous) => ({
        answered: previous.answered + 1,
        correct: previous.correct + (correct ? 1 : 0),
      }))
      if (correct) {
        // Held under its 〇, then swiped away (spec (roll) §3).
        setRolling(true)
        hold.current = setTimeout(() => {
          hold.current = null
          roll(at)
        }, ROLL_HOLD_MS)
      }
    }

    return (
      <ProblemQuestion
        problem={problem}
        fade={fade}
        shownAt={shownAt}
        now={now}
        onSubmit={submitted}
        onMoveOn={() => roll(at)}
      />
    )
  }
```

Then fix RoundRunner's imports:
- remove `exerciseForProblem`, `answerModeForFade`, `coachingForFade`, `groupOfStep`, `problemSteps`, `TermColumn`, `OperandBoard`, `ProblemCorrectionCard`, and the value import `QuestionView`;
- keep `type FadeLevel`, `type Submission` (as `import type { Submission } from '@/ui/session/QuestionView'`), `practiceId`, `problemTargetMs`, `type PracticeKind` and `type Problem`;
- add `import { ProblemQuestion } from './ProblemQuestion'`.

Create `src/ui/lesson/LessonTry.tsx`:

```tsx
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tryProblem, type Lesson } from '@/domain/lessons'
import { useStrings } from '@/i18n'
import { ProblemQuestion } from '@/ui/round/ProblemQuestion'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (howto tutorial) §2: やってみよう. A problem like the lesson's, on the
// beads drawn solid (fade 0, whose coaching opens the step panel with a
// miss's ✕), answered as in a round but recorded nowhere: nothing here
// reaches progress. もう一問 draws another; おわる leaves.
export function LessonTry({
  lesson,
  onLeave,
  random = Math.random,
}: {
  lesson: Lesson
  onLeave: () => void
  random?: () => number
}) {
  const strings = useStrings()
  // `n` keys the question, so another problem starts afresh.
  const [draw, setDraw] = useState(() => ({ n: 0, problem: tryProblem(lesson, random) }))
  const again = () => setDraw((previous) => ({ n: previous.n + 1, problem: tryProblem(lesson, random, previous.problem) }))

  return (
    <View style={styles.try}>
      <Text accessibilityRole="header" style={styles.title}>
        {strings.lessonTry}
      </Text>
      <ProblemQuestion
        key={draw.n}
        problem={draw.problem}
        fade={0}
        // Bead answers are untimed, so the clock is never read for pace.
        shownAt={0}
        now={Date.now}
        onSubmit={() => {}}
        onMoveOn={again}
        afterAnswer={{ leaveLabel: strings.done, onLeave, againLabel: strings.lessonAgain }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  try: { flex: 1 },
  title: { marginTop: space.sm, fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all pass. RoundRunner's suite passes unchanged, which shows the extraction kept the round's behaviour. Typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/round src/ui/session/QuestionView.tsx src/ui/session/QuestionView.test.tsx src/ui/lesson
git commit -m "Add やってみよう: one problem like the lesson's, recorded nowhere

RoundRunner's per-problem wiring moves into ProblemQuestion, which
やってみよう shares. Outside a round, an answered question offers おわる
and もう一問 in place of its bottom row, guarded like つぎへ against a
double tap on こたえる.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The lesson screen

**Files:**
- Create: `src/ui/lesson/LessonScreen.tsx`, `app/lesson/[id].tsx`
- Modify: `app/_layout.tsx` (declare `lesson/[id]` with the walkthroughs' swipe rule)
- Test: `__tests__/lesson-screen.test.tsx` (new), `__tests__/layout.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `lessonById`, `type Lesson`;
  - from Task 2: `completeLesson`;
  - from Task 3: `strings.lessonStartRound`, `strings.lessonTry`;
  - from Task 4: `LessonWalkthrough`;
  - from Task 5: `LessonTry`;
  - existing: `strings.introExit`, `strings.loadingProgress`.
- Produces:
  - Route `/lesson/[id]`, with optional `?kind=` (a round to lead into, honoured only when it is the lesson's own kind).
  - testIDs: `intro-exit` (✕), and `hydrating` while loading.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lesson-screen.test.tsx`:

```tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import LessonRoute from '../app/lesson/[id]'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockParams: { current: Record<string, string> } = { current: {} }
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockCanGoBack = { current: true }
const mockRedirect = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
    canGoBack: () => mockCanGoBack.current,
  },
  useLocalSearchParams: () => mockParams.current,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
}))

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockParams.current = {}
  mockCanGoBack.current = true
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, daysPracticed: 4 })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
})

async function renderLesson(params: Record<string, string>) {
  mockParams.current = params
  render(
    <ProgressProvider>
      <LessonRoute />
    </ProgressProvider>,
  )
  await act(async () => {})
}

// ▶ until the walkthrough's last button (at most 80 presses).
function pageToEnd() {
  for (let i = 0; i < 80 && screen.queryByTestId('intro-finish') === null; i++) {
    fireEvent.press(screen.queryByTestId('intro-next') ?? screen.getByTestId('walk-next'))
  }
}

describe('Lesson screen', () => {
  // Review focus: finishing before the load would save over the learner's
  // progress.
  it('shows a loading state before progress has hydrated', () => {
    mockParams.current = { id: 'add:five' }
    mockLoad.mockReturnValueOnce(new Promise(() => {}))
    render(
      <ProgressProvider>
        <LessonRoute />
      </ProgressProvider>,
    )
    expect(screen.getByTestId('hydrating')).toBeTruthy()
    expect(screen.queryByTestId('intro-next')).toBeNull()
  })

  // Review focus: a deep link to a lesson that does not exist.
  it('goes Home for a lesson it does not know', async () => {
    await renderLesson({ id: 'add:9' })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // Spec (howto tutorial) §3–4.
  it('walks the lesson to やってみよう, counting it done there', async () => {
    await renderLesson({ id: 'add:five' })
    pageToEnd()
    expect(screen.getByText('やってみよう')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    expect(mockSave.mock.calls[mockSave.mock.calls.length - 1]?.[0]).toMatchObject({
      lessonsSeen: ['add:five'],
      daysPracticed: 4,
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('leaves through ✕ at any point, counting the lesson done', async () => {
    await renderLesson({ id: 'sub:2' })
    expect(screen.getByTestId('intro-exit').props.accessibilityLabel).toBe('説明をやめる')
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ lessonsSeen: ['sub:2'] })
  })

  it('leaves やってみよう through ✕ too', async () => {
    await renderLesson({ id: 'add:five' })
    pageToEnd()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  })

  it('goes Home through ✕ when there is nothing to go back to', async () => {
    mockCanGoBack.current = false
    await renderLesson({ id: 'mul:1' })
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('starts the round it was opened before, without やってみよう', async () => {
    await renderLesson({ id: 'mul:2', kind: 'mul:2' })
    pageToEnd()
    expect(screen.getByText('練習をはじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'mul:2' } }))
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ lessonsSeen: ['mul:2'] })
    expect(screen.queryByText('やってみよう')).toBeNull()
  })

  it('ignores a round of another kind', async () => {
    await renderLesson({ id: 'mul:2', kind: 'mul:3' })
    pageToEnd()
    expect(screen.getByText('やってみよう')).toBeTruthy()
  })

  // Review focus: double taps.
  it('starts the round once when 練習をはじめる is tapped twice', async () => {
    await renderLesson({ id: 'div:1', kind: 'div:1' })
    pageToEnd()
    fireEvent.press(screen.getByTestId('intro-finish'))
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('leaves once when ✕ is tapped twice', async () => {
    await renderLesson({ id: 'add:ten' })
    fireEvent.press(screen.getByTestId('intro-exit'))
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledTimes(1)
  })
})
```

In `__tests__/layout.test.tsx`, add `['lesson/[id]', 'mul:2'],` to the `it.each` list of routes whose swipe back is allowed only without a round.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/lesson-screen.test.tsx __tests__/layout.test.tsx`
Expected: FAIL: `Cannot find module '../app/lesson/[id]'`, and no options for `lesson/[id]`.

- [ ] **Step 3: Implement**

Create `src/ui/lesson/LessonScreen.tsx`:

```tsx
import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Lesson } from '@/domain/lessons'
import { practiceId } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { LessonTry } from './LessonTry'
import { LessonWalkthrough } from './LessonWalkthrough'

// Spec (howto tutorial) §3: a lesson, opened from its operation's page, or
// with a round's `kind` before that round. Its ✕ leaves at any point. The
// lesson counts as done when it is left, when やってみよう is reached, or
// when 練習をはじめる starts the round (§4).
export function LessonScreen({ lesson }: { lesson: Lesson }) {
  const { hydrated, completeLesson } = useProgress()
  const strings = useStrings()
  // The round this lesson leads into: only a round of its own kind, since
  // ?kind= arrives from outside.
  const param = useLocalSearchParams().kind
  const kind = param === practiceId({ op: lesson.op, digits: lesson.digits }) ? param : null
  const [trying, setTrying] = useState(false)
  // Leaving saves first; a second tap meanwhile must not save or navigate
  // twice. Reaching やってみよう is guarded the same way.
  const leaving = useRef(false)
  const reached = useRef(false)

  function leave(startRound: boolean) {
    if (leaving.current) return
    leaving.current = true
    void completeLesson(lesson.id).then(() => {
      if (startRound && kind !== null) router.replace({ pathname: '/round', params: { kind } })
      else if (router.canGoBack()) router.back()
      else router.replace('/')
    })
  }

  function finishWalkthrough() {
    if (kind !== null) {
      leave(true)
      return
    }
    if (reached.current) return
    reached.current = true
    void completeLesson(lesson.id)
    setTrying(true)
  }

  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      {/* The same ✕, at the same place, as a round's (RoundTrack). */}
      <View style={styles.bar}>
        <Pressable
          testID="intro-exit"
          accessibilityRole="button"
          accessibilityLabel={strings.introExit}
          onPress={() => leave(false)}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      {trying ? (
        <LessonTry lesson={lesson} onLeave={() => leave(false)} />
      ) : (
        <LessonWalkthrough
          lesson={lesson}
          finishLabel={kind !== null ? strings.lessonStartRound : strings.lessonTry}
          onFinish={finishWalkthrough}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', height: 28 },
})
```

Create `app/lesson/[id].tsx`:

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router'
import { lessonById } from '@/domain/lessons'
import { LessonScreen } from '@/ui/lesson/LessonScreen'

// Spec (howto tutorial) §3: /lesson/add:five, or /lesson/mul:2?kind=mul:2
// before a round. An id it does not know goes Home.
export default function LessonRoute() {
  const lesson = lessonById(useLocalSearchParams().id)
  if (lesson === null) return <Redirect href="/" />
  return <LessonScreen lesson={lesson} />
}
```

In `app/_layout.tsx`:
- add `<Stack.Screen name="lesson/[id]" options={walkthroughOptions} />` after the `divide-intro` screen;
- change the comment above `walkthroughOptions` to: `// Spec (howto tutorial) §3: opened with a round's kind, a lesson leads into that round, so it is left only through its last button or ✕, as a round is. Opened from an operation's page (no kind) it leads nowhere, so an edge swipe back is fine.`

Regenerate the typed routes, then check:

```bash
npx expo start --port 8081 > "$CLAUDE_JOB_DIR/tmp/metro-types.log" 2>&1 &
until grep -q 'lesson/\[id\]' .expo/types/router.d.ts; do :; done
kill %1
```

(If the grep has not matched within a minute, open `exp://127.0.0.1:8081` on the simulator to make Metro bundle, then kill it.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all pass; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/lesson/LessonScreen.tsx "app/lesson/[id].tsx" app/_layout.tsx __tests__/lesson-screen.test.tsx __tests__/layout.test.tsx
git commit -m "Add the lesson screen

/lesson/[id] plays a lesson to やってみよう, or with its round's kind to
練習をはじめる. ✕ leaves at any point; all three count the lesson done.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: An operation's page

**Files:**
- Create: `src/ui/lesson/HowToScreen.tsx`, `app/howto/[op].tsx`
- Test: `__tests__/howto-screen.test.tsx` (new)

**Interfaces:**
- Consumes:
  - from Task 1: `lessonsFor`, `type Lesson`;
  - from Task 2: `progress.lessonsSeen`;
  - from Task 3: `strings.howToTitle`, `strings.lessonRow`, `strings.lessonRowLabel`;
  - existing: `strings.digitsName`, `BackLink`.
- Produces:
  - Route `/howto/[op]` (op ∈ add, sub, mul, div).
  - testIDs: `lesson-<id>` (a row) and `lesson-done-<id>` (its ✓).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/howto-screen.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import HowToRoute from '../app/howto/[op]'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockParams: { current: Record<string, string> } = { current: {} }
const mockPush = jest.fn()
const mockRedirect = jest.fn()
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { useEffect } = require('react')
  return {
    router: { push: (href: unknown) => mockPush(href) },
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect])
    },
    // BackLink's Link: its child stands in for it.
    Link: ({ children }: { children?: import('react').ReactNode }) => children,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href)
      return null
    },
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
})

async function renderPage(op: string, progress: Partial<Progress> = {}) {
  mockParams.current = { op }
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, ...progress })
  render(
    <ProgressProvider>
      <HowToRoute />
    </ProgressProvider>,
  )
  await act(async () => {})
}

const rowIds = () => screen.getAllByTestId(/^lesson-(?!done)/).map((row) => row.props.testID)

describe('An operation’s page', () => {
  // Spec (howto tutorial) §3.
  it('lists the operation’s lessons under their 桁数, in order', async () => {
    await renderPage('add')
    expect(screen.getByText('たし算のやりかた')).toBeTruthy()
    expect(rowIds()).toEqual([
      'lesson-add:direct',
      'lesson-add:five',
      'lesson-add:ten',
      'lesson-add:both',
      'lesson-add:2',
      'lesson-add:3',
    ])
    for (const heading of ['1けた', '2けた', '3けた']) expect(screen.getByText(heading)).toBeTruthy()
    expect(screen.getByText('五の合成　4＋3')).toBeTruthy()
    expect(screen.getByText('47＋38')).toBeTruthy()
  })

  it('has one lesson per 桁数 for × and ÷', async () => {
    await renderPage('div')
    expect(rowIds()).toEqual(['lesson-div:1', 'lesson-div:2', 'lesson-div:3'])
    expect(screen.getByText('56÷7')).toBeTruthy()
  })

  it('marks the lessons done', async () => {
    await renderPage('add', { lessonsSeen: ['add:five', 'add:2'] })
    expect(screen.getByTestId('lesson-done-add:five')).toBeTruthy()
    expect(screen.getByTestId('lesson-done-add:2')).toBeTruthy()
    expect(screen.queryByTestId('lesson-done-add:ten')).toBeNull()
    expect(screen.getByTestId('lesson-add:five').props.accessibilityLabel).toBe('五の合成　4＋3、できた')
    expect(screen.getByTestId('lesson-add:ten').props.accessibilityLabel).toBe('十の繰上　8＋5')
  })

  // Review focus: a double tap must not stack two lessons.
  it('opens a lesson, once under a double tap', async () => {
    await renderPage('sub')
    fireEvent.press(screen.getByTestId('lesson-sub:ten'))
    fireEvent.press(screen.getByTestId('lesson-sub:ten'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: 'sub:ten' } })
  })

  // Review focus: a deep link to an operation that has no page.
  it('goes Home for an operation it does not know', async () => {
    await renderPage('mitori')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/howto-screen.test.tsx`
Expected: FAIL, with `Cannot find module '../app/howto/[op]'`.

- [ ] **Step 3: Implement**

Create `src/ui/lesson/HowToScreen.tsx`:

```tsx
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { lessonsFor, type Lesson } from '@/domain/lessons'
import { DIGITS, type PairOperation } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { BackLink } from '@/ui/kit/BackLink'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

// Spec (howto tutorial) §3: an operation's lessons, under their 桁数, each
// with a ✓ once done. A row opens its lesson.
export function HowToScreen({ op }: { op: PairOperation }) {
  const { progress } = useProgress()
  const strings = useStrings()
  // As Home's: a double tap must not stack a second lesson on the first. It
  // clears when this page regains focus.
  const leaving = useRef(false)
  useFocusEffect(
    useCallback(() => {
      leaving.current = false
    }, []),
  )

  const open = (lesson: Lesson) => {
    if (leaving.current) return
    leaving.current = true
    router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })
  }
  const lessons = lessonsFor(op)

  return (
    <Screen>
      <BackLink />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          {strings.howToTitle(op)}
        </Text>
        {DIGITS.map((digits) => (
          <View key={digits} style={styles.section}>
            <Text style={styles.heading}>{strings.digitsName(digits)}</Text>
            {lessons
              .filter((lesson) => lesson.digits === digits)
              .map((lesson) => {
                const done = progress.lessonsSeen.includes(lesson.id)
                return (
                  <Pressable
                    key={lesson.id}
                    testID={`lesson-${lesson.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={strings.lessonRowLabel(lesson, done)}
                    onPress={() => open(lesson)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowLabel}>{strings.lessonRow(lesson)}</Text>
                    {done ? (
                      <Text testID={`lesson-done-${lesson.id}`} style={styles.check}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                )
              })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  section: { marginTop: space.lg, gap: space.sm },
  heading: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  // The kit Button's height, so every row is a full tap target.
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.85 },
  rowLabel: { flexShrink: 1, fontSize: fontSizes.body, color: colors.ink },
  check: { fontSize: fontSizes.title, color: colors.ok },
})
```

Create `app/howto/[op].tsx`:

```tsx
import { Redirect, useLocalSearchParams } from 'expo-router'
import type { PairOperation } from '@/domain/problem'
import { HowToScreen } from '@/ui/lesson/HowToScreen'

const OPS: readonly PairOperation[] = ['add', 'sub', 'mul', 'div']

// Spec (howto tutorial) §3: /howto/add and so on. An operation it does not
// know goes Home.
export default function HowToRoute() {
  const param = useLocalSearchParams().op
  const op = OPS.find((candidate) => candidate === param)
  if (op === undefined) return <Redirect href="/" />
  return <HowToScreen op={op} />
}
```

Regenerate the typed routes:

```bash
npx expo start --port 8081 > "$CLAUDE_JOB_DIR/tmp/metro-types.log" 2>&1 &
until grep -q 'howto/\[op\]' .expo/types/router.d.ts; do :; done
kill %1
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all pass; typecheck and lint exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/ui/lesson/HowToScreen.tsx "app/howto/[op].tsx" __tests__/howto-screen.test.tsx
git commit -m "Add each operation's page of lessons

/howto/[op] lists an operation's lessons under their 桁数, with a ✓ once
done; a row opens its lesson.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Home's four buttons, the round's lesson, and the old routes gone

**Files:**
- Modify: `app/index.tsx` (four buttons in two rows of two, to `/howto/[op]`)
- Modify: `app/round.tsx` (open `/lesson/[id]?kind=` only when the lesson is unseen and the kind unplayed)
- Modify: `app/_layout.tsx` (drop the `multiply-intro` and `divide-intro` screens)
- Delete:
  - `app/multiply-intro.tsx`, `app/divide-intro.tsx`
  - `src/ui/intro/IntroScreen.tsx`
  - `__tests__/multiply-intro-screen.test.tsx`, `__tests__/divide-intro-screen.test.tsx`
- Modify: `src/i18n/ja.ts`, `src/i18n/en.ts` (remove `homeHowTo`, `homeHowToDivide`, `homeHowToButton`, `homeHowToDivideButton`)
- Modify: `README.md`
- Test:
  - `__tests__/home.test.tsx`
  - `__tests__/round-screen.test.tsx`
  - `__tests__/layout.test.tsx`
  - `src/i18n/catalogs.test.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `lessonForKind`;
  - from Task 3: `strings.howToButton`, `strings.howToTitle`;
  - existing: `strings.homeHowToSection`, `HOW_TO_STACK_SCALE`;
  - routes: `/howto/[op]` (Task 7), `/lesson/[id]` (Task 6).
- Produces:
  - Home testIDs `home-howto-add`, `home-howto-sub`, `home-howto-mul`, `home-howto-div`, and `home-howto-row` (each row).

- [ ] **Step 1: Write the failing tests**

In `__tests__/home.test.tsx`:
- Replace the test `'offers the walkthroughs as two full-size buttons under a やりかた heading'` with:

```tsx
  // Spec (howto tutorial) §3: four buttons under やりかた, each opening its
  // operation's page.
  it('offers the four operations’ lessons as full-size buttons under a やりかた heading', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, getByText } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto-add')).toBeTruthy())
    expect(getByText('やりかた')).toBeTruthy()
    const buttons = { add: ['＋ たし算', 'たし算のやりかた'], sub: ['− ひき算', 'ひき算のやりかた'], mul: ['× かけ算', 'かけ算のやりかた'], div: ['÷ わり算', 'わり算のやりかた'] }
    for (const [op, [label, spoken]] of Object.entries(buttons)) {
      expect(getByTestId(`home-howto-${op}`)).toHaveTextContent(label ?? '')
      expect(getByTestId(`home-howto-${op}`).props.accessibilityLabel).toBe(spoken)
      expect(StyleSheet.flatten(getByTestId(`home-howto-${op}`).props.style).minHeight).toBe(BUTTON_HEIGHT)
    }
  })

  it.each(['add', 'sub', 'mul', 'div'])('opens the %s page from its button', async (op) => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId(`home-howto-${op}`)).toBeTruthy())
    fireEvent.press(getByTestId(`home-howto-${op}`))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/howto/[op]', params: { op } })
  })
```

- Replace the `it.each` test `'lays the two buttons out %s'` with one that counts rows. Keep its `useWindowDimensions` spy and `try/finally` exactly as they are; only the table, the test name and the assertions change:

```tsx
  it.each([
    ['in two rows of two at the usual text size', 1, 2],
    ['one per row at a large text size', 1.35, 4],
  ])('lays the four buttons out %s', async (_size, fontScale, rows) => {
    // As in RoundRunner.test.tsx: `require` reaches the module object the
    // screen's own imports read from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale })
    try {
      mockLoad.mockResolvedValue(learner({}))
      const { getByTestId, getAllByTestId } = renderHome()
      await waitFor(() => expect(getByTestId('home-howto-add')).toBeTruthy())
      expect(getAllByTestId('home-howto-row')).toHaveLength(rows)
    } finally {
      spy.mockRestore()
    }
  })
```

- Delete the tests `'opens the multiplication walkthrough from the home かけ算 button'` and `'opens the division walkthrough from the home わり算 button'`.
- In the three double-tap tests, use `home-howto-mul` for `home-howto` and keep `home-howto-div`. Change their expectation `expect(mockPush).toHaveBeenCalledWith('/multiply-intro')` to `expect(mockPush).toHaveBeenCalledWith({ pathname: '/howto/[op]', params: { op: 'mul' } })`.

In `__tests__/round-screen.test.tsx`, replace the × / ÷ walkthrough tests (from `'shows how multiplication works before the first × round'` through `'still shows how multiplication works when only the ÷ walkthrough has been seen'`) with:

```tsx
  // Spec (howto tutorial) §4: a × or ÷ kind never played opens its own
  // 桁数's lesson first, unless that lesson is done.
  it.each([['mul:1'], ['mul:2'], ['mul:3'], ['div:1'], ['div:2'], ['div:3']])(
    'opens the %s lesson before a first round of it',
    async (kind) => {
      mockParams.current = { kind }
      const { queryByTestId } = renderRound()
      await waitFor(() =>
        expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: kind, kind } }),
      )
      expect(queryByTestId('prompt')).toBeNull()
    },
  )

  it('plays a × round once its lesson is done', async () => {
    mockParams.current = { kind: 'mul:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['mul:2'] })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{2}に\d{2}をかける。$/)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('plays a ÷ round once its lesson is done', async () => {
    mockParams.current = { kind: 'div:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['div:2'] })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // Another size's lesson does not count for this one.
  it('opens the lesson for the round’s own 桁数', async () => {
    mockParams.current = { kind: 'mul:3' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['mul:2'] })
    renderRound()
    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: 'mul:3', kind: 'mul:3' } }),
    )
  })

  // A learner who has played a kind is not interrupted by its new lesson.
  it('plays a kind already practised without opening its lesson', async () => {
    mockParams.current = { kind: 'mul:3' }
    mockLoad.mockResolvedValue({
      ...emptyProgress(),
      tutorialDone: true,
      practices: { 'mul:3': { fade: 0, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 0 } },
    })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('never opens a lesson before ＋ or −', async () => {
    mockParams.current = { kind: 'add:1' }
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })
```

In `__tests__/layout.test.tsx`:
- reduce the `it.each` list to `[['lesson/[id]', 'mul:2']]` and rename the test to `'lets a swipe leave a lesson only when it has no round to lead into'`;
- in `'never lets a swipe leave a round'`, add:

```ts
    // Spec (howto tutorial) §3: the lesson screen took over the walkthroughs.
    expect(Object.keys(mockScreenOptions)).not.toContain('multiply-intro')
    expect(Object.keys(mockScreenOptions)).not.toContain('divide-intro')
```

In `src/i18n/catalogs.test.ts`, delete the tests `'names Home’s link to the walkthrough beside the × one'` and `'labels Home’s two walkthrough buttons, under their heading'`, and add in their place:

```ts
  it('heads Home’s lesson buttons', () => {
    expect(ja.homeHowToSection).toBe('やりかた')
    expect(en.homeHowToSection).toBe('How it works')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/home.test.tsx __tests__/round-screen.test.tsx __tests__/layout.test.tsx`
Expected: FAIL: there is no `home-howto-add`, the redirect goes to `/multiply-intro`, and the old screens are still declared.

- [ ] **Step 3: Implement**

In `app/index.tsx`:
- add `type PairOperation` to the `@/domain/problem` import;
- replace `openHowTo` with:

```tsx
  const openHowTo = (op: PairOperation) => {
    if (leaving.current) return
    leaving.current = true
    router.push({ pathname: '/howto/[op]', params: { op } })
  }
```

- replace the whole `howTos` block (the `{/* Spec (division) §3 … */}` comment, the heading and the buttons' `View`) with:

```tsx
        {/* Spec (howto tutorial) §3: each operation's lessons, from its own
            button. The owner (2026-09-29) found the small links hard to see
            and to tap, so they are full-size buttons under a heading of
            their own: two rows of two, or one per row at a large text size,
            where half the width no longer fits their labels. */}
        <Text style={styles.sectionTitle}>{strings.homeHowToSection}</Text>
        <View style={styles.howTos}>
          {howToRows.map((row) => (
            <View key={row.join()} testID="home-howto-row" style={styles.howToRow}>
              {row.map((op) => (
                <View key={op} style={styles.howTo}>
                  <Button
                    testID={`home-howto-${op}`}
                    variant="outline"
                    label={strings.howToButton(op)}
                    accessibilityLabel={strings.howToTitle(op)}
                    onPress={() => openHowTo(op)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
```

- just before the `return (` of the hydrated render, add:

```tsx
  const howToRows: PairOperation[][] = stackHowTos
    ? HOW_TO_OPS.map((op) => [op])
    : [HOW_TO_OPS.slice(0, 2), HOW_TO_OPS.slice(2)]
```

- next to `HOW_TO_STACK_SCALE`, add `const HOW_TO_OPS: readonly PairOperation[] = ['add', 'sub', 'mul', 'div']`;
- replace the `howTos`, `howTosStacked` and `howTo` styles with:

```ts
  // Rows of buttons, each button an equal share of its row.
  howTos: { gap: space.md },
  howToRow: { flexDirection: 'row', gap: space.md },
  howTo: { flex: 1 },
```

- update `HOW_TO_STACK_SCALE`'s comment to: `// The text size from which Home's lesson buttons stack: "− Subtract" fills half a 375 pt phone's width at about 1.25×.`

In `app/round.tsx`:
- add `import { lessonForKind } from '@/domain/lessons'`;
- replace the two walkthrough redirects (the `kind.op === 'mul' …` and `kind.op === 'div' …` blocks with their comment) with:

```tsx
  // Spec (howto tutorial) §4: a × or ÷ kind never played opens its own
  // 桁数's lesson first, unless that lesson is done. ＋ and − open none.
  const lesson = lessonForKind(kind)
  if (lesson !== null && progress.practices[practiceId(kind)] === undefined && !progress.lessonsSeen.includes(lesson.id)) {
    return <Redirect href={{ pathname: '/lesson/[id]', params: { id: lesson.id, kind: practiceId(kind) } }} />
  }
```

- add `practiceId` to its `@/domain/problem` import.

In `app/_layout.tsx`, delete the `multiply-intro` and `divide-intro` `Stack.Screen` lines.

Delete the old routes and screen, then regenerate the typed routes:

```bash
git rm app/multiply-intro.tsx app/divide-intro.tsx src/ui/intro/IntroScreen.tsx __tests__/multiply-intro-screen.test.tsx __tests__/divide-intro-screen.test.tsx
npx expo start --port 8081 > "$CLAUDE_JOB_DIR/tmp/metro-types.log" 2>&1 &
until ! grep -q 'multiply-intro' .expo/types/router.d.ts; do :; done
kill %1
```

In `src/i18n/ja.ts` and `src/i18n/en.ts`, delete the keys `homeHowTo`, `homeHowToDivide`, `homeHowToButton` and `homeHowToDivideButton`, with their comments; keep `homeHowToSection`.

In `README.md`:
- replace the **Walkthroughs** bullet with:

```markdown
- **やりかた**: a tutorial of its own, from Home's four buttons (＋ − × ÷), each opening that
  operation's lessons by 桁数. 1けた ＋ − are taught move by move (そのまま, 五の合成, 十の繰上,
  十の繰上と五の分解, and the − ones); every other size has one worked example. A lesson walks its
  example on the soroban step by step, then やってみよう asks one like it (recorded nowhere).
  The first round of a × or ÷ kind never played opens its lesson first, ending in 練習をはじめる;
  ✕ leaves any lesson at any point, and every lesson done gets a ✓.
```

- in the **Home** line, change "and the やりかた buttons." to "and the four やりかた buttons.".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all pass; typecheck and lint exit 0; `git grep -n "multiply-intro\|divide-intro\|IntroScreen\|homeHowToButton" -- app src __tests__` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add -A app src/i18n __tests__ README.md
git commit -m "Open the lessons from Home's four buttons and before new × ÷ rounds

Home's やりかた section has a button per operation. A × or ÷ round opens
its own 桁数's lesson only when that lesson is not done and the kind has
never been played. The old walkthrough routes and IntroScreen are gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Check it on the simulator, then ship

**Files:** none (verification and release).

**Interfaces:** consumes the whole branch.

- [ ] **Step 1: Look at it on the iPhone 17 Pro**

Follow the memory recipe (simulator-ui-verification):
- start Metro (`npx expo start --port 8081`);
- run `xcrun simctl terminate F04F4F02-42DD-4A32-828E-C06E0DF317B9 host.exp.Exponent`, then `xcrun simctl openurl … "exp://127.0.0.1:8081"`, twice if Expo Go stays in the background;
- screenshot each of these:
  - Home, with its four buttons in two rows;
  - `exp://127.0.0.1:8081/--/howto/add`, the ＋ page with 1けた's four rows;
  - `exp://127.0.0.1:8081/--/lesson/add:both`, its intro, its step page and its result;
  - やってみよう, answered right: the 〇, the number under the soroban, and もう一問 / おわる;
  - `exp://127.0.0.1:8081/--/lesson/div:3`, paged to its end.

Expected: the layouts read cleanly, and nothing is clipped or overlapping.

- [ ] **Step 2: Look at the small screen**

On the iPhone SE (95DD5FBC-2595-4DA3-A55E-A31E0D49CDB8), close Expo Go's dev menu with `tapOn: { point: "89%,49%" }`, then screenshot:
- Home, scrolled to the buttons;
- `/howto/sub`, whose longest row is 「十の繰下と五の合成　12−6」.

Expected: the rows wrap inside their boxes, and the buttons are full size.

- [ ] **Step 3: Stop Metro, and run the checks once more**

Run: `npx jest && npm run -s typecheck && npx expo lint .`
Expected: all green.

- [ ] **Step 4: TestFlight build 30 and a PR**

Follow `docs/release-ios.md`:
1. Bump `ios.buildNumber` to 30 and commit.
2. Run `CI=1 npx expo prebuild --platform ios`, then `git checkout package.json`.
3. Archive, and check that the embedded frameworks are all there.
4. Export and upload, then poll App Store Connect until build 30 is VALID.
5. Push `feature/howto-tutorial`.
6. Open a PR whose description ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
