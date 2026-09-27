import { render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { COLUMN_FONT_SIZE, COLUMN_SHORT_FONT_SIZE, TermColumn } from './TermColumn'

const TERMS = [47, 30, -23, 61, -19]
const LABEL = '47、たす30、ひく23、たす61、ひく19。'

const styleOf = (row: number, text: string) =>
  StyleSheet.flatten(within(screen.getByTestId(`term-${row}`)).getByText(text).props.style)

let restoreWindow = () => {}
afterEach(() => {
  restoreWindow()
  restoreWindow = () => {}
})

function windowOf(width: number, height: number) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in QuestionView.test.tsx: `require` reaches the module object the component's own import reads from
  const reactNative = require('react-native')
  const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width, height, scale: 2, fontScale: 1 })
  restoreWindow = () => spy.mockRestore()
}

describe('TermColumn', () => {
  // Spec (見取算) §2: right-aligned, a minus sign only on the numbers to
  // subtract, as on exam paper.
  it('lists the numbers in order, a minus sign only on the subtracted ones', () => {
    render(<TermColumn terms={TERMS} label={LABEL} />)
    expect(within(screen.getByTestId('term-0')).getByText('47')).toBeTruthy()
    expect(within(screen.getByTestId('term-2')).getByText('23')).toBeTruthy()
    expect(within(screen.getByTestId('term-2')).getByText('−')).toBeTruthy()
    expect(within(screen.getByTestId('term-1')).queryByText('−')).toBeNull()
    expect(within(screen.getByTestId('term-1')).queryByText('+')).toBeNull()
    expect(within(screen.getByTestId('term-1')).queryByText('＋')).toBeNull()
  })

  // Review focus: VoiceOver reads the column as one sentence, signs and all.
  it('is one accessible element read as the sentence', () => {
    render(<TermColumn terms={TERMS} label={LABEL} />)
    const column = screen.getByTestId('prompt')
    expect(column.props.accessible).toBe(true)
    expect(column.props.accessibilityLabel).toBe(LABEL)
  })

  it('highlights the number being worked, and nothing without one', () => {
    const { rerender } = render(<TermColumn terms={TERMS} label={LABEL} />)
    expect(styleOf(2, '23').color).not.toBe(colors.accent)
    rerender(<TermColumn terms={TERMS} label={LABEL} activeTerm={2} />)
    expect(styleOf(2, '23').color).toBe(colors.accent)
    expect(styleOf(2, '−').color).toBe(colors.accent)
    expect(styleOf(1, '30').color).not.toBe(colors.accent)
  })

  it('uses the prompt size, and a smaller one on a short window', () => {
    windowOf(402, 874)
    const { unmount } = render(<TermColumn terms={TERMS} label={LABEL} />)
    expect(styleOf(0, '47').fontSize).toBe(COLUMN_FONT_SIZE)
    unmount()
    windowOf(375, 667)
    render(<TermColumn terms={TERMS} label={LABEL} />)
    expect(styleOf(0, '47').fontSize).toBe(COLUMN_SHORT_FONT_SIZE)
  })
})
