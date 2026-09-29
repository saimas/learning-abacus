import { classify, decompose } from './atoms'
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
    expect(example).toEqual({ op: 'add', digits: 3, a: 575, b: 427 })
    expect(example !== undefined && problemSteps(example).some((group) => group.cascades)).toBe(true)
  })

  // Final review: a column named for a complement must be one, as in
  // tryProblem — or its line would contradict the move's own lesson.
  it('shows only real complements in its examples', () => {
    for (const lesson of LESSONS) {
      for (const group of problemSteps(lesson.example)) {
        if (group.kind !== 'column' || group.atom === null) continue
        const directions = decompose(group.atom).filter((step) => step.rod === 'working').map((step) => Math.sign(step.delta))
        expect(directions.every((direction, i) => i === 0 || direction !== directions[i - 1])).toBe(true)
      }
    }
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

  // The lessons' words describe a complement. The move list also classes a
  // heaven and earth bead moved together (3 + 6 = +5 +1, or 9 + 3's −5 −2
  // after its carry) as five or both, though nothing is taken back.
  it('draws only moves where the complement really happens', () => {
    const random = seeded(13)
    for (const id of ['add:five', 'add:both', 'sub:five', 'sub:both']) {
      const lesson = lessonById(id)
      if (lesson === null) throw new Error(`no lesson ${id}`)
      for (let i = 0; i < 300; i++) {
        const [group] = problemSteps(tryProblem(lesson, random))
        const atom = group?.kind === 'column' ? group.atom : null
        const directions = atom === null ? [] : decompose(atom).filter((step) => step.rod === 'working').map((step) => Math.sign(step.delta))
        expect(directions).toHaveLength(2)
        expect(directions[1]).toBe(-(directions[0] ?? 0))
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

  // The same seeded stream twice would draw the same problem again, but for
  // being told it was just asked.
  it('does not draw the problem it is told was just asked', () => {
    for (const lesson of LESSONS) {
      const first = tryProblem(lesson, seeded(5))
      expect(tryProblem(lesson, seeded(5), first)).not.toEqual(first)
    }
  })
})
