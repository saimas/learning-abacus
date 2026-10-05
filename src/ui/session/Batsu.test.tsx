import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { Batsu } from './Batsu'

// Batsu runs a real Animated.timing on mount; fake timers keep its frames
// from firing between tests.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('Batsu', () => {
  it('is as big as the 〇 by default', () => {
    render(<Batsu />)
    const flat = StyleSheet.flatten(screen.getByTestId('batsu').props.style)
    expect(flat.width).toBe(140)
    expect(flat.height).toBe(140)
  })

  it('crosses two vermilion strokes about 7% of its size', () => {
    render(<Batsu size={110} />)
    const strokes = screen.getAllByTestId('batsu-stroke').map((stroke) => StyleSheet.flatten(stroke.props.style))
    expect(strokes).toHaveLength(2)
    for (const stroke of strokes) {
      expect(stroke.width).toBe(8)
      expect(stroke.height).toBe(110)
      expect(stroke.backgroundColor).toBe(colors.accent)
    }
  })

  it('never takes a tap', () => {
    render(<Batsu />)
    expect(screen.getByTestId('batsu').props.pointerEvents).toBe('none')
  })

  it('is gone within a second, like the 〇', () => {
    render(<Batsu />)
    act(() => jest.advanceTimersByTime(1_000))
    expect(StyleSheet.flatten(screen.getByTestId('batsu').props.style).opacity).toBe(0)
  })
})
