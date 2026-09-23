import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { textOf } from '@/ui/session/testing'
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
})
