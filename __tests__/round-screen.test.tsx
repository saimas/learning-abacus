import { waitFor, render } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Round from '../app/round'
import { ProgressProvider } from '@/ui/ProgressProvider'

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
})

function renderRound() {
  return render(
    <ProgressProvider>
      <Round />
    </ProgressProvider>,
  )
}

describe('Round screen', () => {
  it('plays a round of the kind it is given, once hydrated', async () => {
    mockParams.current = { kind: 'sub:2' }
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{2}から\d{2}をひく。$/)
    expect(getByTestId('round-count').props.children).toBe('1 / 10')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('goes home for a kind it does not know', async () => {
    mockParams.current = { kind: 'mul:2' }
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
    expect(getByTestId('key-1')).toBeTruthy()
    expect(queryByTestId('soroban-wrap')).toBeNull()
  })

  it('starts a kind with no record in bead mode', async () => {
    mockParams.current = { kind: 'add:2' }
    const { getByTestId, queryByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('soroban-wrap')).toBeTruthy()
    expect(queryByTestId('key-1')).toBeNull()
  })
})
