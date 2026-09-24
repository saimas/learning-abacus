import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import type { Problem } from '@/domain/problem'
import { beadModeScale, geometryFor } from '@/ui/abacus/geometry'
import { textOf, tintedBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { DivideWalkthrough } from './DivideWalkthrough'

// The owner's example (2026-09-24), as /divide-intro sets it up, in the
// default locale: 14 steps, 23 frames.
const PROBLEM: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }

function renderWalk(onFinish = jest.fn()) {
  render(<DivideWalkthrough problem={PROBLEM} finishLabel="はじめる" onFinish={onFinish} />)
  return onFinish
}

// The beads slide on a timer. Faked, as in MethodIntro's tests, so no slide
// is left running when a test ends.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const next = () => fireEvent.press(screen.getByTestId('walk-next'))
const back = () => fireEvent.press(screen.getByTestId('walk-back'))
const forward = (presses: number) => {
  for (let i = 0; i < presses; i++) next()
}
// Frame n (1-based, as the count reads it), from the first.
const toFrame = (n: number) => forward(n - 1)
const text = (testID: string) => textOf(screen.getByTestId(testID))
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style)
// The digits over the rods, from the left.
const readings = () => [0, 1, 2, 3, 4].map((i) => text(`walk-reading-${i}`)).join(' ')
// What the soroban itself reads, rod by rod.
const rods = () =>
  [0, 1, 2, 3, 4]
    .map((i) => within(screen.getByTestId('walk-soroban')).getByTestId(`rod-${i}`).props.accessibilityValue.text)
    .join(' ')
const tintedRods = () => [...new Set(tintedBeads(screen.getByTestId('walk-soroban'), 5).map((b) => b.split(' ')[0]))]

describe('DivideWalkthrough', () => {
  it('opens on 1692 set on the soroban, with nothing answered yet', () => {
    renderWalk()
    expect(screen.getByText('わり算のやりかた')).toBeTruthy()
    expect(text('walk-what')).toBe('1692をそろばんに置く')
    expect(text('walk-left')).toBe('1692')
    expect(text('walk-count')).toBe('1 / 23')
    expect(screen.getByTestId('walk-back').props.accessibilityState).toMatchObject({ disabled: true })
    expect(text('walk-answer-0')).toBe('')
    expect(text('walk-answer-1')).toBe('')
    expect(readings()).toBe('0 1 6 9 2')
    expect(rods()).toBe('0 1 6 9 2')
    // The set step has no sum and nothing on the rods to say.
    expect(screen.queryByTestId('walk-math')).toBeNull()
    expect(screen.queryByTestId('walk-rods')).toBeNull()
    expect(text('walk-note')).toContain('1692の中に36がいくつ入るか')
  })

  it('guesses by 九九 with the divisor’s first digit, underlined in the problem', () => {
    renderWalk()
    toFrame(2)
    expect(text('walk-math')).toBe('見当 16÷3 → 5')
    expect(style('walk-divisor-1')).toMatchObject({ color: colors.accent, textDecorationLine: 'underline' })
    expect(style('walk-divisor-0')?.color).not.toBe(colors.accent)
    expect(style('walk-divisor-0')?.textDecorationLine).toBeUndefined()
    // 169 tens: the rods it sits on are the ones it divides.
    const accented = [0, 1, 2, 3, 4].filter((i) => style(`walk-reading-${i}`)?.color === colors.accent)
    expect(accented).toEqual([1, 2, 3])
    expect(style('walk-reading-0')?.color).toBe(colors.ink)
    // A guess moves no beads.
    expect(rods()).toBe('0 1 6 9 2')
    expect(tintedRods()).toEqual([])
  })

  it('tries the 5 on the answer rod, on trial', () => {
    renderWalk()
    toFrame(3)
    expect(text('walk-answer-0')).toBe('5?')
    expect(style('walk-answer-0')?.borderColor).toBe(colors.accent)
    expect(text('walk-answer-1')).toBe('')
    expect(text('walk-mark-0')).toBe('5?')
    expect(text('walk-reading-0')).toBe('5')
    expect(tintedRods()).toEqual(['0'])
  })

  // The owner chose one bead step per ▶ (2026-09-24): the caption stays
  // while the step's beads move one at a time.
  it('takes 50×30 off one bead step per ▶, the caption staying', () => {
    renderWalk()
    toFrame(4)
    expect(text('walk-what')).toBe('50×30=1500を引く')
    expect(text('walk-reading-1')).toBe('0')
    expect(text('walk-reading-2')).toBe('6')
    expect(text('walk-mark-1')).toBe('−1')
    expect(text('walk-mark-2')).toBe('−5')
    expect(tintedRods()).toEqual(['1'])
    next()
    expect(text('walk-count')).toBe('5 / 23')
    expect(text('walk-what')).toBe('50×30=1500を引く')
    expect(text('walk-reading-2')).toBe('1')
    expect(rods()).toBe('5 0 1 9 2')
    expect(text('walk-mark-1')).toBe('−1')
    expect(text('walk-mark-2')).toBe('−5')
    expect(tintedRods()).toEqual(['1', '2'])
    expect(text('walk-rods')).toBe('そろばんでは：5×3=15　千の位から1、百の位から5を引く')
  })

  it('gets stuck on 50×6, in the accent', () => {
    renderWalk()
    toFrame(6)
    expect(text('walk-what')).toBe('50×6=300を引く……引けない')
    expect(text('walk-math')).toBe('192−300 ✗')
    expect(style('walk-math')?.color).toBe(colors.accent)
    expect(text('walk-mark-2')).toBe('−3?')
    expect(text('walk-answer-0')).toBe('5?')
    // The 6 is the digit that will not come off.
    expect(style('walk-divisor-0')).toMatchObject({ color: colors.accent, textDecorationLine: 'underline' })
    // A step without beads colours nothing.
    expect(tintedRods()).toEqual([])
  })

  it('fixes the 5 to a 4 and puts 300 back', () => {
    renderWalk()
    toFrame(9)
    expect(text('walk-count')).toBe('9 / 23')
    expect(text('walk-what')).toBe('戻す：5を4にして、300を足し戻す')
    expect(text('walk-left')).toBe('492')
    expect(text('walk-answer-0')).toBe('4?')
    expect(readings()).toBe('4 0 4 9 2')
    expect(rods()).toBe('4 0 4 9 2')
    expect(text('walk-mark-0')).toBe('−1')
    expect(text('walk-mark-2')).toBe('+3')
  })

  it('goes back across a step with ◀', () => {
    renderWalk()
    toFrame(7)
    expect(text('walk-what')).toBe('戻す：5を4にして、300を足し戻す')
    back()
    expect(text('walk-count')).toBe('6 / 23')
    expect(text('walk-what')).toBe('50×6=300を引く……引けない')
    expect(rods()).toBe('5 0 1 9 2')
  })

  it('settles the 4 once its last 九九 comes off, in green', () => {
    renderWalk()
    toFrame(11)
    expect(text('walk-answer-0')).toBe('4')
    expect(style('walk-answer-0')?.borderColor).toBe(colors.ink)
    expect(text('walk-math')).toBe('492−240=252 ✓')
    expect(style('walk-math')?.color).toBe(colors.ok)
  })

  it('reads 47 off the left at the end, and finishes', () => {
    const onFinish = renderWalk()
    toFrame(23)
    expect(text('walk-count')).toBe('23 / 23')
    expect(text('walk-what')).toBe('答えを読む')
    expect(screen.queryByTestId('walk-next')).toBeNull()
    expect(text('walk-answer-0')).toBe('4')
    expect(text('walk-answer-1')).toBe('7')
    expect(rods()).toBe('4 7 0 0 0')
    expect(screen.getByText('はじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('has a dot per step, reached ones filled and the stuck ones outlined', () => {
    renderWalk()
    expect(screen.getAllByTestId(/^walk-dot-/)).toHaveLength(14)
    const outlined = Array.from({ length: 14 }, (_, i) => i).filter(
      (i) => style(`walk-dot-${i}`)?.borderColor === colors.accent,
    )
    expect(outlined).toEqual([4, 10])
    const filled = () =>
      Array.from({ length: 14 }, (_, i) => i).filter((i) => style(`walk-dot-${i}`)?.backgroundColor === colors.accent)
    expect(filled()).toEqual([0])
    // Frame 5 is step 3's second bead step.
    toFrame(5)
    expect(filled()).toEqual([0, 1, 2, 3])
  })

  it('names the rods under the soroban', () => {
    renderWalk()
    expect([0, 1, 2, 3, 4].map((i) => text(`walk-rod-name-${i}`))).toEqual(['万', '千', '百', '十', '一'])
  })

  // Each reading sits over its own rod, and each name under it: the rows
  // are laid out as Abacus lays out its rods, and centred as it is.
  it('lines the readings and the names up with the rods', () => {
    renderWalk()
    // Jest's window is 750 wide, less the screen's gutters.
    const g = geometryFor(beadModeScale(5, 750 - 40))
    const frame = StyleSheet.flatten(within(screen.getByTestId('walk-soroban')).getByTestId('abacus-frame').props.style)
    expect(frame.padding).toBeCloseTo(g.framePadding)
    for (const row of ['walk-readings', 'walk-rod-names']) {
      expect(style(row)).toMatchObject({ alignSelf: 'center', flexDirection: 'row' })
      expect(style(row)?.paddingHorizontal).toBeCloseTo(g.framePadding + g.deckPadding)
      expect(style(`${row}-cell-2`)?.width).toBeCloseTo(g.rodWidth)
    }
    const rod = within(screen.getByTestId('walk-soroban')).getByTestId('rod-2')
    expect(StyleSheet.flatten(rod.props.style).width).toBeCloseTo(g.rodWidth)
  })

  it('reads the problem and the answer boxes to VoiceOver', () => {
    renderWalk()
    expect(screen.getByTestId('walk-problem').props.accessibilityLabel).toBe('1692 ÷ 36')
    toFrame(9)
    expect(screen.getByTestId('walk-answers').props.accessibilityLabel).toBe('答え 4?')
    // Frame 15, the 8's first 九九.
    forward(6)
    expect(screen.getByTestId('walk-answers').props.accessibilityLabel).toBe('答え 4 8?')
  })

  // The beads' slide is silent, so VoiceOver hears the new step's words
  // when the step changes, and just the count when only a bead moves.
  it('tells VoiceOver each new step, or the count within a step, and nothing at first', () => {
    // The preset's AccessibilityInfo is already a mock, which spyOn reuses
    // with the calls of the tests before.
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    announce.mockClear()
    renderWalk()
    expect(announce).not.toHaveBeenCalled()
    next()
    expect(announce).toHaveBeenLastCalledWith('答えの十の位：169の中に36はいくつ？、見当 16÷3 → 5')
    next()
    expect(announce).toHaveBeenLastCalledWith('5を置いてみる（50×36）')
    next()
    expect(announce).toHaveBeenLastCalledWith('50×30=1500を引く、1692−1500=192')
    next()
    expect(announce).toHaveBeenLastCalledWith('5 / 23')
    back()
    expect(announce).toHaveBeenLastCalledWith('4 / 23')
    back()
    expect(announce).toHaveBeenLastCalledWith('5を置いてみる（50×36）')
    expect(announce).toHaveBeenCalledTimes(6)
    announce.mockRestore()
  })
})
