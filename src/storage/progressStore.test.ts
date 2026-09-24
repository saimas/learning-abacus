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

  it('survives a document stored before highestStage existed', async () => {
    // The field was added without a SCHEMA_VERSION bump, so every document
    // already on a learner's phone arrives without it. It must load intact
    // and simply pick up the default, not be discarded.
    const beforeTheLatch = {
      schemaVersion: SCHEMA_VERSION,
      atoms: { '1+3': { atomId: '1+3', box: 4, fade: 3, consecutiveCorrect: 2, consecutiveWrong: 0, recentLatencyMs: [400, 420, 390], dueAt: 0 } },
      daysPracticed: 41,
      lastSessionDay: '2026-09-20',
      calibrationMs: 730,
      tutorialDone: true,
    }
    mockGetItem.mockResolvedValue(JSON.stringify(beforeTheLatch))
    const result = await loadProgress()
    expect(result.highestStage).toBe(1)
    expect(result.daysPracticed).toBe(41)
    expect(result.calibrationMs).toBe(730)
    expect(result.tutorialDone).toBe(true)
    expect(result.lastSessionDay).toBe('2026-09-20')
    expect(result.atoms['1+3']?.box).toBe(4)
  })

  it('keeps a stored highestStage', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION, highestStage: 3 }))
    expect((await loadProgress()).highestStage).toBe(3)
  })

  it.each([['two'], [9], [-1], [2.5], [null]])(
    'discards a highestStage of %p in favour of the default',
    async (highestStage) => {
      mockGetItem.mockResolvedValue(JSON.stringify({ schemaVersion: SCHEMA_VERSION, highestStage }))
      expect((await loadProgress()).highestStage).toBe(1)
    },
  )
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
})

describe('multiplyIntroDone', () => {
  it('loads a document written before the flag existed as not yet seen', async () => {
    // Added without a SCHEMA_VERSION bump, like highestStage: a document
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
