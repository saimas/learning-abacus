import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { RANK_FILL_MS, RankBar } from './RankBar'
import { RankBadge } from './RankBadge'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

const filled = () => parseFloat(String(StyleSheet.flatten(screen.getByTestId('rank-bar-fill').props.style).width))

describe('RankBadge', () => {
  // 1,700 points: rank 1 (練習9級, from 1,000), halfway to 2,400.
  it('names the rank, stamps its seal and measures the way to the next', () => {
    render(<RankBadge points={1_700} />)
    expect(screen.getByTestId('rank-name').props.children).toBe('練習9級')
    expect(screen.getByText('練習\n9級')).toBeTruthy()
    expect(screen.getByTestId('rank-next').props.children).toBe('次まで あと700点')
    expect(filled()).toBeCloseTo(50)
    expect(screen.getByTestId('rank-badge').props.accessibilityLabel).toBe('練習9級、次まで あと700点')
  })

  it('stays full at the top rank', () => {
    render(<RankBadge points={2_000_000} />)
    expect(screen.getByTestId('rank-name').props.children).toBe('練習十段')
    expect(screen.getByTestId('rank-next').props.children).toBe('最高位です')
    expect(filled()).toBeCloseTo(100)
  })
})

describe('RankBar', () => {
  it('fills from where it was to where it is, given from', () => {
    render(<RankBar from={0.2} to={0.8} />)
    expect(filled()).toBeCloseTo(20)
    passTime(RANK_FILL_MS + 100)
    expect(filled()).toBeCloseTo(80)
  })
})
