import AsyncStorage from '@react-native-async-storage/async-storage'
import { emptyProgress, SCHEMA_VERSION } from '@/domain/progress'
import { loadProgress, saveProgress, STORAGE_KEY } from './progressStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('loadProgress', () => {
  it('returns empty progress when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null)
    expect(await loadProgress()).toEqual(emptyProgress())
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('round-trips a saved document', async () => {
    const progress = { ...emptyProgress(), daysPracticed: 7 }
    mockGetItem.mockResolvedValue(JSON.stringify(progress))
    expect((await loadProgress()).daysPracticed).toBe(7)
  })

  it('falls back to empty progress on malformed JSON', async () => {
    mockGetItem.mockResolvedValue('{not json')
    expect(await loadProgress()).toEqual(emptyProgress())
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('discards a document from an unknown schema version', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, atoms: {} }))
    expect(await loadProgress()).toEqual(emptyProgress())
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('survives a storage failure', async () => {
    mockGetItem.mockRejectedValue(new Error('disk gone'))
    expect(await loadProgress()).toEqual(emptyProgress())
    expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('discards a wrong-typed atoms field in favour of the default', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION, atoms: 'garbage' }))
    expect((await loadProgress()).atoms).toEqual(emptyProgress().atoms)
  })

  it('discards a wrong-typed daysPracticed field in favour of the default', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION, daysPracticed: 'many' }))
    expect((await loadProgress()).daysPracticed).toBe(0)
  })

  it('defaults a missing field while keeping the rest of a valid document', async () => {
    const withoutTutorialDone = {
      schemaVersion: SCHEMA_VERSION,
      atoms: {},
      daysPracticed: 3,
      lastSessionDay: null,
      calibrationMs: emptyProgress().calibrationMs,
    }
    mockGetItem.mockResolvedValue(JSON.stringify(withoutTutorialDone))
    const result = await loadProgress()
    expect(result.daysPracticed).toBe(3)
    expect(result.tutorialDone).toBe(emptyProgress().tutorialDone)
  })
})

describe('saveProgress', () => {
  it('writes under the versioned key', async () => {
    const progress = emptyProgress()
    await saveProgress(progress)
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(progress))
  })
})
