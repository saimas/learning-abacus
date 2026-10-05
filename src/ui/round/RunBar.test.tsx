import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Icon } from '@/ui/kit/Icon'
import { RunBar } from './RunBar'

function renderBar(overrides: Partial<Parameters<typeof RunBar>[0]> = {}) {
  const onQuit = jest.fn()
  render(<RunBar lives={3} level={0} score={0} combo={0} reduceMotion={false} onQuit={onQuit} {...overrides} />)
  return { onQuit }
}

// The placeholder is hidden from VoiceOver, which the queries skip unless
// asked.
const hidden = { includeHiddenElements: true }

describe('RunBar', () => {
  it('shows the lives left, the level and the score', () => {
    renderBar({ lives: 2, level: 3, score: 1_240 })
    expect(screen.getAllByTestId('life')).toHaveLength(2)
    expect(screen.getAllByTestId('life-lost')).toHaveLength(1)
    expect(screen.getByTestId('run-level').props.children).toBe('レベル 3/6')
    expect(screen.getByTestId('run-score').props.children).toBe('1,240点')
    expect(screen.getByTestId('run-status').props.accessibilityLabel).toBe('ライフ 2、レベル 3/6、1,240点')
  })

  it('shows the combo from two in a row, with its factor', () => {
    renderBar({ combo: 1 })
    expect(screen.queryByTestId('run-combo')).toBeNull()
    screen.rerender(<RunBar lives={3} level={0} score={0} combo={12} reduceMotion={false} />)
    expect(screen.getByTestId('run-combo').props.children).toBe('12れんぞく ×2')
  })

  it('leaves through ✕', () => {
    const { onQuit } = renderBar()
    fireEvent.press(screen.getByTestId('quit'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('has no ✕ without somewhere to go', () => {
    render(<RunBar lives={3} level={0} score={0} combo={0} reduceMotion={false} />)
    expect(screen.queryByTestId('quit')).toBeNull()
  })

  // Spec (runs) §5 (the owner, 2026-10-06): 戻る, right after ✕, goes back
  // to the problem before.
  it('goes back through 戻る, right after ✕', () => {
    const onBack = jest.fn()
    renderBar({ onBack })
    const back = screen.getByTestId('go-back')
    expect(back.props.accessibilityRole).toBe('button')
    expect(back.props.accessibilityLabel).toBe('前の問題にもどる')
    expect(back).toHaveTextContent('戻る')
    expect(within(back).UNSAFE_getByType(Icon).props.name).toBe('back')
    fireEvent.press(back)
    expect(onBack).toHaveBeenCalledTimes(1)
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('go-back')).toBe(drawn.indexOf('quit') + 1)
  })

  // The controller's ruling (2026-10-06): ✕'s and 戻る's tap areas are each
  // 44 pt tall, but they do not meet across the gap between them, so a tap
  // just right of ✕ never lands on 戻る, which acts at once.
  it('keeps ✕’s and 戻る’s tap areas apart, each 44 pt tall', () => {
    renderBar({ onBack: jest.fn() })
    const quit = screen.getByTestId('quit')
    const back = screen.getByTestId('go-back')
    expect(quit.props.hitSlop).toEqual({ top: 13, bottom: 13, left: 12, right: 4 })
    expect(back.props.hitSlop).toEqual({ top: 13, bottom: 13, left: 4, right: 12 })
    // The innermost view holding both is the bar's row, whose gap parts them.
    const holding = (node: ReturnType<typeof screen.getByTestId>, testID: string) =>
      node.findAll((inner) => inner.props.testID === testID).length > 0
    const rows = screen.root.findAll(
      (node) => typeof node.type === 'string' && holding(node, 'quit') && holding(node, 'go-back'),
    )
    const gap: unknown = StyleSheet.flatten(rows[rows.length - 1]?.props.style).gap
    expect(gap).toBe(12)
    expect(quit.props.hitSlop.right + back.props.hitSlop.left).toBeLessThanOrEqual(gap as number)
    for (const button of [quit, back]) {
      const tall = within(button).UNSAFE_getByType(Icon).props.size + button.props.hitSlop.top + button.props.hitSlop.bottom
      expect(tall).toBeGreaterThanOrEqual(44)
    }
  })

  // Its place is kept, so the lives beside it do not shift as it comes and
  // goes: the same icon and word, unseen and unheard.
  it('keeps 戻る’s place without it', () => {
    renderBar()
    expect(screen.queryByTestId('go-back')).toBeNull()
    expect(screen.queryByText('戻る')).toBeNull()
    const place = screen.getByTestId('go-back-place', hidden)
    expect(place).toHaveTextContent('戻る')
    expect(within(place).UNSAFE_getByType(Icon).props.name).toBe('back')
    expect(StyleSheet.flatten(place.props.style).opacity).toBe(0)
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('go-back-place')).toBe(drawn.indexOf('quit') + 1)
  })
})
