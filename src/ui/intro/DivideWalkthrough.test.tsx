import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native'
import { divisionWalk, walkFrames } from '@/domain/divisionWalk'
import type { Problem } from '@/domain/problem'
import { ja, type WalkCaption } from '@/i18n/ja'
import { beadModeScale, geometryFor } from '@/ui/abacus/geometry'
import { textOf, tintedBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { DivideWalkthrough } from './DivideWalkthrough'

// The owner's example (2026-09-24), as /divide-intro sets it up, in the
// default locale: 14 steps, 23 frames.
const PROBLEM: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }
const WALK = divisionWalk(PROBLEM)

// Step k's words in the default locale. src/i18n/divideWalk.test.ts pins
// the wording itself; here it only has to be the step's own.
function caption(k: number): WalkCaption {
  const step = WALK[k]
  if (step === undefined) throw new Error(`no step ${k}`)
  return ja.divideWalk(PROBLEM, step)
}

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
// The rows over and under the soroban are hidden from VoiceOver (each rod
// reads its own value), so they are found past that.
const hidden = { includeHiddenElements: true }
const rowText = (testID: string) => textOf(screen.getByTestId(testID, hidden))
const rowStyle = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style)
// The digits over the rods, from the left.
const readings = () => [0, 1, 2, 3, 4].map((i) => rowText(`walk-reading-${i}`)).join(' ')
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
    expect(text('walk-what')).toBe(caption(0).what)
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
    expect(text('walk-note')).toBe(caption(0).note)
  })

  it('guesses by 九九 with the divisor’s first digit, underlined in the problem', () => {
    renderWalk()
    toFrame(2)
    expect(text('walk-math')).toBe(caption(1).math)
    expect(style('walk-divisor-1')).toMatchObject({ color: colors.accent, textDecorationLine: 'underline' })
    expect(style('walk-divisor-0')?.color).not.toBe(colors.accent)
    expect(style('walk-divisor-0')?.textDecorationLine).toBeUndefined()
    // 169 tens: the rods it sits on are the ones it divides.
    const accented = [0, 1, 2, 3, 4].filter((i) => rowStyle(`walk-reading-${i}`)?.color === colors.accent)
    expect(accented).toEqual([1, 2, 3])
    expect(rowStyle('walk-reading-0')?.color).toBe(colors.ink)
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
    expect(rowText('walk-mark-0')).toBe('5?')
    expect(rowText('walk-reading-0')).toBe('5')
    expect(tintedRods()).toEqual(['0'])
  })

  // The owner chose one bead step per ▶ (2026-09-24): the caption stays
  // while the step's beads move one at a time.
  it('takes 50×30 off one bead step per ▶, the caption staying', () => {
    renderWalk()
    toFrame(4)
    expect(text('walk-what')).toBe(caption(3).what)
    expect(rowText('walk-reading-1')).toBe('0')
    expect(rowText('walk-reading-2')).toBe('6')
    expect(rowText('walk-mark-1')).toBe('−1')
    expect(rowText('walk-mark-2')).toBe('−5')
    expect(tintedRods()).toEqual(['1'])
    // のこり does not run ahead of the beads: it changes when the step's
    // last bead lands, so with only the 1 off it still reads 1692.
    expect(text('walk-left')).toBe('1692')
    next()
    expect(text('walk-count')).toBe('5 / 23')
    expect(text('walk-what')).toBe(caption(3).what)
    expect(rowText('walk-reading-2')).toBe('1')
    expect(rods()).toBe('5 0 1 9 2')
    expect(text('walk-left')).toBe('192')
    expect(rowText('walk-mark-1')).toBe('−1')
    expect(rowText('walk-mark-2')).toBe('−5')
    expect(tintedRods()).toEqual(['1', '2'])
    expect(text('walk-rods')).toBe(caption(3).rods)
  })

  it('gets stuck on 50×6, in the accent', () => {
    renderWalk()
    toFrame(6)
    expect(text('walk-what')).toBe(caption(4).what)
    expect(text('walk-math')).toBe(caption(4).math)
    expect(style('walk-math')?.color).toBe(colors.accent)
    expect(rowText('walk-mark-2')).toBe('−3?')
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
    expect(text('walk-what')).toBe(caption(5).what)
    expect(text('walk-left')).toBe('492')
    expect(text('walk-answer-0')).toBe('4?')
    expect(readings()).toBe('4 0 4 9 2')
    expect(rods()).toBe('4 0 4 9 2')
    expect(rowText('walk-mark-0')).toBe('−1')
    expect(rowText('walk-mark-2')).toBe('+3')
  })

  // のこり and the answer boxes never run ahead of the beads: they change
  // when the step's last bead lands.
  it('keeps のこり and the answer as they were until the fix’s last bead lands', () => {
    renderWalk()
    toFrame(7)
    expect(rods()).toBe('0 0 1 9 2')
    expect(text('walk-left')).toBe('192')
    expect(text('walk-answer-0')).toBe('5?')
    next()
    expect(rods()).toBe('4 0 1 9 2')
    expect(text('walk-left')).toBe('192')
    expect(text('walk-answer-0')).toBe('5?')
    next()
    expect(rods()).toBe('4 0 4 9 2')
    expect(text('walk-left')).toBe('492')
    expect(text('walk-answer-0')).toBe('4?')
  })

  // The same rule on a take and a try: the 4 settles as the last 九九's
  // second bead lands, and a two-bead 8 shows once both are on.
  it('settles an answer box only when the step’s last bead lands', () => {
    renderWalk()
    toFrame(10)
    expect(text('walk-answer-0')).toBe('4?')
    expect(style('walk-answer-0')?.borderColor).toBe(colors.accent)
    expect(screen.getByTestId('walk-answers').props.accessibilityLabel).toBe('答え 4?')
    next()
    expect(text('walk-answer-0')).toBe('4')
    expect(style('walk-answer-0')?.borderColor).toBe(colors.ink)
    expect(screen.getByTestId('walk-answers').props.accessibilityLabel).toBe('答え 4')
    // Frame 13 is the try of 8's first bead (+5), frame 14 its second (+3).
    forward(2)
    expect(rods()).toBe('4 5 2 5 2')
    expect(text('walk-answer-1')).toBe('')
    next()
    expect(rods()).toBe('4 8 2 5 2')
    expect(text('walk-answer-1')).toBe('8?')
  })

  it('goes back across a step with ◀', () => {
    renderWalk()
    toFrame(7)
    expect(text('walk-what')).toBe(caption(5).what)
    back()
    expect(text('walk-count')).toBe('6 / 23')
    expect(text('walk-what')).toBe(caption(4).what)
    expect(rods()).toBe('5 0 1 9 2')
  })

  it('settles the 4 once its last 九九 comes off, in green', () => {
    renderWalk()
    toFrame(11)
    expect(text('walk-answer-0')).toBe('4')
    expect(style('walk-answer-0')?.borderColor).toBe(colors.ink)
    expect(text('walk-math')).toBe(caption(6).math)
    expect(style('walk-math')?.color).toBe(colors.ok)
  })

  // The colour comes from the step: green for the 九九 that settles a digit,
  // the accent for one that will not come off, and ink for the rest of the
  // working.
  it('colours each step’s sum by what the step is', () => {
    renderWalk()
    const name = (colour: unknown) =>
      colour === colors.ok ? 'ok' : colour === colors.accent ? 'accent' : colour === colors.ink ? 'ink' : '?'
    const byStep = new Map<number, string>()
    walkFrames(WALK).frames.forEach((frame, i) => {
      if (i > 0) next()
      byStep.set(frame.step, screen.queryByTestId('walk-math') === null ? '-' : name(style('walk-math')?.color))
    })
    expect([...byStep.values()]).toEqual([
      '-', // set
      'ink', // guess 16÷3
      '-', // try 5
      'ink', // take 50×30
      'accent', // stuck on 50×6
      'ink', // fix 5 → 4
      'ok', // take 40×6, the 4's last
      'ink', // guess 25÷3
      '-', // try 8
      'ink', // take 8×30
      'accent', // stuck on 8×6
      'ink', // fix 8 → 7
      'ok', // take 7×6, the 7's last
      'ink', // done
    ])
  })

  it('reads 47 off the left at the end, and finishes', () => {
    const onFinish = renderWalk()
    toFrame(23)
    expect(text('walk-count')).toBe('23 / 23')
    expect(text('walk-what')).toBe(caption(13).what)
    expect(screen.queryByTestId('walk-next')).toBeNull()
    expect(text('walk-answer-0')).toBe('4')
    expect(text('walk-answer-1')).toBe('7')
    expect(rods()).toBe('4 7 0 0 0')
    expect(screen.getByText('はじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  // A stuck step's dot is a ring whether reached or not, so the two places a
  // guess turns out too big stay in sight among the reached dots.
  it('has a dot per step, reached ones filled and the stuck ones always a ring', () => {
    renderWalk()
    expect(screen.getAllByTestId(/^walk-dot-/)).toHaveLength(14)
    const dots = Array.from({ length: 14 }, (_, i) => i)
    const fill = (i: number) => style(`walk-dot-${i}`)?.backgroundColor
    const ringed = () => dots.filter((i) => style(`walk-dot-${i}`)?.borderColor === colors.accent)
    const filled = () => dots.filter((i) => fill(i) === colors.accent)
    expect(ringed()).toEqual([4, 10])
    expect(style('walk-dot-4')).toMatchObject({ borderWidth: 1.5, backgroundColor: colors.accentSoft })
    expect(filled()).toEqual([0])
    // Frame 5 is step 3's second bead step.
    toFrame(5)
    expect(filled()).toEqual([0, 1, 2, 3])
    // Frame 6 is the stuck step itself, and frame 7 the fix after it.
    next()
    expect(fill(4)).toBe(colors.accentSoft)
    next()
    expect(filled()).toEqual([0, 1, 2, 3, 5])
    expect(fill(4)).toBe(colors.accentSoft)
    expect(ringed()).toEqual([4, 10])
  })

  it('names the rods under the soroban', () => {
    renderWalk()
    expect([0, 1, 2, 3, 4].map((i) => rowText(`walk-rod-name-${i}`))).toEqual(['万', '千', '百', '十', '一'])
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
      expect(rowStyle(row)).toMatchObject({ alignSelf: 'center', flexDirection: 'row' })
      expect(rowStyle(row)?.paddingHorizontal).toBeCloseTo(g.framePadding + g.deckPadding)
      expect(rowStyle(`${row}-cell-2`)?.width).toBeCloseTo(g.rodWidth)
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
    // The words and the sum as the catalogue joins them (a step without a
    // sum is its words alone).
    const spoken = (k: number) => ja.divideWalkSpoken(caption(k).what, caption(k).math)
    next()
    expect(announce).toHaveBeenLastCalledWith(spoken(1))
    next()
    expect(announce).toHaveBeenLastCalledWith(spoken(2))
    next()
    expect(announce).toHaveBeenLastCalledWith(spoken(3))
    next()
    expect(announce).toHaveBeenLastCalledWith('5 / 23')
    back()
    expect(announce).toHaveBeenLastCalledWith('4 / 23')
    back()
    expect(announce).toHaveBeenLastCalledWith(spoken(2))
    expect(announce).toHaveBeenCalledTimes(6)
    announce.mockRestore()
  })

  // Each rod of the soroban reads out its own value and the words carry the
  // step's numbers, so the rows over and under it would only add stops.
  it('hides the readings, their badges and the rod names from VoiceOver', () => {
    renderWalk()
    toFrame(3)
    for (const testID of ['walk-readings', 'walk-reading-0', 'walk-mark-0', 'walk-rod-names', 'walk-rod-name-0']) {
      expect(screen.queryByTestId(testID)).toBeNull()
      expect(screen.getByTestId(testID, hidden)).toBeTruthy()
    }
    for (const row of ['walk-readings', 'walk-rod-names']) {
      expect(screen.getByTestId(row, hidden).props).toMatchObject({
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      })
    }
  })

  // A learner who scrolled down to a long note sees the next step from its
  // top; the same step's beads leave the scroll where it is.
  it('scrolls back to the top on a new step, and only then', () => {
    // The preset's ScrollView mock shares one scrollTo among its instances;
    // spyOn reuses it with the calls of the tests before.
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    scrollTo.mockClear()
    renderWalk()
    expect(scrollTo).not.toHaveBeenCalled()
    next()
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: false })
    // Frame 4 opens the first 九九 (a new step), frame 5 is its second bead.
    forward(2)
    expect(scrollTo).toHaveBeenCalledTimes(3)
    next()
    expect(scrollTo).toHaveBeenCalledTimes(3)
    back()
    back()
    expect(scrollTo).toHaveBeenCalledTimes(4)
    scrollTo.mockRestore()
  })
})
