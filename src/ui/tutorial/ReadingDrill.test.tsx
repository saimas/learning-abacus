import { fireEvent, render } from '@testing-library/react-native'
import { ReadingDrill } from './ReadingDrill'

describe('ReadingDrill', () => {
  it('advances on a correct reading', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '7')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain('Rod 2')
  })

  it('does not advance on a wrong reading', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '2')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain('Rod 1')
  })

  it('does not complete the drill on an empty submit at the 0 prompt', () => {
    // Number('') is 0, so tapping Check on a blank field used to finish the
    // tutorial outright on the default drill's final rod.
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[0]} />)
    fireEvent.press(getByTestId('reading-submit'))
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.changeText(getByTestId('reading-input'), '0')
    fireEvent.press(getByTestId('reading-submit'))
    expect(onComplete).toHaveBeenCalled()
  })

  it('completes after the last value', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7]} />)
    fireEvent.changeText(getByTestId('reading-input'), '7')
    fireEvent.press(getByTestId('reading-submit'))
    expect(onComplete).toHaveBeenCalled()
  })
})
