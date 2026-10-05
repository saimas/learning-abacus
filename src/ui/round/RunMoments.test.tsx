import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { LevelBanner, PointsFloat } from './RunMoments'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const hidden = { includeHiddenElements: true }
const transformOf = (testID: string) =>
  JSON.stringify(StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style).transform ?? [])

describe('PointsFloat', () => {
  it('floats the points earned up from the 〇', () => {
    render(<PointsFloat points={1_242} reduceMotion={false} />)
    act(() => jest.advanceTimersByTime(100))
    expect(screen.getByTestId('points-float', hidden).props.children).toBe('+1,242')
    expect(transformOf('points-float')).toContain('translateY')
  })

  it('fades where it is with Reduce Motion', () => {
    render(<PointsFloat points={46} reduceMotion />)
    act(() => jest.advanceTimersByTime(100))
    expect(transformOf('points-float')).not.toContain('translateY')
  })
})

describe('LevelBanner', () => {
  it('names the new level', () => {
    render(<LevelBanner level={4} reduceMotion={false} />)
    act(() => jest.advanceTimersByTime(100))
    expect(screen.getByText('レベル 4', hidden)).toBeTruthy()
    expect(transformOf('level-banner')).toContain('scale')
  })

  it('does not swell with Reduce Motion', () => {
    render(<LevelBanner level={2} reduceMotion />)
    act(() => jest.advanceTimersByTime(100))
    expect(transformOf('level-banner')).not.toContain('scale')
  })
})
