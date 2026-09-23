import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/ui/theme'
import { ScrollingStepLines, StepControls, StepLines } from './StepPanel'
import { useActiveLineLayout } from './useActiveLineLayout'

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

  it('grows to fill the space it is given when asked to', () => {
    render(
      <StepLines fill>
        <Text>lines</Text>
      </StepLines>,
    )
    expect(StyleSheet.flatten(screen.getByTestId('step-panel').props.style).flexGrow).toBe(1)
  })
})

// The owner's request (2026-09-23): in bead mode the lines fill the space
// below ◀ ▶, scrolling on their own, and the line stepped to is scrolled into
// view.
describe('ScrollingStepLines', () => {
  let scrollTo: jest.SpyInstance
  beforeEach(() => {
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
  })
  afterEach(() => scrollTo.mockRestore())

  // A card with one line, always the one stepped to, as a card draws it.
  function Lines() {
    const lineLayout = useActiveLineLayout(0)
    return (
      <View testID="lines">
        <View testID="line" onLayout={lineLayout(0)} />
      </View>
    )
  }
  function renderLines(accent = true) {
    render(
      <ScrollingStepLines accent={accent}>
        <Lines />
      </ScrollingStepLines>,
    )
    // The line reports where it sits each time it is laid out.
    return (y: number, height: number) => layout('line', y, height)
  }
  const layout = (testID: string, y: number, height: number) =>
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })
  const scrolled = (y: number) =>
    fireEvent.scroll(screen.getByTestId('step-lines-scroll'), { nativeEvent: { contentOffset: { x: 0, y } } })

  it('holds the lines in the panel card, filling its own scroll', () => {
    renderLines(false)
    const card = within(screen.getByTestId('step-lines-scroll')).getByTestId('step-panel')
    expect(within(card).getByTestId('lines')).toBeTruthy()
    expect(StyleSheet.flatten(card.props.style).flexGrow).toBe(1)
    expect(edge()).not.toBe(colors.accent)
  })

  it('scrolls a line below the part on show just far enough to show it', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    reveal(300, 20)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 220, animated: true })
  })

  it('leaves the lines where they are when the line is already on show', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    reveal(40, 20)
    reveal(80, 20)
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('scrolls back up to a line above the part on show', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    scrolled(200)
    reveal(40, 20)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 40, animated: true })
  })

  // A second step before the first scroll has landed must not be measured
  // against where the lines were before it: from there, 40 would look on
  // show, and the scroll would carry on past it.
  it('counts from where it last scrolled to, before the scroll reports back', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    reveal(300, 20)
    reveal(40, 20)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 40, animated: true })
  })

  it('shows the start of a line taller than the part on show', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    reveal(300, 150)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 300, animated: true })
  })

  // The lines report where they sit among themselves; the card's edge and
  // padding come before them in the scroll.
  it('counts in where the lines start inside the card', () => {
    const reveal = renderLines()
    layout('step-lines-scroll', 0, 100)
    layout('step-lines-content', 9, 400)
    reveal(300, 20)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 229, animated: true })
  })

  it('does nothing before it has been laid out', () => {
    const reveal = renderLines()
    reveal(300, 20)
    expect(scrollTo).not.toHaveBeenCalled()
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
