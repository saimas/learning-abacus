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

  // Spec (division) §3: 商除法 alternates placing a quotient digit and
  // taking its 九九 with each divisor digit off the remainder.
  it('gives a line per quotient digit and per 九九 taken off, in order, highlighting the one replayed', () => {
    render(
      <ProblemCorrectionCard problem={{ op: 'div', digits: 2, a: 1692, b: 36 }} expected={47} activeGroup={1} />,
    )
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47')
    const lines = screen
      .getAllByTestId(/^correction-(quotient|subtract)-/)
      .map((line) => [line.props.testID, textOf(line)])
    expect(lines).toEqual([
      ['correction-quotient-0', '16÷3で見当をつけると5。5だと引ききれないので4にする。商4を頭の1つ左に立てる'],
      ['correction-subtract-1', '4×3=12　千の位から1、百の位から2を引く'],
      ['correction-subtract-2', '4×6=24　百の位から2、十の位から4を引く'],
      ['correction-quotient-3', '25÷3で見当をつけると8。8だと引ききれないので7にする。商7を頭の1つ左に立てる'],
      ['correction-subtract-4', '7×3=21　百の位から2、十の位から1を引く'],
      ['correction-subtract-5', '7×6=42　十の位から4、一の位から2を引く'],
    ])
    expect(colorOf('correction-subtract-1')).toBe(colors.accent)
    expect(colorOf('correction-quotient-0')).not.toBe(colors.accent)
  })

  it('highlights a quotient digit stepped to', () => {
    render(
      <ProblemCorrectionCard problem={{ op: 'div', digits: 2, a: 432, b: 36 }} expected={12} activeGroup={0} />,
    )
    expect(textOf(screen.getByTestId('correction-quotient-0'))).toBe('4÷3で見当をつけると1。商1を頭の2つ左に立てる')
    expect(colorOf('correction-quotient-0')).toBe(colors.accent)
    expect(colorOf('correction-subtract-1')).not.toBe(colors.accent)
  })

  // 202032 ÷ 976 = 207: the tens digit of the quotient is 0. Nothing is
  // placed and nothing is taken off, but the learner still decides it, so it
  // keeps its line, and the next digit follows it at once.
  it('gives a 0 quotient digit its line, with no 九九 after it', () => {
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 3, a: 202032, b: 976 }} expected={207} />)
    expect(textOf(screen.getByTestId('correction-quotient-4'))).toBe('頭に9は入らないので、商0（立てない）')
    expect(textOf(screen.getByTestId('correction-quotient-5'))).toBe('68÷9で見当をつけると7。商7を頭の1つ左に立てる')
  })

  // The guess's harder cases, as a real problem's second digit reads them:
  // a head ÷ first digit of 10 or more, a guess lowered by more than one,
  // and a 0 digit with nothing left.
  it.each([
    [684, 36, 19, '32÷3は10以上なので、見当は9。商9を頭の1つ左に立てる'],
    [285, 19, 15, '9÷1で見当をつけると9。9だと引ききれないので、引けるまで下げて5にする。商5を頭の2つ左に立てる'],
    [893, 19, 47, '13÷1は10以上なので、見当は9。9だと引ききれないので、引けるまで下げて7にする。商7を頭の1つ左に立てる'],
    [360, 36, 10, '残りは0なので、商0（立てない）'],
  ])('explains the guess for the second digit of %p ÷ %p', (a, b, expected, line) => {
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 2, a, b }} expected={expected} />)
    expect(textOf(screen.getByTestId('correction-quotient-3'))).toBe(line)
  })

  // A 3けた 0 digit, as a real problem reads it: after the 1 of 10815 ÷ 105,
  // 315 is left, whose head above the tens is 0, yet it is not nothing left,
  // and the next digit is read from it; after the 1 of 17702 ÷ 167, 1 ÷ 1
  // guesses 1, which does not come off, so it is lowered to 0.
  it.each([
    [10815, 105, 103, ['頭に1は入らないので、商0（立てない）', '3÷1で見当をつけると3。商3を頭の2つ左に立てる']],
    [
      17702,
      167,
      106,
      [
        '1÷1で見当をつけると1。1だと引ききれないので0にする。商0（立てない）',
        '10÷1は10以上なので、見当は9。9だと引ききれないので、引けるまで下げて6にする。商6を頭の1つ左に立てる',
      ],
    ],
  ])('explains the 0 digit of %p ÷ %p and the digit after it', (a, b, expected, lines) => {
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 3, a, b }} expected={expected} />)
    expect([4, 5].map((i) => textOf(screen.getByTestId(`correction-quotient-${i}`)))).toEqual(lines)
  })

  it('still gives a line for a 九九 of a 0 divisor digit, since recalling it is still a step', () => {
    // 12915 ÷ 105 = 123: 1 × the 0 of 105 takes nothing off.
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 3, a: 12915, b: 105 }} expected={123} />)
    expect(textOf(screen.getByTestId('correction-subtract-2'))).toBe('1×0=00')
  })

  // Spec (division) §2: a bead answer is checked against the final soroban
  // reading, not the quotient, so a caller drawing this in bead mode passes
  // expectedBeads and the answer line says both.
  it('names what the beads themselves needed to read, when given expectedBeads', () => {
    render(
      <ProblemCorrectionCard
        problem={{ op: 'div', digits: 2, a: 1692, b: 36 }}
        expected={47}
        expectedBeads={47000}
      />,
    )
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47（そろばんは 47000）')
  })

  // Undefined (keypad mode, or any non-÷ problem) leaves the answer line
  // exactly as it always read.
  it('leaves the answer line alone without expectedBeads', () => {
    render(<ProblemCorrectionCard problem={{ op: 'div', digits: 2, a: 1692, b: 36 }} expected={47} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47')
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
