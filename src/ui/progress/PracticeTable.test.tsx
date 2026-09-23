import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress } from '@/domain/progress'
import { colors } from '@/ui/theme'
import { PracticeTable, practiceStage } from './PracticeTable'

// Extract text color from a cell's child Text element
const textColorOf = (cellTestID: string): string | undefined => {
  const cell = screen.getByTestId(cellTestID)
  const children = cell.children as unknown[]
  if (children && children.length > 0) {
    const child = children[0] as { props?: { style?: unknown } }
    if (child && child.props) {
      const style = StyleSheet.flatten(child.props.style)
      if (style && typeof style === 'object' && 'color' in style) {
        return String(style.color)
      }
    }
  }
  return undefined
}

describe('practiceStage', () => {
  it('names where a kind stands by its fade level', () => {
    expect(practiceStage(undefined)).toBe('unseen')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 2 })).toBe('beads')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 3 })).toBe('fading')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 6 })).toBe('mental')
  })
})

describe('PracticeTable', () => {
  it('shows a cell per kind, labelled for VoiceOver', () => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-add:2').props.accessibilityLabel).toBe('2けたのたし算、うすい珠')
    expect(screen.getByTestId('practice-cell-sub:3').props.accessibilityLabel).toBe('3けたのひき算、まだ')
  })

  it('has a row for ×, alongside ＋ and −', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByTestId('practice-cell-mul:3').props.accessibilityLabel).toBe('3けたのかけ算、まだ')
  })

  it('uses ink text for fading stage and paper text for mental stage', () => {
    const progress = {
      ...emptyProgress(),
      practices: {
        'add:2': { ...newPracticeRecord(0), fade: 3 as const }, // fading
        'sub:2': { ...newPracticeRecord(0), fade: 6 as const }, // mental
      },
    }
    render(<PracticeTable progress={progress} />)

    expect(textColorOf('practice-cell-add:2')).toBe(colors.ink)
    expect(textColorOf('practice-cell-sub:2')).toBe(colors.paper)
  })
})

// Spec (core rounds) §6: Home uses the table itself as the practice grid.
describe('PracticeTable with onChoose', () => {
  it('makes every cell a button that reports its kind', () => {
    const onChoose = jest.fn()
    render(<PracticeTable progress={emptyProgress()} onChoose={onChoose} />)
    const cell = screen.getByTestId('practice-cell-sub:2')
    expect(cell.props.accessibilityRole).toBe('button')
    fireEvent.press(cell)
    expect(onChoose).toHaveBeenCalledWith({ op: 'sub', digits: 2 })
  })

  it('is not a button when onChoose is not given', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByTestId('practice-cell-sub:2').props.accessibilityRole).not.toBe('button')
  })
})
