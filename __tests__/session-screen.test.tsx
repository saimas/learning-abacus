import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Alert, type AlertButton } from 'react-native'
import { emptyProgress } from '@/domain/progress'
import type { SessionPlan } from '@/domain/session'
import * as store from '@/storage/progressStore'
import Session from '../app/session'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockBack = jest.fn()
const mockReplace = jest.fn()
// The route's search parameters, set per test.
const mockParams: { current: Record<string, string> } = { current: {} }
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams.current,
}))

// Lets one test hand the screen a close-only plan, so the finish path can be
// reached without playing 255 seconds of practice.
const mockPlan: { current: SessionPlan | null } = { current: null }
jest.mock('@/domain/session', () => {
  const actual = jest.requireActual<typeof import('@/domain/session')>('@/domain/session')
  return {
    ...actual,
    selectSession: (...args: Parameters<typeof actual.selectSession>) =>
      mockPlan.current ?? actual.selectSession(...args),
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  // SessionTrack, Maru and Seal (animateIn on the close screen) animate with
  // Animated.timing on real timers, which fire after the test has already
  // asserted and unmounted, producing a flaky act(...) warning. Fake timers
  // keep those callbacks inside the test's own synchronous window; RNTL 13's
  // waitFor still resolves against them because it polls via microtasks.
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockPlan.current = null
  mockParams.current = {}
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

function renderSession() {
  return render(
    <ProgressProvider>
      <Session />
    </ProgressProvider>,
  )
}

function alertButtons(spy: jest.SpyInstance): AlertButton[] {
  return (spy.mock.calls[0]?.[2] as AlertButton[] | undefined) ?? []
}

describe('Session screen', () => {
  it('runs a session once hydrated', async () => {
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    // A first-day question is at F0, so it is answered on the beads.
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    fireEvent.press(getByTestId('submit'))
    expect(getByTestId('prompt')).toBeTruthy()
  })

  it('asks before quitting, and つづける keeps the session going', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('quit')).toBeTruthy())
    fireEvent.press(getByTestId('quit'))

    expect(alert).toHaveBeenCalledWith('練習をやめますか？', 'ここまでの答えは記録されています。', expect.any(Array))
    const keepGoing = alertButtons(alert).find((button) => button.style === 'cancel')
    expect(keepGoing?.text).toBe('つづける')
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('saves and goes home when the learner stops', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('quit')).toBeTruthy())
    fireEvent.press(getByTestId('quit'))

    const stop = alertButtons(alert).find((button) => button.style === 'destructive')
    expect(stop?.text).toBe('やめる')
    await act(async () => {
      stop?.onPress?.()
    })
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalled()
  })

  it('saves and goes home after the close screen', async () => {
    mockPlan.current = { blocks: [{ kind: 'close', seconds: 30, items: [] }], totalSeconds: 30 }
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('finish-button')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('finish-button'))
    })
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalled()
  })
})

// Spec (choosing what to practise) §5: ?part= practises one part.
describe('Session screen practising one part', () => {
  it('plays only the part it is given, for the whole practice time', async () => {
    mockParams.current = { part: 'focus' }
    const { getByTestId, getAllByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getByTestId('block-label').props.children).toBe('集中')
    expect(getAllByTestId(/^track-segment-/)).toHaveLength(1)
  })

  it('goes straight to the summary when the chosen part has nothing in it', async () => {
    // A new learner has nothing due, so 準備 is empty.
    mockParams.current = { part: 'warmup' }
    const { getByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('session-summary')).toBeTruthy())
    expect(getByTestId('summary-result').props.children).toContain('0問中')
  })

  it('plays the full session for a part it does not know', async () => {
    mockParams.current = { part: 'close' }
    const { getByTestId, getAllByTestId } = renderSession()
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    expect(getAllByTestId(/^track-segment-/)).toHaveLength(3)
  })
})
