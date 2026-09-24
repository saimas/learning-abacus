import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import DivideIntroScreen from '../app/divide-intro'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// The route's search parameters, whether there is a screen to go back to,
// and where it sent the learner, set and read per test.
const mockParams: { current: Record<string, string> } = { current: {} }
const mockCanGoBack = { current: true }
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
    canGoBack: () => mockCanGoBack.current,
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
  mockCanGoBack.current = true
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, daysPracticed: 4 })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
})

// Renders the screen once progress has loaded.
async function renderScreen() {
  render(
    <ProgressProvider>
      <DivideIntroScreen />
    </ProgressProvider>,
  )
  await act(async () => {})
}

// Pages through to the last page: the method, the guess, the placement, and
// the six groups of 1692 ÷ 36 (a digit placed and two 九九 taken off, twice).
async function renderToLastPage() {
  await renderScreen()
  for (let i = 0; i < 9; i++) fireEvent.press(screen.getByTestId('intro-next'))
}

// Spec (division) §3: shown before the first ÷ round, with that round's
// kind, and from Home's わり算のやりかた link, without one.
describe('Divide intro screen', () => {
  it('shows a loading state before progress has hydrated, so finishing cannot save over it', () => {
    mockParams.current = { kind: 'div:2' }
    // A load that never resolves keeps the provider pre-hydration for the
    // whole test, so its later resolution cannot fire an update outside act().
    mockLoad.mockReturnValueOnce(new Promise(() => {}))
    render(
      <ProgressProvider>
        <DivideIntroScreen />
      </ProgressProvider>,
    )
    expect(screen.getByTestId('hydrating')).toBeTruthy()
    expect(screen.queryByTestId('intro-next')).toBeNull()
  })

  it('walks through 1692 ÷ 36 by 商除法', async () => {
    await renderScreen()
    expect(screen.getByText('わり算のやりかた')).toBeTruthy()
    expect(screen.getByText('1692 ÷ 36')).toBeTruthy()
    expect(screen.getByTestId('intro-text').props.children).toContain('商除法')
    // The owner (2026-09-24): how each digit is guessed by 九九, before
    // where it is placed.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toContain('商の見当は九九でつけます')
    for (let i = 0; i < 8; i++) fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('1692÷36 = 47')
  })

  it('starts the round it was shown before, once the walkthrough is marked seen', async () => {
    mockParams.current = { kind: 'div:2' }
    await renderToLastPage()
    expect(screen.getByText('はじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'div:2' } }))
    expect(mockSave).toHaveBeenCalledTimes(1)
    // Seeing how to divide says nothing about multiplication.
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({
      divideIntroDone: true,
      multiplyIntroDone: false,
      daysPracticed: 4,
    })
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('goes back when opened from Home, once the walkthrough is marked seen', async () => {
    await renderToLastPage()
    expect(screen.getByText('おわる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ divideIntroDone: true })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // A cold deep link has nothing underneath to go back to.
  it('goes Home when there is nothing to go back to', async () => {
    mockCanGoBack.current = false
    await renderToLastPage()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('does not start a round of a kind that is not division', async () => {
    mockParams.current = { kind: 'mul:2' }
    await renderToLastPage()
    expect(screen.getByText('おわる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
