import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { LevelBanner } from './RunMoments'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const hidden = { includeHiddenElements: true }
const transformOf = (testID: string) =>
  JSON.stringify(StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style).transform ?? [])

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
