import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import type { Problem } from '@/domain/problem'
import { ja } from '@/i18n/ja'
import { tintedBeads } from '@/ui/session/testing'
import { REPLAY_STEP_MS } from '@/ui/session/useMoveReplay'
import { MethodIntro, type IntroTexts } from './MethodIntro'

// The two walkthroughs, as their routes set them up (app/multiply-intro.tsx,
// app/divide-intro.tsx), in the default locale.
const MULTIPLY: Problem = { op: 'mul', digits: 2, a: 47, b: 36 }
const MULTIPLY_TEXTS: IntroTexts = {
  title: ja.introTitle,
  method: ja.introMethod,
  placement: ja.introPlacement,
  result: ja.introResult,
}
const DIVIDE: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }
const DIVIDE_TEXTS: IntroTexts = {
  title: ja.divideIntroTitle,
  method: ja.divideIntroMethod,
  placement: ja.divideIntroPlacement,
  result: ja.divideIntroResult,
}

function renderMultiply(finishLabel: string, onFinish: () => void) {
  return render(<MethodIntro problem={MULTIPLY} intro={MULTIPLY_TEXTS} finishLabel={finishLabel} onFinish={onFinish} />)
}

function renderDivide(finishLabel: string, onFinish: () => void) {
  return render(<MethodIntro problem={DIVIDE} intro={DIVIDE_TEXTS} finishLabel={finishLabel} onFinish={onFinish} />)
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The product soroban's rods: the operand board under it has rods of its own.
const rod = (i: number) =>
  within(screen.getByTestId('intro-soroban')).getByTestId(`rod-${i}`).props.accessibilityValue.text
const lit = (name: 'a' | 'b') =>
  [0, 1].filter((i) => within(screen.getByTestId(`operand-${name}`)).queryByTestId(`rod-highlight-${i}`) !== null)

// Plays a 九九's bead steps to the end. Each step is scheduled by the render
// that shows the one before it, so time passes a step at a time, with a
// render in between, as on a device (see useMoveReplay.test.ts).
function playOut() {
  for (let i = 0; i < 10; i++) {
    act(() => {
      jest.advanceTimersByTime(REPLAY_STEP_MS)
    })
  }
}

describe('MethodIntro for ×', () => {
  it('explains the method, then plays 47 × 36 one 九九 at a time, then gives the result', () => {
    const onFinish = jest.fn()
    renderMultiply('はじめる', onFinish)
    expect(screen.getByTestId('intro-text').props.children).toContain('両落とし')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toContain('百の位')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('4×3=12　千の位に1、百の位に2')
    playOut()
    // 1200 on four rods: 千 = 1, 百 = 2.
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '2', '0', '0'])
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
    }
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '6', '9', '2'])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('47×36 = 1692')
    expect(screen.queryByTestId('intro-next')).toBeNull()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    // A second tap while the screen is on its way out must not finish twice.
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('shows the empty soroban until the first 九九 is played', () => {
    renderMultiply('はじめる', jest.fn())
    expect([0, 1, 2, 3].map(rod)).toEqual(['0', '0', '0', '0'])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([0, 1, 2, 3].map(rod)).toEqual(['0', '0', '0', '0'])
  })

  // The owner's request (2026-09-23): the two numbers show on beads under the
  // soroban, and each 九九's page points at its two digits for the whole page.
  it('shows 47 and 36 under the soroban, pointing at the digits of each 九九', () => {
    renderMultiply('はじめる', jest.fn())
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('47 × 36')
    expect([lit('a'), lit('b')]).toEqual([[], []])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[], []])

    // 4 × 3: the tens of each, while its beads play and after.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    playOut()
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    // 4 × 6, 7 × 3, 7 × 6.
    const rest = [
      [[0], [1]],
      [[1], [0]],
      [[1], [1]],
    ]
    for (const expected of rest) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
      expect([lit('a'), lit('b')]).toEqual(expected)
    }
    // The result page points at nothing.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[], []])
  })

  // The owner's request (2026-09-23): the beads a 九九 moves are red while
  // its page is open, the latest step's the deepest, as when stepping.
  it('colours the beads of the 九九 on show, and only while its page is open', () => {
    const tinted = () => tintedBeads(screen.getByTestId('intro-soroban'), 4)
    renderMultiply('はじめる', jest.fn())
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])

    // 4×3 = 12: nothing has moved as the page opens, then 1 on the 千 rod,
    // then 2 on the 百 rod.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])
    act(() => {
      jest.advanceTimersByTime(REPLAY_STEP_MS)
    })
    expect(tinted()).toEqual(['0 earth0 latest'])
    playOut()
    // Played out, the whole 九九 stays coloured until the next page.
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '2', '0', '0'])
    expect(tinted()).toEqual(['0 earth0 group', '1 earth0 latest', '1 earth1 latest'])

    // 4×6 = 24 starts from the 4×3's beads, back in wood.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])
    playOut()
    // +2 on the 百 rod, then +4 on the 十 rod.
    expect(tinted()).toEqual([
      '1 earth2 group',
      '1 earth3 group',
      '2 earth0 latest',
      '2 earth1 latest',
      '2 earth2 latest',
      '2 earth3 latest',
    ])

    for (let i = 0; i < 2; i++) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
    }
    // The result page colours nothing.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('47×36 = 1692')
    expect(tinted()).toEqual([])
  })

  it('labels its last button as it is told', () => {
    renderMultiply('おわる', jest.fn())
    for (let i = 0; i < 6; i++) fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByText('おわる')).toBeTruthy()
  })

  it('shows the title and the problem it is given', () => {
    renderMultiply('はじめる', jest.fn())
    expect(screen.getByText('かけ算のやりかた')).toBeTruthy()
    expect(screen.getByText('47 × 36')).toBeTruthy()
  })
})

// Spec (division) §3: the same walkthrough, of 1692 ÷ 36 = 47 by 商除法.
describe('MethodIntro for ÷', () => {
  const text = () => screen.getByTestId('intro-text').props.children
  const next = () => fireEvent.press(screen.getByTestId('intro-next'))
  // 商除法 works on 2N + 1 = 5 rods: the dividend right-aligned, the
  // quotient's rods to its left.
  const rods = () => [0, 1, 2, 3, 4].map(rod)
  // The board under the soroban shows only the divisor.
  const litDivisor = () =>
    [0, 1].filter((i) => within(screen.getByTestId('operand-b')).queryByTestId(`rod-highlight-${i}`) !== null)
  const tinted = () => tintedBeads(screen.getByTestId('intro-soroban'), 5)
  const tintedRods = () => [...new Set(tinted().map((bead) => bead.split(' ')[0]))]

  it('explains 商除法, then plays 1692 ÷ 36 one group at a time, then gives the result', () => {
    const onFinish = jest.fn()
    renderDivide('はじめる', onFinish)
    expect(screen.getByText('わり算のやりかた')).toBeTruthy()
    expect(screen.getByText('1692 ÷ 36')).toBeTruthy()
    expect(text()).toContain('商除法')
    next()
    expect(text()).toContain('わる数以上なら頭の2つ左、小さければ1つ左')

    // Each group's page reads as its line on the answer card, and plays its
    // beads: a digit placed, then each 九九 taken off.
    const pages = [
      ['商4を立てる（16は36より小さいので、頭の1つ左）', ['4', '1', '6', '9', '2']],
      ['4×3=12　千の位から1、百の位から2を引く', ['4', '0', '4', '9', '2']],
      ['4×6=24　百の位から2、十の位から4を引く', ['4', '0', '2', '5', '2']],
      ['商7を立てる（25は36より小さいので、頭の1つ左）', ['4', '7', '2', '5', '2']],
      ['7×3=21　百の位から2、十の位から1を引く', ['4', '7', '0', '4', '2']],
      ['7×6=42　十の位から4、一の位から2を引く', ['4', '7', '0', '0', '0']],
    ] as const
    for (const [line, after] of pages) {
      next()
      expect(text()).toBe(line)
      playOut()
      expect(rods()).toEqual(after)
    }

    // The quotient is left on the soroban, followed by zeros.
    next()
    expect(text()).toBe('1692÷36 = 47')
    expect(rods()).toEqual(['4', '7', '0', '0', '0'])
    expect(screen.queryByTestId('intro-next')).toBeNull()
    expect(screen.getByText('はじめる')).toBeTruthy()
    fireEvent.press(screen.getByTestId('intro-finish'))
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  // 商除法 starts from the dividend on the soroban, not an empty one.
  it('shows the dividend on the soroban until the first group is played', () => {
    renderDivide('はじめる', jest.fn())
    expect(rods()).toEqual(['0', '1', '6', '9', '2'])
    next()
    expect(rods()).toEqual(['0', '1', '6', '9', '2'])
  })

  it('shows 36 under the soroban, pointing at the divisor digit of each 九九 taken off', () => {
    renderDivide('はじめる', jest.fn())
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('わる数 36')
    expect(screen.queryByTestId('operand-a')).toBeNull()
    expect(litDivisor()).toEqual([])
    next()
    expect(litDivisor()).toEqual([])

    // Placing a digit points at nothing; 4 × 3 and 7 × 3 at the 3, 4 × 6 and
    // 7 × 6 at the 6, while the beads play and after.
    for (const expected of [[], [0], [1], [], [0], [1]]) {
      next()
      expect(litDivisor()).toEqual(expected)
      playOut()
      expect(litDivisor()).toEqual(expected)
    }
    next()
    expect(litDivisor()).toEqual([])
  })

  it('colours the beads of the group on show, and only while its page is open', () => {
    renderDivide('はじめる', jest.fn())
    next()
    expect(tinted()).toEqual([])

    // 商4: four earth beads on the leftmost rod, in one step.
    next()
    expect(tinted()).toEqual([])
    playOut()
    expect(tinted()).toEqual(['0 earth0 latest', '0 earth1 latest', '0 earth2 latest', '0 earth3 latest'])

    // 4×3 = 12 comes off the 千 and 百 rods, and leaves the 4 in wood.
    next()
    expect(tinted()).toEqual([])
    playOut()
    expect(tintedRods()).toEqual(['1', '2'])

    // 4×6 = 24 comes off the 百 and 十 rods.
    next()
    playOut()
    expect(tintedRods()).toEqual(['2', '3'])

    // 商7 on the next rod: the heaven bead, then two earth beads, the latest
    // step's the deepest.
    next()
    playOut()
    expect(tinted()).toEqual(['1 heaven group', '1 earth0 latest', '1 earth1 latest'])

    for (let i = 0; i < 2; i++) {
      next()
      playOut()
    }
    // The result page colours nothing.
    next()
    expect(text()).toBe('1692÷36 = 47')
    expect(tinted()).toEqual([])
  })
})
