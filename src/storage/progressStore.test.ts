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

  it('discards a wrong-typed daysPracticed field in favour of the default', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION, daysPracticed: 'many' }))
    expect((await loadProgress()).daysPracticed).toBe(0)
  })

  it('defaults a missing field while keeping the rest of a valid document', async () => {
    const withoutTutorialDone = {
      schemaVersion: SCHEMA_VERSION,
      daysPracticed: 3,
      lastSessionDay: null,
      calibrationMs: emptyProgress().calibrationMs,
    }
    mockGetItem.mockResolvedValue(JSON.stringify(withoutTutorialDone))
    const result = await loadProgress()
    expect(result.daysPracticed).toBe(3)
    expect(result.tutorialDone).toBe(emptyProgress().tutorialDone)
  })

  // Spec (roll) §2: 基礎's fields are no longer read. A document written with
  // them still loads, and keeps everything else.
  it('loads a document that still has 基礎’s moves and stage, without them', async () => {
    const practices = { 'add:2': { fade: 3, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 5 } }
    mockGetItem.mockResolvedValue(
      JSON.stringify({
        ...emptyProgress(),
        atoms: { '1+3': { atomId: '1+3', box: 4, fade: 6 } },
        highestStage: 3,
        daysPracticed: 12,
        calibrationMs: 700,
        practices,
      }),
    )
    const loaded = await loadProgress()
    expect(loaded).not.toHaveProperty('atoms')
    expect(loaded).not.toHaveProperty('highestStage')
    expect(loaded.daysPracticed).toBe(12)
    expect(loaded.calibrationMs).toBe(700)
    expect(loaded.practices).toEqual(practices)
  })
})

describe('practices', () => {
  it('loads a document written before practices existed with none', async () => {
    const { practices: _, ...old } = emptyProgress()
    mockGetItem.mockResolvedValue(JSON.stringify(old))
    expect((await loadProgress()).practices).toEqual({})
  })

  it('keeps known kinds and drops unknown ids and malformed records', async () => {
    const good = { fade: 2, consecutiveCorrect: 1, consecutiveWrong: 0, lastPractisedAt: 5 }
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), practices: { 'add:2': good, 'pow:1': good, 'sub:1': { fade: 'x' } } }),
    )
    expect((await loadProgress()).practices).toEqual({ 'add:2': good })
  })

  it('keeps 見取算 records and drops a size that does not exist', async () => {
    const good = { fade: 1, consecutiveCorrect: 2, consecutiveWrong: 0, lastPractisedAt: 9 }
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), practices: { 'mitori:3': good, 'mitori:4': good } }),
    )
    expect((await loadProgress()).practices).toEqual({ 'mitori:3': good })
  })
})

describe('multiplyIntroDone', () => {
  it('loads a document written before the flag existed as not yet seen', async () => {
    // Added without a SCHEMA_VERSION bump: a document
    // already on a learner's phone arrives without it and must load intact.
    const { multiplyIntroDone: _, ...old } = { ...emptyProgress(), daysPracticed: 5 }
    mockGetItem.mockResolvedValue(JSON.stringify(old))
    const result = await loadProgress()
    expect(result.multiplyIntroDone).toBe(false)
    expect(result.daysPracticed).toBe(5)
  })

  it('keeps a stored true', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), multiplyIntroDone: true }))
    expect((await loadProgress()).multiplyIntroDone).toBe(true)
  })

  it.each([['yes'], [1], [null]])('discards a multiplyIntroDone of %p in favour of false', async (multiplyIntroDone) => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), multiplyIntroDone }))
    expect((await loadProgress()).multiplyIntroDone).toBe(false)
  })
})

// Spec (division) §3: the ÷ walkthrough's flag, added exactly like
// multiplyIntroDone.
describe('divideIntroDone', () => {
  it('loads a document written before the flag existed as not yet seen', async () => {
    const { divideIntroDone: _, ...old } = { ...emptyProgress(), daysPracticed: 5, multiplyIntroDone: true }
    mockGetItem.mockResolvedValue(JSON.stringify(old))
    const result = await loadProgress()
    expect(result.divideIntroDone).toBe(false)
    expect(result.multiplyIntroDone).toBe(true)
    expect(result.daysPracticed).toBe(5)
  })

  it('keeps a stored true', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), divideIntroDone: true }))
    const result = await loadProgress()
    expect(result.divideIntroDone).toBe(true)
    // The two walkthroughs are seen separately.
    expect(result.multiplyIntroDone).toBe(false)
  })

  it.each([['yes'], [1], [null]])('discards a divideIntroDone of %p in favour of false', async (divideIntroDone) => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), divideIntroDone }))
    expect((await loadProgress()).divideIntroDone).toBe(false)
  })
})

describe('saveProgress', () => {
  it('writes under the versioned key', async () => {
    const progress = emptyProgress()
    await saveProgress(progress)
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(progress))
  })
})
