import { render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { FLASH_FONT_SIZE, FLASH_SHORT_FONT_SIZE, FlashPrompt } from './FlashPrompt'

const TERMS = [47, 30, 23, 61, 19]
const LABEL = 'フラッシュ暗算、5口'
const COLUMN = '47、たす30、たす23、たす61、たす19。'

// The column held under the flash is hidden from VoiceOver, which the
// queries skip unless asked.
const hidden = { includeHiddenElements: true }

let restoreWindow = () => {}
afterEach(() => {
  restoreWindow()
  restoreWindow = () => {}
})

function windowOf(width: number, height: number) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in TermColumn.test.tsx: `require` reaches the module object the component's own import reads from
  const reactNative = require('react-native')
  const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width, height, scale: 2, fontScale: 1 })
  restoreWindow = () => spy.mockRestore()
}

function prompt(shown: number | null, columnShown = false, activeTerm?: number) {
  return (
    <FlashPrompt
      terms={TERMS}
      label={LABEL}
      columnLabel={COLUMN}
      shown={shown}
      columnShown={columnShown}
      activeTerm={activeTerm}
    />
  )
}

describe('FlashPrompt', () => {
  // Spec (flash) §2: large, with a small counter.
  it('shows the number on show, large, with its counter', () => {
    render(prompt(0))
    expect(screen.getByTestId('flash-number').props.children).toBe('47')
    expect(screen.getByTestId('flash-counter').props.children).toBe('1/5')
    screen.rerender(prompt(4))
    expect(screen.getByTestId('flash-number').props.children).toBe('19')
    expect(screen.getByTestId('flash-counter').props.children).toBe('5/5')
  })

  // Before, between and after the numbers; they cannot be seen again.
  it('shows no number when none is on show', () => {
    render(prompt(null))
    expect(screen.queryByTestId('flash-number')).toBeNull()
    expect(screen.queryByTestId('flash-counter')).toBeNull()
    for (const term of TERMS) expect(screen.queryByText(String(term))).toBeNull()
  })

  // The soroban under the prompt must not move as numbers come and go or
  // the panel opens, so the column's height is always held.
  it('holds the column’s height, drawn unseen and hidden from VoiceOver', () => {
    render(prompt(2))
    const room = screen.getByTestId('flash-column-space', hidden)
    expect(StyleSheet.flatten(room.props.style).opacity).toBe(0)
    expect(room.props.accessibilityElementsHidden).toBe(true)
    expect(room.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(within(room).getByTestId('term-4', hidden)).toBeTruthy()
    expect(screen.queryByTestId('term-4')).toBeNull()
  })

  // Spec (flash) §5: VoiceOver names the problem; the numbers are announced.
  it('reads as the problem’s name, not its numbers', () => {
    render(prompt(1))
    const box = screen.getByTestId('prompt')
    expect(box.props.accessible).toBe(true)
    expect(box.props.accessibilityLabel).toBe(LABEL)
  })

  // Spec (flash) §2: the steps show the five numbers as 見取算's column.
  it('shows the five numbers as a column once the panel is open, lit and read as one sentence', () => {
    render(prompt(null, true, 2))
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe(COLUMN)
    expect(screen.queryByTestId('flash-column-space', hidden)).toBeNull()
    const lit = within(screen.getByTestId('term-2')).getByText('23')
    expect(StyleSheet.flatten(lit.props.style).color).toBe(colors.accent)
  })

  it('shows the column, not a number, whenever the panel is open', () => {
    render(prompt(1, true))
    expect(screen.queryByTestId('flash-number')).toBeNull()
    expect(screen.getByTestId('term-1')).toBeTruthy()
  })

  it('flashes large, and smaller on a short window', () => {
    windowOf(402, 874)
    const { unmount } = render(prompt(0))
    expect(StyleSheet.flatten(screen.getByTestId('flash-number').props.style).fontSize).toBe(FLASH_FONT_SIZE)
    unmount()
    windowOf(375, 667)
    render(prompt(0))
    expect(StyleSheet.flatten(screen.getByTestId('flash-number').props.style).fontSize).toBe(FLASH_SHORT_FONT_SIZE)
  })
})
