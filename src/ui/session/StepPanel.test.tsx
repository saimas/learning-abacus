import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet, Text } from 'react-native'
import { colors } from '@/ui/theme'
import { StepControls, StepLines } from './StepPanel'

function renderControls(overrides: Partial<Parameters<typeof StepControls>[0]> = {}) {
  const handlers = { onBack: jest.fn(), onNext: jest.fn(), onRestart: jest.fn() }
  render(<StepControls index={null} total={5} {...handlers} {...overrides} />)
  return handlers
}

const disabled = (id: string) => screen.getByTestId(id).props.accessibilityState?.disabled === true
const edge = () => StyleSheet.flatten(screen.getByTestId('step-panel').props.style).borderLeftColor

describe('StepLines', () => {
  it('holds the lines in the panel card, with the correction edge by default', () => {
    render(
      <StepLines>
        <Text>lines</Text>
      </StepLines>,
    )
    expect(screen.getByText('lines')).toBeTruthy()
    expect(edge()).toBe(colors.accent)
  })

  it('drops the correction edge where nothing was got wrong', () => {
    render(
      <StepLines accent={false}>
        <Text>lines</Text>
      </StepLines>,
    )
    expect(edge()).not.toBe(colors.accent)
  })
})

describe('StepControls', () => {
  it('shows a blank counter before the first step', () => {
    renderControls()
    expect(screen.getByTestId('step-count').props.children).toBe(' ')
    expect(disabled('step-back')).toBe(true)
    expect(disabled('step-next')).toBe(false)
  })

  it('counts the start as 0 and keeps ◀ off there', () => {
    renderControls({ index: 0 })
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(disabled('step-back')).toBe(true)
    expect(disabled('step-next')).toBe(false)
  })

  it('counts the move on show and stops ▶ at the last', () => {
    renderControls({ index: 5 })
    expect(screen.getByTestId('step-count').props.children).toBe('5 / 5')
    expect(disabled('step-next')).toBe(true)
    expect(disabled('step-back')).toBe(false)
  })

  it('calls its handlers', () => {
    const h = renderControls({ index: 2 })
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-back'))
    fireEvent.press(screen.getByTestId('step-restart'))
    expect(h.onNext).toHaveBeenCalledTimes(1)
    expect(h.onBack).toHaveBeenCalledTimes(1)
    expect(h.onRestart).toHaveBeenCalledTimes(1)
  })

  it('offers とじる only when it can be closed', () => {
    renderControls()
    expect(screen.queryByTestId('steps-close')).toBeNull()
    const onClose = jest.fn()
    renderControls({ onClose })
    const [close] = screen.getAllByTestId('steps-close')
    if (close === undefined) throw new Error('no とじる button')
    fireEvent.press(close)
    expect(onClose).toHaveBeenCalled()
  })

  it('tells VoiceOver each step it moves to, and nothing when it first appears', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const handlers = { onBack: jest.fn(), onNext: jest.fn(), onRestart: jest.fn() }
    const { rerender } = render(<StepControls index={null} total={5} {...handlers} />)
    expect(announce).not.toHaveBeenCalled()
    rerender(<StepControls index={0} total={5} {...handlers} />)
    expect(announce).toHaveBeenLastCalledWith('0 / 5')
    rerender(<StepControls index={1} total={5} {...handlers} />)
    expect(announce).toHaveBeenLastCalledWith('1 / 5')
    expect(announce).toHaveBeenCalledTimes(2)
    announce.mockRestore()
  })
})
