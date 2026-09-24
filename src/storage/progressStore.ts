import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StageIndex } from '@/domain/curriculum'
import { isPracticeRecord } from '@/domain/practice'
import { isPracticeId } from '@/domain/problem'
import { emptyProgress, SCHEMA_VERSION, type Progress } from '@/domain/progress'

export const STORAGE_KEY = 'learning-abacus/progress/v1'

// Narrows to the union rather than trusting any number: a stored 9 would put
// the learner on a stage that does not exist.
function asStageIndex(value: unknown, fallback: StageIndex): StageIndex {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4 ? value : fallback
}

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
    const atoms =
      typeof candidate.atoms === 'object' && candidate.atoms !== null && !Array.isArray(candidate.atoms)
        ? candidate.atoms
        : base.atoms

    return {
      schemaVersion: SCHEMA_VERSION,
      atoms,
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
      // Added without a schema bump: documents written before the latch
      // existed simply pick up the default here rather than being discarded.
      highestStage: asStageIndex(candidate.highestStage, base.highestStage),
      // Added without a schema bump, like highestStage.
      practices: asPractices(candidate.practices),
      // Added without a schema bump, like highestStage: a document written
      // before it existed has not seen the walkthrough.
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
    // A failed write costs at most one block of history; never crash a session over it.
  }
}
