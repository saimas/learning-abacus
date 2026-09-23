import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Problem } from '@/domain/problem'
import { setBeads } from '@/ui/session/testing'
import { RoundRunner } from './RoundRunner'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problems: Problem[] = [
  { op: 'add', digits: 2, a: 23, b: 58 },
  { op: 'add', digits: 2, a: 46, b: 54 },
  { op: 'add', digits: 2, a: 10, b: 11 },
]

function renderRound(overrides: Partial<Parameters<typeof RoundRunner>[0]> = {}) {
  const onAttempt = jest.fn()
  const onFinish = jest.fn()
  let clock = 0
  render(
    <RoundRunner
      kind={{ op: 'add', digits: 2 }}
      problems={problems}
      fade={0}
      calibrationMs={900}
      onAttempt={onAttempt}
      onFinish={onFinish}
      now={() => (clock += 1_000)}
      {...overrides}
    />,
  )
  return { onAttempt, onFinish }
}

function answerBeads(value: number) {
  setBeads(screen.getByTestId, value, 3)
  fireEvent.press(screen.getByTestId('submit'))
}

describe('RoundRunner', () => {
  it('plays the problems in order, counting them', () => {
    renderRound()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    answerBeads(81)
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
  })

  it('records each answer against the kind, untimed on the beads', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'add:2', correct: true, pace: null })
  })

  it('records a keypad answer’s pace against the problem’s target', () => {
    const { onAttempt } = renderRound({ fade: 3 })
    for (const digit of '81') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    const pace = onAttempt.mock.calls[0][0].pace
    expect(pace).toBeGreaterThan(0)
    expect(pace).toBeLessThan(1)
  })

  it('reviews a miss, then moves on without repeating it', () => {
    renderRound()
    answerBeads(80)
    expect(screen.getByTestId('correction')).toBeTruthy()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  it('ends with the summary after the last problem', () => {
    const { onFinish } = renderRound()
    answerBeads(81)
    answerBeads(100)
    answerBeads(21)
    expect(screen.getByTestId('summary-text').props.children).toBe('けたの練習おわり')
    expect(screen.getByTestId('summary-result').props.children).toBe('3問中 3問正解')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
