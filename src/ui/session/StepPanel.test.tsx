import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { StepPanel } from './StepPanel'

function renderPanel(overrides: Partial<Parameters<typeof StepPanel>[0]> = {}) {
  const handlers = { onBack: jest.fn(), onNext: jest.fn(), onRestart: jest.fn() }
  render(<StepPanel lines={<Text>lines</Text>} index={null} total={5} {...handlers} {...overrides} />)
  return handlers
}

const disabled = (id: string) => screen.getByTestId(id).props.accessibilityState?.disabled === true

describe('StepPanel', () => {
  it('shows the lines and a blank counter before the first step', () => {
    renderPanel()
    expect(screen.getByText('lines')).toBeTruthy()
    expect(screen.getByTestId('step-count').props.children).toBe(' ')
    expect(disabled('step-back')).toBe(true)
    expect(disabled('step-next')).toBe(false)
  })

  it('counts the move on show and stops ▶ at the last', () => {
    renderPanel({ index: 5 })
    expect(screen.getByTestId('step-count').props.children).toBe('5 / 5')
    expect(disabled('step-next')).toBe(true)
    expect(disabled('step-back')).toBe(false)
  })

  it('calls its handlers', () => {
    const h = renderPanel({ index: 2 })
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-back'))
    fireEvent.press(screen.getByTestId('step-restart'))
    expect(h.onNext).toHaveBeenCalledTimes(1)
    expect(h.onBack).toHaveBeenCalledTimes(1)
    expect(h.onRestart).toHaveBeenCalledTimes(1)
  })

  it('offers とじる only when it can be closed', () => {
    renderPanel()
    expect(screen.queryByTestId('steps-close')).toBeNull()
    const onClose = jest.fn()
    renderPanel({ onClose })
    const [close] = screen.getAllByTestId('steps-close')
    if (close === undefined) throw new Error('no とじる button')
    fireEvent.press(close)
    expect(onClose).toHaveBeenCalled()
  })
})
