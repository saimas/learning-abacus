import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Round from '../app/round'
import { ProgressProvider } from '@/ui/ProgressProvider'
import { ROLL_HOLD_MS, ROLL_SWIPE_MS } from '@/ui/round/RunRunner'
import { setBeads } from '@/ui/session/testing'

jest.mock('@/storage/progressStore')

// The route's search parameters, set per test.
const mockParams: { current: Record<string, string> } = { current: {} }
const mockRedirect = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams.current,
  // Records where the screen sent the learner instead of navigating.
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
}))

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  // Maru and the bead animations run on timers; fake ones keep their
  // callbacks inside the test, as in the session screen's tests.
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockParams.current = {}
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function renderRound() {
  return render(
    <ProgressProvider>
      <Round />
    </ProgressProvider>,
  )
}

function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// The sum on show, from its prompt (「AにBをたす。」).
function shownSum(): number {
  const match = /^(\d+)に(\d+)をたす。$/.exec(String(screen.getByTestId('prompt').props.children))
  if (match === null) throw new Error('not a sum')
  return Number(match[1]) + Number(match[2])
}

// Answers the 2けた sum on show, right or one too many.
function answerSum(right: boolean) {
  setBeads(screen.getByTestId, shownSum() + (right ? 0 : 1), 3)
  fireEvent.press(screen.getByTestId('submit'))
}

// ✕ asks with an alert; pressing やめる confirms.
function confirmQuits() {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.style === 'destructive')?.onPress?.()
  })
}

describe('Round screen', () => {
  it('plays a run of the kind it is given, once hydrated', async () => {
    mockParams.current = { kind: 'sub:2' }
    const { getByTestId, getAllByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{2}から\d{2}をひく。$/)
    expect(getByTestId('run-level').props.children).toBe('レベル 0/6')
    expect(getAllByTestId('life')).toHaveLength(3)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('goes home for a kind it does not know', async () => {
    mockParams.current = { kind: 'pow:1' }
    const { queryByTestId } = renderRound()
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/'))
    expect(queryByTestId('prompt')).toBeNull()
  })

  it('goes home when no kind is given', async () => {
    const { queryByTestId } = renderRound()
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/'))
    expect(queryByTestId('prompt')).toBeNull()
  })

  it("carries a kind's stored fade into the round", async () => {
    mockParams.current = { kind: 'add:2' }
    mockLoad.mockResolvedValue({
      ...emptyProgress(),
      tutorialDone: true,
      practices: { 'add:2': { fade: 3, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 0 } },
    })
    const { getByTestId, queryByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    // The owner (2026-09-30): answered on the beads at every level, the
    // beads drawn as faded as the level says (35% at level 3).
    expect(queryByTestId('key-1')).toBeNull()
    for (const layer of within(getByTestId('soroban-wrap')).getAllByTestId('fade-layer')) {
      expect(layer.props.style.opacity).toBe(0.35)
    }
  })

  // Spec (howto tutorial) §4: a × or ÷ kind never played opens its own
  // 桁数's lesson first, unless that lesson is done.
  it.each([['mul:1'], ['mul:2'], ['mul:3'], ['div:1'], ['div:2'], ['div:3']])(
    'opens the %s lesson before a first round of it',
    async (kind) => {
      mockParams.current = { kind }
      const { queryByTestId } = renderRound()
      await waitFor(() =>
        expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: kind, kind } }),
      )
      expect(queryByTestId('prompt')).toBeNull()
    },
  )

  it('plays a × round once its lesson is done', async () => {
    mockParams.current = { kind: 'mul:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['mul:2'] })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{2}に\d{2}をかける。$/)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('plays a ÷ round once its lesson is done', async () => {
    mockParams.current = { kind: 'div:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['div:2'] })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // Another size's lesson does not count for this one.
  it('opens the lesson for the round’s own 桁数', async () => {
    mockParams.current = { kind: 'mul:3' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, lessonsSeen: ['mul:2'] })
    renderRound()
    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: 'mul:3', kind: 'mul:3' } }),
    )
  })

  // A learner who has played a kind is not interrupted by its new lesson.
  it('plays a kind already practised without opening its lesson', async () => {
    mockParams.current = { kind: 'mul:3' }
    mockLoad.mockResolvedValue({
      ...emptyProgress(),
      tutorialDone: true,
      practices: { 'mul:3': { fade: 0, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 0 } },
    })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('never opens a lesson before ＋ or −', async () => {
    mockParams.current = { kind: 'add:1' }
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('starts a kind with no record in bead mode', async () => {
    mockParams.current = { kind: 'add:2' }
    const { getByTestId, queryByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('soroban-wrap')).toBeTruthy()
    expect(queryByTestId('key-1')).toBeNull()
  })

  // Review focus: the last run ended on a miss, which the record's streak
  // carries; a new run's first miss must not drop the level (spec (runs) §2).
  it('starts each run with the kind’s streaks afresh', async () => {
    mockParams.current = { kind: 'add:2' }
    mockLoad.mockResolvedValue({
      ...emptyProgress(),
      tutorialDone: true,
      practices: { 'add:2': { fade: 2, consecutiveCorrect: 0, consecutiveWrong: 1, lastPractisedAt: 0 } },
    })
    renderRound()
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    answerSum(false)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    passTime(ROLL_SWIPE_MS + 50)
    expect(screen.getByTestId('run-level').props.children).toBe('レベル 2/6')
  })

  // The route passes the record's live level, not the one at mount.
  it('lays the next card at the level five right answers earn, with its banner', async () => {
    mockParams.current = { kind: 'add:2' }
    renderRound()
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    for (let i = 0; i < 5; i++) {
      answerSum(true)
      passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
    }
    expect(screen.getByTestId('run-level').props.children).toBe('レベル 1/6')
    expect(screen.getByTestId('level-banner', { includeHiddenElements: true })).toBeTruthy()
  })

  it('adds the points earned and keeps the run as the best once it ends', async () => {
    mockParams.current = { kind: 'add:2' }
    confirmQuits()
    renderRound()
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    answerSum(true)
    passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
    fireEvent.press(screen.getByTestId('quit'))
    passTime(ROLL_SWIPE_MS + 50)
    const score = Number(String(screen.getByTestId('results-score').props.children).replace(/,/g, ''))
    expect(score).toBeGreaterThan(0)
    await waitFor(() =>
      expect(mockSave).toHaveBeenLastCalledWith(
        expect.objectContaining({ points: score, bestRuns: { 'add:2': score } }),
      ),
    )
  })

  it('starts a fresh run from the results with もう一回', async () => {
    mockParams.current = { kind: 'add:2' }
    confirmQuits()
    renderRound()
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    answerSum(true)
    passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
    fireEvent.press(screen.getByTestId('quit'))
    passTime(ROLL_SWIPE_MS + 50)
    fireEvent.press(screen.getByTestId('run-again'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    expect(screen.getByTestId('run-score').props.children).toBe('0点')
    expect(within(screen.getByTestId('run-status')).getAllByTestId('life')).toHaveLength(3)
  })

  // Review focus: もう一回 after a run that ended on a miss starts the new
  // run afresh too: its streaks (its first miss keeps the level), and what it
  // reads as it starts (the best is now the run before's).
  it('starts the run after もう一回 afresh, after a run that ended on a miss', async () => {
    mockParams.current = { kind: 'add:2' }
    mockLoad.mockResolvedValue({
      ...emptyProgress(),
      tutorialDone: true,
      practices: { 'add:2': { fade: 2, consecutiveCorrect: 0, consecutiveWrong: 0, lastPractisedAt: 0 } },
    })
    confirmQuits()
    renderRound()
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    // The first run: one right, then a miss, then ✕ to its results.
    answerSum(true)
    passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
    answerSum(false)
    fireEvent.press(screen.getByTestId('quit'))
    passTime(ROLL_SWIPE_MS + 50)
    const first = String(screen.getByTestId('results-score').props.children)
    expect(Number(first.replace(/,/g, ''))).toBeGreaterThan(0)

    fireEvent.press(screen.getByTestId('run-again'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    answerSum(false)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    passTime(ROLL_SWIPE_MS + 50)
    expect(screen.getByTestId('run-level').props.children).toBe('レベル 2/6')

    fireEvent.press(screen.getByTestId('quit'))
    passTime(ROLL_SWIPE_MS + 50)
    expect(screen.getByTestId('results-best').props.children).toBe(`ベスト ${first}点`)
  })
})
