import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress } from '@/domain/progress'
import { colors } from '@/ui/theme'
import { PracticeTable } from './PracticeTable'

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

describe('PracticeTable', () => {
  it('shows a cell per kind, labelled for VoiceOver', () => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-add:2').props.accessibilityLabel).toBe('2けたのたし算、うすい珠、レベル 4')
    expect(screen.getByTestId('practice-cell-sub:3').props.accessibilityLabel).toBe('3けたのひき算、まだ')
  })

  // The owner (2026-09-30): each practised kind shows its level under its
  // word; a kind not yet practised has none.
  it('shows each practised kind’s level under its word', () => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-level-add:2').props.children).toBe('レベル 4')
    expect(screen.queryByTestId('practice-level-sub:3')).toBeNull()
  })

  // Review (2026-09-30): muted 10 pt text read at 1.3:1 on the うすい珠
  // cell. The level is drawn like the cell's word, in its colour and size.
  it.each([
    [3, colors.ink],
    [6, colors.paper],
  ] as const)('draws the level at %p as readably as the cell’s word', (fade, color) => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade } } }
    render(<PracticeTable progress={progress} />)
    const style = StyleSheet.flatten(screen.getByTestId('practice-level-add:2').props.style)
    expect(style.color).toBe(color)
    expect(style.fontSize).toBeGreaterThanOrEqual(11)
  })

  it('has a row for ×, alongside ＋ and −', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByTestId('practice-cell-mul:3').props.accessibilityLabel).toBe('3けたのかけ算、まだ')
  })

  // Spec (見取算) §2: a fifth row, headed ±, below ÷.
  it('has a ± row for 見取算 below ÷', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByText('±')).toBeTruthy()
    expect(screen.getByTestId('practice-cell-mitori:2').props.accessibilityLabel).toBe('2けたの見取算、まだ')
    const cells = screen.getAllByTestId(/^practice-cell-/).map((cell) => cell.props.testID as string)
    expect(cells.slice(-3)).toEqual(['practice-cell-mitori:1', 'practice-cell-mitori:2', 'practice-cell-mitori:3'])
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
