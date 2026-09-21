import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { SessionTrack } from './SessionTrack'

// The bar's fill runs on a real Animated.timing over the segments' full
// seconds (up to two minutes). Real timers would let its zero-delay
// requestAnimationFrame tick race Jest's own scheduling between tests,
// firing a state update outside `act(...)` and printing a flaky warning that
// has nothing to do with what these tests assert. Fake timers keep that tick
// from ever firing unless a test explicitly advances the clock.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('SessionTrack', () => {
  it('draws one segment per practice block, sized by its seconds', () => {
    const { getAllByTestId, getByTestId } = render(
      <SessionTrack segments={[45, 120, 90]} label="集中" quitLabel="練習をやめる" />,
    )
    expect(getAllByTestId(/^track-segment-/)).toHaveLength(3)
    expect(StyleSheet.flatten(getByTestId('track-segment-1').props.style).flex).toBe(120)
  })

  it('names the block the learner is in', () => {
    const { getByTestId } = render(
      <SessionTrack segments={[45, 120, 90]} label="集中" quitLabel="練習をやめる" />,
    )
    expect(getByTestId('block-label').props.children).toBe('集中')
  })

  it('offers a labelled way out when given one', () => {
    const onQuit = jest.fn()
    const { getByTestId } = render(
      <SessionTrack segments={[45]} label="集中" quitLabel="練習をやめる" onQuit={onQuit} />,
    )
    expect(getByTestId('quit').props.accessibilityLabel).toBe('練習をやめる')
    fireEvent.press(getByTestId('quit'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('shows no way out without a handler', () => {
    const { queryByTestId } = render(
      <SessionTrack segments={[45]} label="集中" quitLabel="練習をやめる" />,
    )
    expect(queryByTestId('quit')).toBeNull()
  })
})
