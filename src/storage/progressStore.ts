import AsyncStorage from '@react-native-async-storage/async-storage'
import { emptyProgress, SCHEMA_VERSION, type Progress } from '@/domain/progress'

export const STORAGE_KEY = 'learning-abacus/progress/v1'

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
