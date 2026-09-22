import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { atomId, type Atom, type Direction } from '@/domain/atoms'
import { colors } from '@/ui/theme'
import { CorrectionCard } from './CorrectionCard'
import { textOf } from './testing'

function atom(rodValue: number, operand: number, direction: Direction): Atom {
  return { id: atomId(rodValue, operand, direction), rodValue, operand, direction }
}

const colorOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)?.color

describe('CorrectionCard', () => {
  it('reads the answer, and the substitution as one sentence', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 15')
    expect(textOf(screen.getByTestId('correction-coaching'))).toBe('十の繰上：8をたす = +10 − 2')
  })

  it('sets each step apart', () => {
    render(<CorrectionCard atom={atom(7, 6, 'add')} expected={13} />)
    expect(textOf(screen.getByTestId('correction-step-0'))).toBe('+10')
    expect(textOf(screen.getByTestId('correction-step-1'))).toBe('− 5')
    expect(textOf(screen.getByTestId('correction-step-2'))).toBe('+ 1')
  })

  it('highlights only the active step', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} activeStep={1} />)
    expect(colorOf('correction-step-1')).toBe(colors.accent)
    expect(colorOf('correction-step-0')).not.toBe(colors.accent)
  })

  it('highlights nothing when no step is active', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(colorOf('correction-step-0')).not.toBe(colors.accent)
    expect(colorOf('correction-step-1')).not.toBe(colors.accent)
  })
})
