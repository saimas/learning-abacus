import { fireEvent, render } from '@testing-library/react-native'
import { ReadingDrill } from './ReadingDrill'

describe('ReadingDrill', () => {
  it('advances on a correct reading', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '7')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain('2問目')
  })

  it('does not advance on a wrong reading', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '2')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-index').props.children).toContain('1問目')
  })

  it('says how a rod is read before asking for a reading', () => {
    // The stated user is a total beginner, redirected here on launch with no
    // way out. Nothing on screen explained what the beads were worth.
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7]} />)
    const instruction = getByTestId('reading-instruction').props.children as string
    expect(instruction).toContain('五珠')
    expect(instruction).toContain('一珠')
    expect(instruction).toContain('5')
    expect(instruction).toContain('梁')
  })

  it('shows the correct reading after a wrong answer instead of silently clearing', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[6, 3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '2')
    fireEvent.press(getByTestId('reading-submit'))
    const feedback = getByTestId('reading-feedback').props.children as string
    expect(feedback).toContain('6')
    expect(feedback).toContain('5 + 1')
  })

  it('explains a rod with no heaven bead in earth beads alone', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[3]} />)
    fireEvent.changeText(getByTestId('reading-input'), '8')
    fireEvent.press(getByTestId('reading-submit'))
    expect(getByTestId('reading-feedback').props.children).toContain('一珠が3つ')
  })

  it('clears the feedback once the learner gets it right', () => {
    const { getByTestId, queryByTestId } = render(
      <ReadingDrill onComplete={jest.fn()} values={[6, 3]} />,
    )
    fireEvent.changeText(getByTestId('reading-input'), '2')
    fireEvent.press(getByTestId('reading-submit'))
    expect(queryByTestId('reading-feedback')).not.toBeNull()

    fireEvent.changeText(getByTestId('reading-input'), '6')
    fireEvent.press(getByTestId('reading-submit'))
    expect(queryByTestId('reading-feedback')).toBeNull()
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
