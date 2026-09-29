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

// Spec (howto tutorial) §4: the lessons done, added without a schema bump.
// A document from before lessons existed has a flag per walkthrough seen,
// and those walkthroughs are now the × and ÷ 2けた lessons.
describe('lessonsSeen', () => {
  // A document as a phone had it before lessons existed.
  function before(flags: Record<string, unknown>) {
    const { lessonsSeen: _, ...rest } = { ...emptyProgress(), daysPracticed: 5 }
    return JSON.stringify({ ...rest, ...flags })
  }

  it('loads a document written before lessons existed with none done', async () => {
    mockGetItem.mockResolvedValue(before({}))
    const result = await loadProgress()
    expect(result.lessonsSeen).toEqual([])
    expect(result.daysPracticed).toBe(5)
  })

  it('keeps the lessons it knows and drops the rest', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), lessonsSeen: ['add:five', 'add:9', 7, 'div:3'] }),
    )
    expect((await loadProgress()).lessonsSeen).toEqual(['add:five', 'div:3'])
  })

  it('discards a lessonsSeen that is not a list', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...emptyProgress(), lessonsSeen: 'mul:2' }))
    expect((await loadProgress()).lessonsSeen).toEqual([])
  })

  it.each([
    [{ multiplyIntroDone: true }, ['mul:2']],
    [{ divideIntroDone: true }, ['div:2']],
    [{ multiplyIntroDone: true, divideIntroDone: true }, ['mul:2', 'div:2']],
    [{ multiplyIntroDone: 'yes', divideIntroDone: 1 }, []],
  ])('carries the walkthrough flags %p over as the lessons %p', async (flags, lessons) => {
    mockGetItem.mockResolvedValue(before(flags))
    const result = await loadProgress()
    expect(result.lessonsSeen).toEqual(lessons)
    expect(result).not.toHaveProperty('multiplyIntroDone')
    expect(result).not.toHaveProperty('divideIntroDone')
  })

  it('counts a lesson once when both its flag and its id are stored', async () => {
    mockGetItem.mockResolvedValue(
      JSON.stringify({ ...emptyProgress(), lessonsSeen: ['mul:2'], multiplyIntroDone: true }),
    )
    expect((await loadProgress()).lessonsSeen).toEqual(['mul:2'])
  })
})

describe('saveProgress', () => {
  it('writes under the versioned key', async () => {
    const progress = emptyProgress()
    await saveProgress(progress)
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(progress))
  })
})
