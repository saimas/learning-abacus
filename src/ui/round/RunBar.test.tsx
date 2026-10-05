import { fireEvent, render, screen } from '@testing-library/react-native'
import { RunBar } from './RunBar'

function renderBar(overrides: Partial<Parameters<typeof RunBar>[0]> = {}) {
  const onQuit = jest.fn()
  render(<RunBar lives={3} level={0} score={0} combo={0} reduceMotion={false} onQuit={onQuit} {...overrides} />)
  return { onQuit }
}

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
})
