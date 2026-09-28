import AsyncStorage from '@react-native-async-storage/async-storage'
import { isPracticeRecord } from '@/domain/practice'
import { isPracticeId } from '@/domain/problem'
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
      // Added without a schema bump: a document written before it existed
      // has not seen the walkthrough.
      multiplyIntroDone:
        typeof candidate.multiplyIntroDone === 'boolean' ? candidate.multiplyIntroDone : base.multiplyIntroDone,
      // Added without a schema bump, like multiplyIntroDone.
      divideIntroDone:
        typeof candidate.divideIntroDone === 'boolean' ? candidate.divideIntroDone : base.divideIntroDone,
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
