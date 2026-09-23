import { act, render, waitFor } from '@testing-library/react-native'
import { AppState, Text, type AppStateStatus } from 'react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import { ProgressProvider, useProgress } from './ProgressProvider'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

function Probe() {
  const { progress, hydrated } = useProgress()
  return <Text testID="probe">{hydrated ? String(progress.daysPracticed) : 'loading'}</Text>
}

// Captures the handler the provider registers, so a test can play a
// backgrounding without a simulator.
let appStateHandler: ((status: AppStateStatus) => void) | null = null
const remove = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 3 })
  mockSave.mockResolvedValue()
  appStateHandler = null
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (status: AppStateStatus) => void,
  ) => {
    appStateHandler = handler
    return { remove }
  }) as unknown as typeof AppState.addEventListener)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ProgressProvider', () => {
  it('gates on hydration then exposes stored progress', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <Probe />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('probe').props.children).toBe('3'))
  })

  it('does not write on every attempt', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    act(() => api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500 }))
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('practise records a multi-digit attempt and marks the day practised', async () => {
    mockLoad.mockResolvedValue(emptyProgress())
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    act(() => api?.practise({ id: 'sub:3', correct: true, pace: null }))
    await waitFor(() => {
      expect(api?.progress?.practices['sub:3']).toBeDefined()
      expect(api?.progress?.daysPracticed).toBe(1)
    })
  })

  it('writes when flushed', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      await api?.flush()
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('completeTutorial sets tutorialDone and persists immediately', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      await api?.completeTutorial()
    })
    await waitFor(() => expect(api?.progress?.tutorialDone).toBe(true))
    expect(mockSave).toHaveBeenCalledTimes(1)
    const call = mockSave.mock.calls[0]
    expect(call?.[0]?.tutorialDone).toBe(true)
  })

  it('flushes when the app is backgrounded mid-block', async () => {
    // Backgrounding is the normal way a commute habit ends, and block
    // boundaries are the only other flush — without this the block is lost.
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    act(() => api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500 }))
    expect(mockSave).not.toHaveBeenCalled()

    await act(async () => {
      appStateHandler?.('background')
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.calls[0]?.[0]?.atoms['1+3']).toBeDefined()
  })

  it('flushes when the app merely goes inactive', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      appStateHandler?.('inactive')
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('does not write while the app is merely active', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      appStateHandler?.('active')
    })
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('flushes on unmount and detaches its listener', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    const { unmount } = render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    act(() => api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500 }))

    await act(async () => {
      unmount()
    })
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalled()
  })

  it('never writes the empty default over stored progress before hydration', async () => {
    // loadProgress that never settles: the provider is unmounted while
    // latest.current is still emptyProgress(). Saving that would wipe a
    // learner's history on a fast open-and-close.
    mockLoad.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(
      <ProgressProvider>
        <Probe />
      </ProgressProvider>,
    )
    await act(async () => {
      appStateHandler?.('background')
      unmount()
    })
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('flush picks up an attempt made in the same tick', async () => {
    let api: ReturnType<typeof useProgress> | null = null
    function Capture() {
      // eslint-disable-next-line react-hooks/globals -- test-only probe: captures the hook's return value for assertions outside the render tree.
      api = useProgress()
      return null
    }
    render(
      <ProgressProvider>
        <Capture />
      </ProgressProvider>,
    )
    await waitFor(() => expect(api?.hydrated).toBe(true))
    await act(async () => {
      api?.attempt({ atomId: '1+3', correct: true, latencyMs: 500 })
      await api?.flush()
    })
    const call = mockSave.mock.calls[0]
    const saved = call?.[0]
    expect(saved?.atoms['1+3']).toBeDefined()
  })
})
