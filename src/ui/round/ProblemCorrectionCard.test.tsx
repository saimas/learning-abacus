import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { textOf } from '@/ui/session/testing'
import { ActiveLayoutContext } from '@/ui/session/useActiveLineLayout'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'

const colorOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)?.color

describe('ProblemCorrectionCard', () => {
  it('gives the answer, then one line per column that moves, highest place first', () => {
    render(<ProblemCorrectionCard problem={{ op: 'add', digits: 3, a: 345, b: 102 }} expected={447} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 447')
    expect(screen.getByTestId('correction-column-2')).toBeTruthy()
    // b's tens digit is 0: nothing moves on the tens rod, so it has no line.
    expect(screen.queryByTestId('correction-column-1')).toBeNull()
    expect(textOf(screen.getByTestId('correction-column-0'))).toContain('一の位')
  })

  // Spec (core rounds) §3: before an answer the same lines explain the
  // problem without giving the answer away.
  it('leaves the answer out when asked to', () => {
    render(
      <ProblemCorrectionCard problem={{ op: 'add', digits: 3, a: 345, b: 102 }} expected={447} showAnswer={false} />,
    )
    expect(screen.queryByTestId('correction-answer')).toBeNull()
    expect(screen.getByTestId('correction-column-2')).toBeTruthy()
  })

  it('highlights the column stepped to', () => {
    render(<ProblemCorrectionCard problem={{ op: 'add', digits: 3, a: 472, b: 385 }} expected={857} activeGroup={1} />)
    expect(colorOf('correction-column-1')).toBe(colors.accent)
    expect(colorOf('correction-column-2')).not.toBe(colors.accent)
  })

  it('gives a line per 九九 of a multiplication, highlighting the one replayed', () => {
    render(
      <ProblemCorrectionCard problem={{ op: 'mul', digits: 2, a: 47, b: 36 }} expected={1692} activeGroup={1} />,
    )
    expect(textOf(screen.getByTestId('correction-product-0'))).toBe('4×3=12　千の位に1、百の位に2')
    expect(textOf(screen.getByTestId('correction-product-3'))).toBe('7×6=42　十の位に4、一の位に2')
    expect(colorOf('correction-product-1')).toBe(colors.accent)
    expect(colorOf('correction-product-0')).not.toBe(colors.accent)
  })

  it('still gives a line for a 九九 whose product is 0, since recalling it is still a step', () => {
    // 40 × 36: the third 九九 (a's ones digit 0 × b's tens digit 3) moves
    // nothing, but the learner still recalls "0×3", so its line must render.
    render(<ProblemCorrectionCard problem={{ op: 'mul', digits: 2, a: 40, b: 36 }} expected={1440} />)
    expect(textOf(screen.getByTestId('correction-product-2'))).toBe('0×3=00')
  })

  it('places a single-digit product at the ones place when its tens digit is 0', () => {
    // 2 × 3 = 06: the tens digit is 0 and filtered out, leaving one digit at
    // the ones place rather than a "十の位" line.
    render(<ProblemCorrectionCard problem={{ op: 'mul', digits: 1, a: 2, b: 3 }} expected={6} />)
    expect(textOf(screen.getByTestId('correction-product-0'))).toBe('2×3=06　一の位に6')
  })

  // The ÷ step lines come with the ÷ screens; until then a division's card
  // must still render its answer rather than fail on the new kinds of group.
  it('gives the answer of a division, and no lines for its groups yet', () => {
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 2, a: 1692, b: 36 }} expected={47} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47')
    expect(screen.queryAllByTestId(/^correction-(column|product)-/)).toEqual([])
  })
})

// The owner's request (2026-09-23): in bead mode the lines scroll below the
// controls, and the line stepped to is scrolled into view, so the card tells
// the scroll around it where that line sits.
describe('ProblemCorrectionCard telling where the line stepped to sits', () => {
  const problem = { op: 'mul', digits: 2, a: 47, b: 36 } as const
  const layout = (testID: string, y: number, height: number) =>
    fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })
  // The card inside lines that scroll on their own, as bead mode draws it.
  const inScroll = (onActiveLayout: jest.Mock, activeGroup?: number) => (
    <ActiveLayoutContext.Provider value={onActiveLayout}>
      <ProblemCorrectionCard problem={problem} expected={1692} activeGroup={activeGroup} />
    </ActiveLayoutContext.Provider>
  )

  it('tells it once the line stepped to is laid out, and nothing for the others', () => {
    const onActiveLayout = jest.fn()
    render(inScroll(onActiveLayout, 1))
    layout('correction-product-0', 20, 16)
    expect(onActiveLayout).not.toHaveBeenCalled()
    layout('correction-product-1', 38, 16)
    expect(onActiveLayout).toHaveBeenLastCalledWith(38, 16)
    expect(onActiveLayout).toHaveBeenCalledTimes(1)
  })

  // Moving the highlight restyles a line without moving it, which lays
  // nothing out afresh, so the card answers from each line's last layout.
  it('tells it again each time the highlight moves to another line', () => {
    const onActiveLayout = jest.fn()
    render(inScroll(onActiveLayout))
    for (const [index, y] of [20, 38, 56, 74].entries()) layout(`correction-product-${index}`, y, 16)
    expect(onActiveLayout).not.toHaveBeenCalled()

    screen.rerender(inScroll(onActiveLayout, 3))
    expect(onActiveLayout).toHaveBeenLastCalledWith(74, 16)
    screen.rerender(inScroll(onActiveLayout, 2))
    expect(onActiveLayout).toHaveBeenLastCalledWith(56, 16)
    // Nothing stepped to, nothing to tell.
    screen.rerender(inScroll(onActiveLayout))
    expect(onActiveLayout).toHaveBeenCalledTimes(2)
  })

  // Keypad mode's lines scroll with the prompt, with no scroll of their own
  // around them to tell.
  it('lays no line out for it outside such a scroll', () => {
    render(<ProblemCorrectionCard problem={problem} expected={1692} activeGroup={1} />)
    expect(screen.getByTestId('correction-product-1').props.onLayout).toBeUndefined()
  })
})
