import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import LessonRoute from '../app/lesson/[id]'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockParams: { current: Record<string, string> } = { current: {} }
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockCanGoBack = { current: true }
const mockRedirect = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    back: () => mockBack(),
    replace: (href: unknown) => mockReplace(href),
    canGoBack: () => mockCanGoBack.current,
  },
  useLocalSearchParams: () => mockParams.current,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
}))

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
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

async function renderLesson(params: Record<string, string>) {
  mockParams.current = params
  render(
    <ProgressProvider>
      <LessonRoute />
    </ProgressProvider>,
  )
  await act(async () => {})
}

// ▶ until the walkthrough's last button (at most 80 presses).
function pageToEnd() {
  for (let i = 0; i < 80 && screen.queryByTestId('intro-finish') === null; i++) {
    fireEvent.press(screen.queryByTestId('intro-next') ?? screen.getByTestId('walk-next'))
  }
}

describe('Lesson screen', () => {
  // Review focus: finishing before the load would save over the learner's
  // progress.
  it('shows a loading state before progress has hydrated', () => {
    mockParams.current = { id: 'add:five' }
    mockLoad.mockReturnValueOnce(new Promise(() => {}))
    render(
      <ProgressProvider>
        <LessonRoute />
      </ProgressProvider>,
    )
    expect(screen.getByTestId('hydrating')).toBeTruthy()
    expect(screen.queryByTestId('intro-next')).toBeNull()
  })

  // Review focus: a deep link to a lesson that does not exist.
  it('goes Home for a lesson it does not know', async () => {
    await renderLesson({ id: 'add:9' })
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  // Spec (howto tutorial) §3–4.
  it('walks the lesson to やってみよう, counting it done there', async () => {
    await renderLesson({ id: 'add:five' })
    pageToEnd()
    expect(screen.getByText('やってみよう')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    expect(mockSave.mock.calls[mockSave.mock.calls.length - 1]?.[0]).toMatchObject({
      lessonsSeen: ['add:five'],
      daysPracticed: 4,
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('leaves through ✕ at any point, counting the lesson done', async () => {
    await renderLesson({ id: 'sub:2' })
    expect(screen.getByTestId('intro-exit').props.accessibilityLabel).toBe('説明をやめる')
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ lessonsSeen: ['sub:2'] })
  })

  it('leaves やってみよう through ✕ too', async () => {
    await renderLesson({ id: 'add:five' })
    pageToEnd()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  })

  it('goes Home through ✕ when there is nothing to go back to', async () => {
    mockCanGoBack.current = false
    await renderLesson({ id: 'mul:1' })
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  })

  it('starts the round it was opened before, without やってみよう', async () => {
    await renderLesson({ id: 'mul:2', kind: 'mul:2' })
    pageToEnd()
    expect(screen.getByText('練習をはじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'mul:2' } }))
    expect(mockSave).toHaveBeenCalledTimes(1)
    expect(mockSave.mock.calls[0]?.[0]).toMatchObject({ lessonsSeen: ['mul:2'] })
    expect(screen.queryByText('やってみよう')).toBeNull()
  })

  it('ignores a round of another kind', async () => {
    await renderLesson({ id: 'mul:2', kind: 'mul:3' })
    pageToEnd()
    expect(screen.getByText('やってみよう')).toBeTruthy()
  })

  // Review focus: double taps.
  it('starts the round once when 練習をはじめる is tapped twice', async () => {
    await renderLesson({ id: 'div:1', kind: 'div:1' })
    pageToEnd()
    fireEvent.press(screen.getByTestId('intro-finish'))
    fireEvent.press(screen.getByTestId('intro-finish'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledTimes(1)
  })

  it('leaves once when ✕ is tapped twice', async () => {
    await renderLesson({ id: 'add:ten' })
    fireEvent.press(screen.getByTestId('intro-exit'))
    fireEvent.press(screen.getByTestId('intro-exit'))
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
    expect(mockSave).toHaveBeenCalledTimes(1)
  })
})
