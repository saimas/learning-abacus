import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress } from '@/domain/progress'
import { cellColors, colors } from '@/ui/theme'
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
    expect(cells.slice(12, 15)).toEqual(['practice-cell-mitori:1', 'practice-cell-mitori:2', 'practice-cell-mitori:3'])
  })

  // Spec (flash) §2: a sixth row, headed フ, under 見取算.
  it('has a フ row for フラッシュ暗算 under 見取算', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    expect(screen.getByText('フ')).toBeTruthy()
    expect(screen.getByTestId('practice-cell-flash:2').props.accessibilityLabel).toBe('2けたのフラッシュ暗算、まだ')
    const cells = screen.getAllByTestId(/^practice-cell-/).map((cell) => cell.props.testID as string)
    expect(cells).toHaveLength(18)
    expect(cells.slice(-3)).toEqual(['practice-cell-flash:1', 'practice-cell-flash:2', 'practice-cell-flash:3'])
  })

  it('colours and levels a フラッシュ暗算 cell like the others', () => {
    const progress = { ...emptyProgress(), practices: { 'flash:3': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-flash:3').props.accessibilityLabel).toBe(
      '3けたのフラッシュ暗算、うすい珠、レベル 4',
    )
    expect(screen.getByTestId('practice-level-flash:3').props.children).toBe('レベル 4')
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

  // Review focus: the stage colours moved to stageColor.ts, shared with Home
  // and the operation pages (spec (home menu) §2–3); the progress screen's
  // table must look as before (§5).
  it('colours each cell by its stage', () => {
    const progress = {
      ...emptyProgress(),
      practices: {
        'add:1': { ...newPracticeRecord(0), fade: 1 as const },
        'add:2': { ...newPracticeRecord(0), fade: 3 as const },
        'add:3': { ...newPracticeRecord(0), fade: 6 as const },
      },
    }
    render(<PracticeTable progress={progress} />)
    const background = (id: string) =>
      StyleSheet.flatten(screen.getByTestId(`practice-cell-${id}`).props.style).backgroundColor
    expect(['sub:1', 'add:1', 'add:2', 'add:3'].map(background)).toEqual([
      cellColors.unseen,
      cellColors.learning,
      cellColors.reflex,
      cellColors.mental,
    ])
  })
})

// Spec (home menu) §5: the progress screen's table, read-only. Runs start
// from each operation's page now, not from this table on Home.
describe('PracticeTable cells', () => {
  it('are never buttons', () => {
    render(<PracticeTable progress={emptyProgress()} />)
    for (const cell of screen.getAllByTestId(/^practice-cell-/)) {
      expect(cell.props.accessibilityRole).not.toBe('button')
    }
  })
})
