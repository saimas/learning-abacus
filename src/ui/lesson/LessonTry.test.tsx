import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { lessonById, tryProblem, type Lesson } from '@/domain/lessons'
import { answerOf } from '@/domain/problem'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import { ProgressProvider, useProgress } from '@/ui/ProgressProvider'
import { setBeads } from '@/ui/session/testing'
import { LessonTry } from './LessonTry'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
  mockSave.mockResolvedValue()
})

afterEach(() => {
  jest.useRealTimers()
})

function lesson(id: string): Lesson {
  const found = lessonById(id)
  if (found === null) throw new Error(`no lesson ${id}`)
  return found
}

// A random that always picks the first choice, so the problem is known.
const first = () => 0

async function renderTry(id: string, onLeave = jest.fn()) {
  render(
    <ProgressProvider>
      <LessonTry lesson={lesson(id)} onLeave={onLeave} random={first} />
    </ProgressProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
  return onLeave
}

describe('LessonTry', () => {
  it('asks a problem like the lesson’s, on the solid beads', async () => {
    await renderTry('add:five')
    expect(screen.getByText('やってみよう')).toBeTruthy()
    const problem = tryProblem(lesson('add:five'), first)
    expect(screen.getByTestId('prompt').props.children).toBe(`${problem.a}に${problem.b}をたす。`)
    expect(screen.getByTestId('soroban-wrap')).toBeTruthy()
  })

  it('stamps a right answer, then draws another problem', async () => {
    await renderTry('add:five')
    const problem = tryProblem(lesson('add:five'), first)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    const next = tryProblem(lesson('add:five'), first, problem)
    expect(screen.getByTestId('prompt').props.children).toBe(`${next.a}に${next.b}をたす。`)
    expect(screen.queryByTestId('maru')).toBeNull()
  })

  it('leaves through おわる', async () => {
    const onLeave = await renderTry('mul:1')
    const problem = tryProblem(lesson('mul:1'), first)
    // The board beneath has rods of its own; the answer goes on the soroban.
    setBeads(within(screen.getByTestId('soroban-wrap')).getByTestId, answerOf(problem) + 1, 2)
    fireEvent.press(screen.getByTestId('submit'))
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  // Spec §2, §6: nothing here reaches progress — no attempt, no fade
  // move, no day practised — right or wrong.
  it('records nothing', async () => {
    let seen: ReturnType<typeof useProgress>['progress'] | null = null
    function Probe() {
      seen = useProgress().progress
      return null
    }
    render(
      <ProgressProvider>
        <Probe />
        <LessonTry lesson={lesson('add:five')} onLeave={jest.fn()} random={first} />
      </ProgressProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('prompt')).toBeTruthy())
    const problem = tryProblem(lesson('add:five'), first)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    setBeads(screen.getByTestId, 9, 2)
    fireEvent.press(screen.getByTestId('submit'))
    await act(async () => {})
    expect(seen).toMatchObject({ practices: {}, daysPracticed: 0, lastSessionDay: null })
    expect(mockSave).not.toHaveBeenCalled()
  })

  // Review focus: a borrow starts from 1 on the tens rod.
  it('takes a borrowing move from 1 on the tens rod', async () => {
    await renderTry('sub:ten')
    const problem = tryProblem(lesson('sub:ten'), first)
    expect(problem.a).toBeGreaterThanOrEqual(10)
    expect(screen.getByTestId('prompt').props.children).toBe(`${problem.a}から${problem.b}をひく。`)
    setBeads(screen.getByTestId, answerOf(problem), 2)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
  })
})
