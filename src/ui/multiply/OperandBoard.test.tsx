import { render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { problemSteps, type Problem, type StepGroup } from '@/domain/problem'
import { DECK_PADDING, FRAME_PADDING, geometryFor, ROD_WIDTH } from '@/ui/abacus/geometry'
import { textOf } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import {
  divisorScale,
  OPERAND_MAX_SCALE,
  OPERAND_SHORT_WINDOW_SCALE,
  OperandBoard,
  operandScale,
  TIMES_WIDTH,
} from './OperandBoard'

const problem: Problem = { op: 'mul', digits: 3, a: 472, b: 385 }
const groups = problemSteps(problem)

// The 九九 of the digits at these places of a and b.
function groupAt(xPlace: number, yPlace: number): StepGroup {
  const group = groups.find((g) => g.kind === 'product' && g.xPlace === xPlace && g.yPlace === yPlace)
  if (group === undefined) throw new Error(`no group at places ${xPlace}, ${yPlace}`)
  return group
}

const side = (name: 'a' | 'b') => within(screen.getByTestId(`operand-${name}`))
const digits = (name: 'a' | 'b') => [0, 1, 2].map((i) => textOf(screen.getByTestId(`operand-${name}-digit-${i}`)))
const rods = (name: 'a' | 'b') => [0, 1, 2].map((i) => side(name).getByTestId(`rod-${i}`).props.accessibilityValue.text)
const lit = (name: 'a' | 'b') => [0, 1, 2].filter((i) => side(name).queryByTestId(`rod-highlight-${i}`) !== null)
const digitStyle = (name: 'a' | 'b', i: number) =>
  StyleSheet.flatten(screen.getByTestId(`operand-${name}-digit-${i}`).props.style)
const emphasised = (name: 'a' | 'b') => [0, 1, 2].filter((i) => digitStyle(name, i).color === colors.accent)
const framePadding = () =>
  screen.getAllByTestId('abacus-frame').map((frame) => StyleSheet.flatten(frame.props.style).padding)

// As in QuestionView.test.tsx: `require` reaches the module object the
// component's own import reads from.
let restoreWindow = () => {}
function windowOf(width: number, height: number) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
  const reactNative = require('react-native')
  const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width, height, scale: 2, fontScale: 1 })
  restoreWindow = () => spy.mockRestore()
}
afterEach(() => restoreWindow())

describe('OperandBoard', () => {
  it('sets both numbers on beads, with their digits over the rods', () => {
    render(<OperandBoard problem={problem} />)
    expect(digits('a')).toEqual(['4', '7', '2'])
    expect(digits('b')).toEqual(['3', '8', '5'])
    expect(rods('a')).toEqual(['4', '7', '2'])
    expect(rods('b')).toEqual(['3', '8', '5'])
  })

  // The operands are the problem, not the mental image the fade takes away,
  // and nothing on them is the learner's to move.
  it('draws the numbers solid and takes no taps', () => {
    render(<OperandBoard problem={problem} />)
    for (const layer of screen.getAllByTestId('fade-layer')) expect(layer.props.style.opacity).toBe(1)
    expect(side('a').getByTestId('rod-0').props.accessibilityRole).toBeUndefined()
    expect(side('b').getByTestId('rod-2').props.accessibilityRole).toBeUndefined()
  })

  it('reads to VoiceOver as the problem', () => {
    render(<OperandBoard problem={problem} />)
    const board = screen.getByTestId('operand-board')
    expect(board.props.accessible).toBe(true)
    expect(board.props.accessibilityLabel).toBe('472 × 385')
  })

  it('puts each digit over its rod', () => {
    render(<OperandBoard problem={problem} />)
    // Jest's window is 750 × 1334.
    const g = geometryFor(operandScale(3, 750 - 40, 1334))
    const row = StyleSheet.flatten(screen.getByTestId('operand-a-digits').props.style)
    expect(row.paddingHorizontal).toBeCloseTo(g.framePadding + g.deckPadding)
    expect(digitStyle('a', 1).width).toBeCloseTo(g.rodWidth)
    expect(StyleSheet.flatten(side('a').getByTestId('rod-1').props.style).width).toBeCloseTo(g.rodWidth)
  })

  // The digits and the × sit in fixed-width boxes, so large accessibility
  // text sizes are capped rather than overflowing them.
  it('caps the digits and the × at large text sizes', () => {
    render(<OperandBoard problem={problem} />)
    expect(screen.getByText('×').props.maxFontSizeMultiplier).toBe(1.3)
    expect(screen.getByTestId('operand-b-digit-2').props.maxFontSizeMultiplier).toBe(1.3)
  })

  it('highlights nothing while no 九九 is on show', () => {
    render(<OperandBoard problem={problem} />)
    expect([lit('a'), lit('b'), emphasised('a'), emphasised('b')]).toEqual([[], [], [], []])
  })

  it('points at the two digits of the 九九 on show: 4 × 3 is the hundreds of each', () => {
    render(<OperandBoard problem={problem} activeGroup={groupAt(2, 2)} />)
    expect(lit('a')).toEqual([0])
    expect(lit('b')).toEqual([0])
    expect(emphasised('a')).toEqual([0])
    expect(emphasised('b')).toEqual([0])
    expect(digitStyle('a', 0).fontWeight).toBe('700')
    expect(digitStyle('a', 1).fontWeight).not.toBe('700')
  })

  it('follows the places: 7 × 5 is the tens of a and the ones of b', () => {
    const group = groupAt(1, 0)
    expect(group).toMatchObject({ x: 7, y: 5 })
    render(<OperandBoard problem={problem} activeGroup={group} />)
    expect(lit('a')).toEqual([1])
    expect(lit('b')).toEqual([2])
    expect(emphasised('a')).toEqual([1])
    expect(emphasised('b')).toEqual([2])
  })

  it('ignores a column group, which multiplies nothing', () => {
    const [column] = problemSteps({ op: 'add', digits: 3, a: 472, b: 385 })
    render(<OperandBoard problem={problem} activeGroup={column} />)
    expect([lit('a'), lit('b')]).toEqual([[], []])
  })

  it('fits a narrow window', () => {
    windowOf(320, 800)
    render(<OperandBoard problem={problem} />)
    const scale = operandScale(3, 280, 800)
    expect(scale).toBeLessThan(OPERAND_MAX_SCALE)
    expect(framePadding()).toEqual([FRAME_PADDING * scale, FRAME_PADDING * scale])
  })

  it('draws the boards smaller on a short window, and at their usual size on a tall one', () => {
    windowOf(375, 667)
    render(<OperandBoard problem={problem} />)
    expect(framePadding()).toEqual([FRAME_PADDING * OPERAND_SHORT_WINDOW_SCALE, FRAME_PADDING * OPERAND_SHORT_WINDOW_SCALE])
    screen.unmount()
    restoreWindow()

    windowOf(402, 874)
    render(<OperandBoard problem={problem} />)
    expect(framePadding()).toEqual([FRAME_PADDING * OPERAND_MAX_SCALE, FRAME_PADDING * OPERAND_MAX_SCALE])
  })
})

describe('operandScale', () => {
  // One board's width at scale 1: its rods and the deck's and frame's
  // padding on each side.
  const natural = (digits: number) => digits * ROD_WIDTH + 2 * (DECK_PADDING + FRAME_PADDING)

  it('draws the boards at their largest where they fit, as on a 402 × 874 phone', () => {
    expect(operandScale(3, 402 - 40, 874)).toBe(OPERAND_MAX_SCALE)
    expect(operandScale(1, 402 - 40, 874)).toBe(OPERAND_MAX_SCALE)
  })

  // A 375 × 667 phone must still show the prompt above the product soroban
  // and 手順を見る below the board under it.
  it('draws them smaller on a short window, as on a 375 × 667 phone', () => {
    expect(operandScale(3, 375 - 40, 667)).toBe(OPERAND_SHORT_WINDOW_SCALE)
    expect(operandScale(1, 375 - 40, 667)).toBe(OPERAND_SHORT_WINDOW_SCALE)
  })

  it('shrinks both boards, so they, the × and its gaps just fit a narrow window', () => {
    const scale = operandScale(3, 280, 800)
    expect(scale).toBeLessThan(OPERAND_MAX_SCALE)
    expect(2 * natural(3) * scale + TIMES_WIDTH).toBeCloseTo(280)
  })
})

// Spec (division) §3: 商除法 sets the dividend on the soroban itself, so the
// board shows only the divisor, and points at the digit whose 九九 is being
// taken off.
describe('OperandBoard for ÷', () => {
  const division: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }
  const divisionGroups = problemSteps(division)
  const groupOf = (index: number): StepGroup => {
    const group = divisionGroups[index]
    if (group === undefined) throw new Error(`no group ${index}`)
    return group
  }
  const divisorDigits = () => [0, 1].map((i) => textOf(screen.getByTestId(`operand-b-digit-${i}`)))
  const divisorRods = () => [0, 1].map((i) => side('b').getByTestId(`rod-${i}`).props.accessibilityValue.text)
  const divisorLit = () => [0, 1].filter((i) => side('b').queryByTestId(`rod-highlight-${i}`) !== null)
  const divisorEmphasised = () => [0, 1].filter((i) => digitStyle('b', i).color === colors.accent)

  it('sets only the divisor on beads, with its digits over the rods', () => {
    render(<OperandBoard problem={division} />)
    expect(divisorDigits()).toEqual(['3', '6'])
    expect(divisorRods()).toEqual(['3', '6'])
    expect(screen.queryByTestId('operand-a')).toBeNull()
    expect(screen.queryByText('×')).toBeNull()
    expect(screen.getAllByTestId('abacus-frame')).toHaveLength(1)
  })

  // The controller's ruling (2026-09-24): the board reads as "÷ 36", with
  // the ÷ drawn exactly as the × between the × boards.
  it('puts a ÷ before the divisor, drawn as the × between the × boards', () => {
    render(<OperandBoard problem={problem} />)
    const times = screen.getByText('×')
    const timesStyle = StyleSheet.flatten(times.props.style)
    screen.unmount()

    render(<OperandBoard problem={division} />)
    const divide = screen.getByText('÷')
    expect(StyleSheet.flatten(divide.props.style)).toEqual(timesStyle)
    expect(divide.props.maxFontSizeMultiplier).toBe(1.3)
    // Left of the divisor: the board reads as the ÷, then the divisor's
    // digits.
    expect(textOf(screen.getByTestId('operand-board'))).toBe('÷36')
  })

  it('reads to VoiceOver as the divisor', () => {
    render(<OperandBoard problem={division} />)
    const board = screen.getByTestId('operand-board')
    expect(board.props.accessible).toBe(true)
    expect(board.props.accessibilityLabel).toBe('わる数 36')
  })

  it('draws the divisor solid and takes no taps', () => {
    render(<OperandBoard problem={division} />)
    for (const layer of screen.getAllByTestId('fade-layer')) expect(layer.props.style.opacity).toBe(1)
    expect(side('b').getByTestId('rod-0').props.accessibilityRole).toBeUndefined()
  })

  it('highlights nothing while no 九九 is on show', () => {
    render(<OperandBoard problem={division} />)
    expect([divisorLit(), divisorEmphasised()]).toEqual([[], []])
  })

  // Placing a quotient digit multiplies nothing.
  it('highlights nothing while a quotient digit is placed', () => {
    expect(groupOf(0)).toMatchObject({ kind: 'quotient', q: 4 })
    render(<OperandBoard problem={division} activeGroup={groupOf(0)} />)
    expect([divisorLit(), divisorEmphasised()]).toEqual([[], []])
  })

  it('points at the divisor digit of the 九九 taken off: 4 × 3, then 4 × 6', () => {
    expect(groupOf(1)).toMatchObject({ kind: 'subtract', q: 4, y: 3, yPlace: 1 })
    render(<OperandBoard problem={division} activeGroup={groupOf(1)} />)
    expect([divisorLit(), divisorEmphasised()]).toEqual([[0], [0]])
    expect(digitStyle('b', 0).fontWeight).toBe('700')
    expect(digitStyle('b', 1).fontWeight).not.toBe('700')

    expect(groupOf(2)).toMatchObject({ kind: 'subtract', q: 4, y: 6, yPlace: 0 })
    screen.rerender(<OperandBoard problem={division} activeGroup={groupOf(2)} />)
    expect([divisorLit(), divisorEmphasised()]).toEqual([[1], [1]])
  })

  it('ignores a 九九 of a × problem, which takes nothing off', () => {
    render(<OperandBoard problem={division} activeGroup={groupAt(2, 2)} />)
    expect(divisorLit()).toEqual([])
  })

  // The same sizes as the × boards, so the board under the soroban looks the
  // same whichever the operation.
  it('draws the divisor at the × boards’ size: smaller on a short window, usual on a tall one', () => {
    windowOf(375, 667)
    render(<OperandBoard problem={division} />)
    expect(framePadding()).toEqual([FRAME_PADDING * OPERAND_SHORT_WINDOW_SCALE])
    screen.unmount()
    restoreWindow()

    windowOf(402, 874)
    render(<OperandBoard problem={division} />)
    expect(framePadding()).toEqual([FRAME_PADDING * OPERAND_MAX_SCALE])
  })

  it('fits a narrow window', () => {
    windowOf(160, 800)
    render(<OperandBoard problem={{ op: 'div', digits: 3, a: 202032, b: 976 }} />)
    const scale = divisorScale(3, 120, 800)
    expect(scale).toBeLessThan(OPERAND_MAX_SCALE)
    expect(framePadding()).toEqual([FRAME_PADDING * scale])
  })
})

describe('divisorScale', () => {
  const natural = (digits: number) => digits * ROD_WIDTH + 2 * (DECK_PADDING + FRAME_PADDING)

  it('follows the × boards’ limits', () => {
    expect(divisorScale(3, 402 - 40, 874)).toBe(OPERAND_MAX_SCALE)
    expect(divisorScale(3, 375 - 40, 667)).toBe(OPERAND_SHORT_WINDOW_SCALE)
  })

  // One board, with only the ÷ beside it, has the rest of the room to itself.
  it('shrinks the board, so it and the ÷ before it just fit a narrow window', () => {
    const scale = divisorScale(3, 120, 800)
    expect(scale).toBeLessThan(OPERAND_MAX_SCALE)
    expect(natural(3) * scale + TIMES_WIDTH).toBeCloseTo(120)
  })
})
