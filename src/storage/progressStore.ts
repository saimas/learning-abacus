import AsyncStorage from '@react-native-async-storage/async-storage'
import { isPracticeRecord } from '@/domain/practice'
import { isPracticeId } from '@/domain/problem'
import { isLessonId, type LessonId } from '@/domain/lessons'
import { emptyProgress, SCHEMA_VERSION, type Progress } from '@/domain/progress'

export const STORAGE_KEY = 'learning-abacus/progress/v1'

// Keeps each record it can trust and drops the rest, rather than discarding
// the learner's whole history over one bad entry.
function asPractices(value: unknown): Progress['practices'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const practices: Progress['practices'] = {}
  for (const [id, record] of Object.entries(value)) {
    if (isPracticeId(id) && isPracticeRecord(record)) practices[id] = record
  }
  return practices
}

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

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// Spec (runs) §6: a best run kept only for a kind it knows, with a score it
// can trust.
function asBestRuns(value: unknown): Progress['bestRuns'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const best: Progress['bestRuns'] = {}
  for (const [id, score] of Object.entries(value)) {
    if (isPracticeId(id) && isCount(score)) best[id] = score
  }
  return best
}

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw === null) return emptyProgress()
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyProgress()
    const candidate = parsed as Partial<Progress>
    if (candidate.schemaVersion !== SCHEMA_VERSION) return emptyProgress()

    const base = emptyProgress()

    // Spec (roll) §2: a document written while 基礎の練習 existed also holds
    // its per-move records and stage. They are not read, so the next save
    // drops them.
    return {
      schemaVersion: SCHEMA_VERSION,
      daysPracticed:
        typeof candidate.daysPracticed === 'number' && Number.isFinite(candidate.daysPracticed)
          ? candidate.daysPracticed
          : base.daysPracticed,
      lastSessionDay:
        typeof candidate.lastSessionDay === 'string' || candidate.lastSessionDay === null
          ? candidate.lastSessionDay
          : base.lastSessionDay,
      calibrationMs:
        typeof candidate.calibrationMs === 'number' && Number.isFinite(candidate.calibrationMs)
          ? candidate.calibrationMs
          : base.calibrationMs,
      tutorialDone: typeof candidate.tutorialDone === 'boolean' ? candidate.tutorialDone : base.tutorialDone,
      // Added without a schema bump: a document written before it existed
      // simply has none.
      practices: asPractices(candidate.practices),
      lessonsSeen: asLessonsSeen(parsed as Record<string, unknown>),
      // Added without a schema bump (spec (runs) §6): a 1.0 document has neither.
      points: isCount(candidate.points) ? candidate.points : base.points,
      bestRuns: asBestRuns(candidate.bestRuns),
    }
  } catch {
    return emptyProgress()
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // A failed write costs at most the answers since the last save; never crash a round over it.
  }
}
