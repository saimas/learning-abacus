import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { Problem } from '@/domain/problem'
import { setBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
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

  // Spec (core rounds) §3: each ▶ plays one bead move, and the line of the
  // column that move belongs to lights up (groupOfStep).
  it('steps through a missed problem, lighting the column each move belongs to', () => {
    renderRound()
    answerBeads(80)
    const count = () => screen.getByTestId('step-count').props.children
    // Tens first, then ones, as the card lists them.
    const lit = () =>
      [1, 0].filter(
        (place) =>
          StyleSheet.flatten(screen.getByTestId(`correction-column-${place}`).props.style)?.color === colors.accent,
      )
    expect(lit()).toEqual([])

    // 23 + 58: +5 on the tens rod, then the ones' 8 as +10 − 2.
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('0 / 3')
    expect(lit()).toEqual([])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('1 / 3')
    expect(lit()).toEqual([1])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('2 / 3')
    expect(lit()).toEqual([0])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('3 / 3')
    expect(lit()).toEqual([0])

    fireEvent.press(screen.getByTestId('step-back'))
    fireEvent.press(screen.getByTestId('step-back'))
    expect(count()).toBe('1 / 3')
    expect(lit()).toEqual([1])
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
