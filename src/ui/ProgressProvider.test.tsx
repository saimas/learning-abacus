import { act, render, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
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

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 3 })
  mockSave.mockResolvedValue()
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
