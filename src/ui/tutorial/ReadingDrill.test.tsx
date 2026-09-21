import { fireEvent, render } from '@testing-library/react-native'
import { ReadingDrill } from './ReadingDrill'

type GetByTestId = ReturnType<typeof render>['getByTestId']

// Types a reading on the keypad and presses たしかめる.
function read(getByTestId: GetByTestId, value: string) {
  for (const digit of value) fireEvent.press(getByTestId(`key-${digit}`))
  fireEvent.press(getByTestId('reading-submit'))
}

describe('ReadingDrill', () => {
  it('advances on a correct reading', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3]} />)
    read(getByTestId, '7')
    expect(getByTestId('reading-index').props.accessibilityLabel).toContain('2問目')
  })

  it('does not advance on a wrong reading', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3]} />)
    read(getByTestId, '2')
    expect(getByTestId('reading-index').props.accessibilityLabel).toContain('1問目')
  })

  it('shows one progress dot per rod', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[7, 3, 5]} />)
    expect(getByTestId('reading-index').props.children).toHaveLength(3)
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
    read(getByTestId, '2')
    const feedback = getByTestId('reading-feedback').props.children as string
    expect(feedback).toContain('6')
    expect(feedback).toContain('5 + 1')
  })

  it('explains a rod with no heaven bead in earth beads alone', () => {
    const { getByTestId } = render(<ReadingDrill onComplete={jest.fn()} values={[3]} />)
    read(getByTestId, '8')
    expect(getByTestId('reading-feedback').props.children).toContain('一珠が3つ')
  })

  it('clears the feedback once the learner gets it right', () => {
    const { getByTestId, queryByTestId } = render(
      <ReadingDrill onComplete={jest.fn()} values={[6, 3]} />,
    )
    read(getByTestId, '2')
    expect(queryByTestId('reading-feedback')).not.toBeNull()

    read(getByTestId, '6')
    expect(queryByTestId('reading-feedback')).toBeNull()
  })

  it('does not complete the drill on an empty submit at the 0 prompt', () => {
    // Number('') is 0, so tapping Check on a blank field used to finish the
    // tutorial outright on the default drill's final rod.
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[0]} />)
    fireEvent.press(getByTestId('reading-submit'))
    expect(onComplete).not.toHaveBeenCalled()

    read(getByTestId, '0')
    expect(onComplete).toHaveBeenCalled()
  })

  it('completes after the last value', () => {
    const onComplete = jest.fn()
    const { getByTestId } = render(<ReadingDrill onComplete={onComplete} values={[7]} />)
    read(getByTestId, '7')
    expect(onComplete).toHaveBeenCalled()
  })
})
