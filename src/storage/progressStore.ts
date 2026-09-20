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
    return { ...emptyProgress(), ...candidate } as Progress
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
