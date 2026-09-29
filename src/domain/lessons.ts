import { ATOMS, classify, decompose, startValue, type Atom, type AtomClass } from './atoms'
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
  workedLesson('add', 3, 575, 427),
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

// Whether a move's bead moves on the ones rod, if more than one, go opposite
// ways: a real complement (4 + 3 = +5 −2). The move list also classes a
// heaven and earth bead moved together as five or both (3 + 6 = +5 +1, or
// 9 + 3's −5 −2 after its carry), though nothing is taken back, and a
// technique lesson's words would not fit it.
function complements(atom: Atom): boolean {
  const directions = decompose(atom)
    .filter((step) => step.rod === 'working')
    .map((step) => Math.sign(step.delta))
  return directions.every((direction, i) => i === 0 || direction !== directions[i - 1])
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
      (atom) =>
        atom.direction === move.op && classify(atom) === move.technique && startValue(atom) > 0 && complements(atom),
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
