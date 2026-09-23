import { render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { problemSteps, type Problem, type StepGroup } from '@/domain/problem'
import { DECK_PADDING, FRAME_PADDING, geometryFor, ROD_WIDTH } from '@/ui/abacus/geometry'
import { textOf } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { OPERAND_MAX_SCALE, OperandBoard, operandScale, TIMES_WIDTH } from './OperandBoard'

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
    const g = geometryFor(operandScale(3, 750 - 40))
    const row = StyleSheet.flatten(screen.getByTestId('operand-a-digits').props.style)
    expect(row.paddingHorizontal).toBeCloseTo(g.framePadding + g.deckPadding)
    expect(digitStyle('a', 1).width).toBeCloseTo(g.rodWidth)
    expect(StyleSheet.flatten(side('a').getByTestId('rod-1').props.style).width).toBeCloseTo(g.rodWidth)
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

  it('fits a phone-width window', () => {
    // As in QuestionView.test.tsx: `require` reaches the module object the
    // component's own import reads from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 320, height: 568, scale: 2, fontScale: 1 })
    render(<OperandBoard problem={problem} />)
    const padding = screen.getAllByTestId('abacus-frame').map((frame) => StyleSheet.flatten(frame.props.style).padding)
    expect(padding).toEqual([FRAME_PADDING * operandScale(3, 280), FRAME_PADDING * operandScale(3, 280)])
    spy.mockRestore()
  })
})

describe('operandScale', () => {
  // One board's width at scale 1: its rods and the deck's and frame's
  // padding on each side.
  const natural = (digits: number) => digits * ROD_WIDTH + 2 * (DECK_PADDING + FRAME_PADDING)

  it('draws the boards at their largest where they fit, as on a 375 pt phone', () => {
    expect(operandScale(3, 375 - 40)).toBe(OPERAND_MAX_SCALE)
    expect(operandScale(1, 375 - 40)).toBe(OPERAND_MAX_SCALE)
  })

  it('shrinks both boards, so they, the × and its gaps just fit a narrow window', () => {
    const scale = operandScale(3, 280)
    expect(scale).toBeLessThan(OPERAND_MAX_SCALE)
    expect(2 * natural(3) * scale + TIMES_WIDTH).toBeCloseTo(280)
  })
})
