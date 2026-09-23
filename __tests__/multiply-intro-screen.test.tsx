import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import MultiplyIntroScreen from '../app/multiply-intro'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// The route's search parameters and where it sent the learner, set and read
// per test.
const mockParams: { current: Record<string, string> } = { current: {} }
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams.current,
}))

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  // The bead steps play on timers; fake ones keep their callbacks inside the
  // test.
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockParams.current = {}
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, daysPracticed: 4 })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
})

// Renders the screen once progress has loaded, then pages through to the
// last page: the method, the placement and the four 九九.
async function renderToLastPage() {
  render(
    <ProgressProvider>
      <MultiplyIntroScreen />
    </ProgressProvider>,
  )
  await act(async () => {})
  for (let i = 0; i < 6; i++) fireEvent.press(screen.getByTestId('intro-next'))
}

describe('Multiply intro screen', () => {
  it('shows a loading state before progress has hydrated, so finishing cannot save over it', () => {
    mockParams.current = { kind: 'mul:2' }
    // A load that never resolves keeps the provider pre-hydration for the
    // whole test, so its later resolution cannot fire an update outside act().
    mockLoad.mockReturnValueOnce(new Promise(() => {}))
    render(
      <ProgressProvider>
        <MultiplyIntroScreen />
      </ProgressProvider>,
    )
    expect(screen.getByTestId('hydrating')).toBeTruthy()
    expect(screen.queryByTestId('intro-next')).toBeNull()
  })

  it('starts the round it was shown before, once the walkthrough is marked seen', async () => {
    mockParams.current = { kind: 'mul:2' }
    await renderToLastPage()
    expect(screen.getByText('はじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'mul:2' } }))
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ multiplyIntroDone: true, daysPracticed: 4 })
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('goes back when opened from the chooser, once the walkthrough is marked seen', async () => {
    await renderToLastPage()
    expect(screen.getByText('おわる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ multiplyIntroDone: true })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not start a round of a kind that is not multiplication', async () => {
    mockParams.current = { kind: 'add:2' }
    await renderToLastPage()
    expect(screen.getByText('おわる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
