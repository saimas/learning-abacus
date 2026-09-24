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
    expect(getByTestId('key-1')).toBeTruthy()
    expect(queryByTestId('soroban-wrap')).toBeNull()
  })

  it('shows how multiplication works before the first × round', async () => {
    mockParams.current = { kind: 'mul:2' }
    const { queryByTestId } = renderRound()
    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/multiply-intro', params: { kind: 'mul:2' } }),
    )
    expect(queryByTestId('prompt')).toBeNull()
  })

  it('plays a × round once the walkthrough has been seen', async () => {
    mockParams.current = { kind: 'mul:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, multiplyIntroDone: true })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{2}に\d{2}をかける。$/)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // Spec (division) §3.
  it('shows how division works before the first ÷ round', async () => {
    mockParams.current = { kind: 'div:2' }
    // Seeing the × walkthrough does not count for ÷.
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, multiplyIntroDone: true })
    const { queryByTestId } = renderRound()
    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/divide-intro', params: { kind: 'div:2' } }),
    )
    expect(queryByTestId('prompt')).toBeNull()
  })

  it('plays a ÷ round once the walkthrough has been seen', async () => {
    mockParams.current = { kind: 'div:2' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, divideIntroDone: true })
    const { getByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('prompt').props.children).toMatch(/^\d{4}を\d{2}でわる。$/)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // The ÷ walkthrough is not the × one: a learner who has seen only the ÷
  // one still sees how to multiply first.
  it('still shows how multiplication works when only the ÷ walkthrough has been seen', async () => {
    mockParams.current = { kind: 'mul:1' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, divideIntroDone: true })
    renderRound()
    await waitFor(() =>
      expect(mockRedirect).toHaveBeenCalledWith({ pathname: '/multiply-intro', params: { kind: 'mul:1' } }),
    )
  })

  it('starts a kind with no record in bead mode', async () => {
    mockParams.current = { kind: 'add:2' }
    const { getByTestId, queryByTestId } = renderRound()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('soroban-wrap')).toBeTruthy()
    expect(queryByTestId('key-1')).toBeNull()
  })
})
