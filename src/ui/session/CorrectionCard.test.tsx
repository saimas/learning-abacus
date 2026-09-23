import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { atomId, type Atom, type Direction } from '@/domain/atoms'
import { colors } from '@/ui/theme'
import { CorrectionCard } from './CorrectionCard'
import { textOf } from './testing'
import { ActiveLayoutContext } from './useActiveLineLayout'

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

  // Spec (core rounds) §3: before an answer the same lines explain the move
  // without giving the answer away.
  it('leaves the answer out when asked to', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} showAnswer={false} />)
    expect(screen.queryByTestId('correction-answer')).toBeNull()
    expect(textOf(screen.getByTestId('correction-coaching'))).toBe('十の繰上：8をたす = +10 − 2')
  })

  it('names no other problem: it sits under the question it corrects', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} />)
    expect(screen.queryByTestId('correction-problem')).toBeNull()
  })

  // The owner's request (2026-09-23): in bead mode the lines scroll below
  // the controls, and the step on show is scrolled into view. A single
  // move's steps share one line, so the card tells the scroll around it
  // where that line sits.
  it('tells where the line of steps sits once a step is on show', () => {
    const onActiveLayout = jest.fn()
    const card = (activeStep?: number) => (
      <ActiveLayoutContext.Provider value={onActiveLayout}>
        <CorrectionCard atom={atom(7, 8, 'add')} expected={15} activeStep={activeStep} />
      </ActiveLayoutContext.Provider>
    )
    render(card())
    fireEvent(screen.getByTestId('correction-coaching'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 24, width: 300, height: 30 } },
    })
    expect(onActiveLayout).not.toHaveBeenCalled()

    screen.rerender(card(0))
    expect(onActiveLayout).toHaveBeenLastCalledWith(24, 30)
  })

  it('lays the line out for no one outside such a scroll', () => {
    render(<CorrectionCard atom={atom(7, 8, 'add')} expected={15} activeStep={0} />)
    expect(screen.getByTestId('correction-coaching').props.onLayout).toBeUndefined()
  })
})
