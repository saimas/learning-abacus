import { fireEvent, render, screen } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { RunResults } from './RunResults'

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

function renderResults(overrides: Partial<Parameters<typeof RunResults>[0]> = {}) {
  const onAgain = jest.fn()
  const onDone = jest.fn()
  render(
    <RunResults
      score={1_240}
      best={undefined}
      right={14}
      longestCombo={8}
      highestLevel={4}
      pointsBefore={100}
      onAgain={onAgain}
      onDone={onDone}
      {...overrides}
    />,
  )
  return { onAgain, onDone }
}

describe('RunResults', () => {
  it('shows the score and three facts', () => {
    renderResults()
    expect(screen.getByTestId('results-score').props.children).toBe('1,240')
    expect(screen.getByTestId('results-right').props.children).toBe('正解 14')
    expect(screen.getByTestId('results-combo').props.children).toBe('最大れんぞく 8')
    expect(screen.getByTestId('results-level').props.children).toBe('最高レベル 4')
  })

  it.each([[undefined], [1_000]])('calls a run past the best (%p) a new best', (best) => {
    renderResults({ best })
    expect(screen.getByTestId('results-best').props.children).toBe('自己ベスト！')
  })

  it('names the best a run did not reach', () => {
    renderResults({ best: 3_420 })
    expect(screen.getByTestId('results-best').props.children).toBe('ベスト 3,420点')
  })

  it('names no best for a first run that scored nothing', () => {
    renderResults({ score: 0 })
    expect(screen.queryByTestId('results-best')).toBeNull()
  })

  // 900 + 200 crosses 1,000: 練習9級.
  it('stamps a rank crossed, with a pulse', () => {
    renderResults({ pointsBefore: 900, score: 200 })
    expect(screen.getByTestId('results-rank-name').props.children).toBe('練習9級に上がりました！')
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
  })

  it('names the rank, unstamped, when none is crossed', () => {
    renderResults({ pointsBefore: 100, score: 200 })
    expect(screen.getByTestId('results-rank-name').props.children).toBe('練習10級')
    expect(Haptics.notificationAsync).not.toHaveBeenCalled()
  })

  it('starts again or leaves', () => {
    const { onAgain, onDone } = renderResults()
    fireEvent.press(screen.getByTestId('run-again'))
    fireEvent.press(screen.getByTestId('run-done'))
    expect(onAgain).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
