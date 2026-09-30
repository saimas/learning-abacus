import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, Animated, Dimensions, ScrollView, StyleSheet } from 'react-native'
import type { Problem } from '@/domain/problem'
import { beadModeScale, FRAME_PADDING, SHORT_WINDOW_BEAD_SCALE } from '@/ui/abacus/geometry'
import { OPERAND_MAX_SCALE, OPERAND_SHORT_WINDOW_SCALE } from '@/ui/multiply/OperandBoard'
import { setBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { ROLL_HOLD_MS, ROLL_SWIPE_MS, RoundRunner } from './RoundRunner'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problems: Problem[] = [
  { op: 'add', digits: 2, a: 23, b: 58 },
  { op: 'add', digits: 2, a: 46, b: 54 },
  { op: 'add', digits: 2, a: 10, b: 11 },
]

function renderRound(overrides: Partial<Parameters<typeof RoundRunner>[0]> = {}) {
  const onAttempt = jest.fn()
  const onFinish = jest.fn()
  let clock = 0
  render(
    <RoundRunner
      kind={{ op: 'add', digits: 2 }}
      problems={problems}
      fade={0}
      calibrationMs={900}
      onAttempt={onAttempt}
      onFinish={onFinish}
      now={() => (clock += 1_000)}
      {...overrides}
    />,
  )
  return { onAttempt, onFinish }
}

function answerBeads(value: number) {
  setBeads(screen.getByTestId, value, 3)
  fireEvent.press(screen.getByTestId('submit'))
}

// Lets `ms` pass a frame at a time, rendering after each as a phone does:
// the swipe starts from an effect, once the next problem is underneath.
function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// Spec (roll) §3: after a right answer the problem is held under its 〇,
// then its card is swiped off over the next.
function finishRightAnswerRoll() {
  passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
}
// After a miss's つぎへ there is no hold, only the swipe.
function finishRoll() {
  passTime(ROLL_SWIPE_MS + 50)
}

// Frames until the answered card is on its way off, over the next (at most
// a second of them).
function passUntilSwiping() {
  for (let frame = 0; frame < 60 && screen.queryByTestId('card-leaving') === null; frame++) passTime(16)
}

// A card's own style: how faded it is, and how far it has moved.
function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    opacity?: number
    transform?: Record<string, number>[]
  }
}
function movedBy(testID: string) {
  return styleOf(testID).transform?.find((t) => 'translateX' in t)?.translateX ?? 0
}

describe('RoundRunner', () => {
  // The owner (2026-09-30): the round shows the level it is played at.
  it.each([[0, 'レベル 0/6'], [3, 'レベル 3/6']] as const)('shows level %p in its bar', (fade, label) => {
    renderRound({ fade })
    expect(screen.getByTestId('round-level').props.children).toBe(label)
  })

  it('plays the problems in order, counting them', () => {
    renderRound()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    answerBeads(81)
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
  })

  it('records each answer against the kind, untimed on the beads', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'add:2', correct: true, pace: null, assisted: false })
  })

  // Spec (core rounds) §4–§5: 手順を見る opens the problem's steps without
  // the answer, and an answer after it is recorded as with help.
  it('records an answer after 手順を見る as with help, for that problem only', () => {
    const { onAttempt } = renderRound()
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.getByTestId('correction-column-1')).toBeTruthy()
    expect(screen.queryByTestId('correction-answer')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    answerBeads(81)
    expect(onAttempt).toHaveBeenLastCalledWith({ id: 'add:2', correct: true, pace: null, assisted: true })

    // The next problem starts afresh.
    finishRightAnswerRoll()
    answerBeads(100)
    expect(onAttempt).toHaveBeenLastCalledWith({ id: 'add:2', correct: true, pace: null, assisted: false })
  })

  it('reviews a miss, then moves on without repeating it', () => {
    renderRound()
    answerBeads(80)
    expect(screen.getByTestId('correction')).toBeTruthy()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Spec (core rounds) §3: each ▶ plays one bead move, and the line of the
  // column that move belongs to lights up (groupOfStep).
  it('steps through a missed problem, lighting the column each move belongs to', () => {
    renderRound()
    answerBeads(80)
    const count = () => screen.getByTestId('step-count').props.children
    // Tens first, then ones, as the card lists them.
    const lit = () =>
      [1, 0].filter(
        (place) =>
          StyleSheet.flatten(screen.getByTestId(`correction-column-${place}`).props.style)?.color === colors.accent,
      )
    // Open at the start, so the first ▶ plays the first move.
    expect(count()).toBe('0 / 3')
    expect(lit()).toEqual([])

    // 23 + 58: +5 on the tens rod, then the ones' 8 as +10 − 2.
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('1 / 3')
    expect(lit()).toEqual([1])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('2 / 3')
    expect(lit()).toEqual([0])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('3 / 3')
    expect(lit()).toEqual([0])

    fireEvent.press(screen.getByTestId('step-back'))
    fireEvent.press(screen.getByTestId('step-back'))
    expect(count()).toBe('1 / 3')
    expect(lit()).toEqual([1])
  })

  it('ends with the summary after the last problem', () => {
    const { onFinish } = renderRound()
    for (const answer of [81, 100, 21]) {
      answerBeads(answer)
      finishRightAnswerRoll()
    }
    expect(screen.getByTestId('summary-text').props.children).toBe('けたの練習おわり')
    expect(screen.getByTestId('summary-result').props.children).toBe('3問中 3問正解')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

// The owner's request (2026-09-23): a × problem shows its two numbers on
// beads under the product soroban, which 両落とし starts empty, and stepping
// through a miss points at the two digits of each 九九 in turn.
describe('RoundRunner with ×', () => {
  const multiply: Partial<Parameters<typeof RoundRunner>[0]> = {
    kind: { op: 'mul', digits: 2 },
    problems: [{ op: 'mul', digits: 2, a: 12, b: 34 }],
  }
  // The product soroban's rods only: the operand board has rods of its own.
  const onProduct: typeof screen.getByTestId = (id, options) =>
    within(screen.getByTestId('soroban-wrap')).getByTestId(id, options)
  const lit = (name: 'a' | 'b') =>
    [0, 1].filter((i) => within(screen.getByTestId(`operand-${name}`)).queryByTestId(`rod-highlight-${i}`) !== null)

  it('shows the two numbers under the soroban', () => {
    renderRound(multiply)
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('12 × 34')
    expect([lit('a'), lit('b')]).toEqual([[], []])
    // The owner's request (2026-09-24): 手順を見る sits where the steps
    // appear, below the board.
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('operand-board'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('submit'))
  })

  it('shows no operand board for ＋', () => {
    renderRound()
    expect(screen.queryByTestId('operand-board')).toBeNull()
  })

  it('moves the highlight to the digits of each 九九 as a miss is stepped through', () => {
    renderRound(multiply)
    setBeads(onProduct, 407, 4)
    fireEvent.press(screen.getByTestId('submit'))
    // The panel opens at the start, with no 九九 yet.
    expect([lit('a'), lit('b')]).toEqual([[], []])

    // 1 × 3: the tens of each.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    // 1 × 4: the tens of 12, the ones of 34.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [1]])
    // 2 × 3 is two bead steps (+10 − 4), and both are its.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [0]])
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [0]])
    // 2 × 4: the ones of each.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [1]])

    fireEvent.press(screen.getByTestId('step-restart'))
    expect([lit('a'), lit('b')]).toEqual([[], []])
  })

  // The owner's request (2026-09-23): the lines fill the space below ◀ ▶ in
  // bead mode, and the 九九 stepped to is scrolled into view there.
  it('scrolls the line of the 九九 stepped to into view below the controls', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    try {
      renderRound(multiply)
      setBeads(onProduct, 407, 4)
      fireEvent.press(screen.getByTestId('submit'))
      const layout = (testID: string, y: number, height: number) =>
        fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })
      // Room for the answer and three 九九 of the four.
      layout('step-lines-scroll', 0, 60)
      for (const [index, y] of [20, 38, 56, 74].entries()) layout(`correction-product-${index}`, y, 16)

      // 1 × 3 and 1 × 4 are both on show, as the start the panel opens at
      // was.
      for (let i = 0; i < 2; i++) fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).not.toHaveBeenCalled()
      // 2 × 3 reaches past the bottom, and 2 × 4 further still.
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 12, animated: true })
      fireEvent.press(screen.getByTestId('step-next'))
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 30, animated: true })
      expect(scrollTo).toHaveBeenCalledTimes(2)
    } finally {
      scrollTo.mockRestore()
    }
  })

  // A 375 × 667 phone must still show the prompt above the soroban and
  // 手順を見る below the board, so there both are drawn smaller. On a
  // tall phone neither changes. The window mock is undone after each test,
  // even one that fails, so it cannot leak into the next.
  let restoreWindow = () => {}
  afterEach(() => {
    restoreWindow()
    restoreWindow = () => {}
  })

  it.each([
    ['a short window', 375, 667, SHORT_WINDOW_BEAD_SCALE, OPERAND_SHORT_WINDOW_SCALE],
    ['a tall window', 402, 874, beadModeScale(4, 402 - 40), OPERAND_MAX_SCALE],
  ])('sizes the soroban and the board for %s', (_window, width, height, product, operands) => {
    // As in QuestionView.test.tsx: `require` reaches the module object the
    // components' own imports read from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    restoreWindow = () => spy.mockRestore()
    renderRound(multiply)
    const padding = (container: string) =>
      StyleSheet.flatten(within(screen.getByTestId(container)).getByTestId('abacus-frame').props.style).padding
    expect(padding('soroban-wrap')).toBeCloseTo(FRAME_PADDING * product)
    expect(padding('operand-a')).toBeCloseTo(FRAME_PADDING * operands)
    expect(padding('operand-b')).toBeCloseTo(FRAME_PADDING * operands)
  })
})

// Spec (division) §3: a ÷ problem shows its divisor on a board under the
// soroban, which holds the dividend, and stepping through a miss points at
// the divisor digit of each 九九 taken off.
describe('RoundRunner with ÷', () => {
  const divide: Partial<Parameters<typeof RoundRunner>[0]> = {
    kind: { op: 'div', digits: 2 },
    problems: [{ op: 'div', digits: 2, a: 1692, b: 36 }],
  }
  // The working soroban's rods only: the divisor board has rods of its own.
  const onSoroban: typeof screen.getByTestId = (id, options) =>
    within(screen.getByTestId('soroban-wrap')).getByTestId(id, options)
  const lit = () =>
    [0, 1].filter((i) => within(screen.getByTestId('operand-b')).queryByTestId(`rod-highlight-${i}`) !== null)

  it('shows the divisor under the soroban, which starts at the dividend', () => {
    renderRound(divide)
    expect(screen.getByTestId('prompt').props.children).toBe('1692を36でわる。')
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('わる数 36')
    expect(screen.queryByTestId('operand-a')).toBeNull()
    expect(lit()).toEqual([])
    expect([0, 1, 2, 3, 4].map((i) => onSoroban(`rod-${i}`).props.accessibilityValue.text).join('')).toBe('01692')
  })

  it('takes the final reading on the beads: the quotient followed by zeros', () => {
    const { onAttempt } = renderRound(divide)
    setBeads(onSoroban, 47000, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith({ id: 'div:2', correct: true, pace: null, assisted: false })
    finishRightAnswerRoll()
    expect(screen.getByTestId('summary-result').props.children).toBe('1問中 1問正解')
  })

  it('moves the highlight to the divisor digit of each 九九 as a miss is stepped through', () => {
    renderRound(divide)
    // 47 on the lowest rods is not where 商除法 leaves the quotient.
    setBeads(onSoroban, 47, 5)
    fireEvent.press(screen.getByTestId('submit'))
    // Bead mode's beads were checked against the final soroban reading
    // (spec (division) §2), so the review names that reading too, not just
    // the quotient, and then what the learner's beads read.
    expect(screen.getByTestId('correction-answer').props.children).toBe(
      'こたえは 47（そろばんは 47000）\nあなたのそろばんは 47',
    )
    expect(lit()).toEqual([])

    const total = Number(String(screen.getByTestId('step-count').props.children).split(' / ')[1])
    // What each step lights, and which line, one entry per group stepped
    // into.
    const seen: string[] = []
    for (let i = 0; i < total; i++) {
      fireEvent.press(screen.getByTestId('step-next'))
      const line = screen
        .getAllByTestId(/^correction-(quotient|subtract)-/)
        .find((node) => StyleSheet.flatten(node.props.style)?.color === colors.accent)
      const entry = `${String(line?.props.testID)} ${JSON.stringify(lit())}`
      if (seen[seen.length - 1] !== entry) seen.push(entry)
    }
    // Placing 4 and 7 lights no divisor digit; each 九九 lights its own.
    expect(seen).toEqual([
      'correction-quotient-0 []',
      'correction-subtract-1 [0]',
      'correction-subtract-2 [1]',
      'correction-quotient-3 []',
      'correction-subtract-4 [0]',
      'correction-subtract-5 [1]',
    ])
    // The last state is the final reading the beads are checked against.
    expect([0, 1, 2, 3, 4].map((i) => onSoroban(`rod-${i}`).props.accessibilityValue.text).join('')).toBe('47000')
  })

  // Spec (division) §1: beads at every size, scaled to fit, including
  // 3けた's seven rods, with the board at the × boards' size.
  let restoreWindow = () => {}
  afterEach(() => {
    restoreWindow()
    restoreWindow = () => {}
  })

})

// Spec (card swipe, 2026-09-29): the next problem is already in its place
// underneath, still, and the answered card is swiped off over it, so there
// is nothing for the eye to chase and no blank between them (the owner:
// sliding "makes human eye to chase it"; fading "is still distracting").
describe('RoundRunner swiping from problem to problem', () => {
  it('holds a right answer under its 〇, then swipes it off over the next problem', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    // Recorded at once; the answered problem stays, stamped, and cannot be
    // answered again.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    // Nothing underneath yet while the 〇 is held.
    passTime(ROLL_HOLD_MS - 50)
    expect(screen.getAllByTestId('prompt')).toHaveLength(1)
    passUntilSwiping()
    // The next problem underneath; the answered card, 〇 and all, on top of it.
    expect(screen.getAllByTestId(/^card/).map((card) => card.props.testID)).toEqual(['card', 'card-leaving'])
    expect(within(screen.getByTestId('card')).getByTestId('prompt').props.children).toBe('46に54をたす。')
    const leaving = within(screen.getByTestId('card-leaving'))
    expect(leaving.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(leaving.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.queryByTestId('maru')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
  })

  it('leaves the next problem still as the answered card swipes fully off to the left', () => {
    const timing = jest.spyOn(Animated, 'timing')
    renderRound()
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    const swipes = timing.mock.calls.map(([, config]) => config).filter((config) => config.duration === ROLL_SWIPE_MS)
    timing.mockRestore()
    // Nothing moves or fades the next problem.
    expect(styleOf('card').transform).toBeUndefined()
    expect(styleOf('card').opacity).toBeUndefined()
    // One motion only: the answered card, to past the screen's left edge, on
    // the native thread.
    expect(swipes).toHaveLength(1)
    expect(swipes[0]?.toValue).toBeLessThanOrEqual(-Dimensions.get('window').width)
    expect(swipes[0]?.useNativeDriver).toBe(true)
  })

  // The swipe must not start before the next problem is there to uncover.
  it('starts the swipe only once the next problem is underneath', () => {
    const timing = Animated.timing
    const underneathAsItStarts: unknown[] = []
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (config.duration === ROLL_SWIPE_MS) {
        underneathAsItStarts.push(within(screen.getByTestId('card')).queryByTestId('prompt')?.props.children)
      }
      return timing(value, config)
    })
    renderRound()
    answerBeads(81)
    finishRightAnswerRoll()
    spy.mockRestore()
    expect(underneathAsItStarts).toEqual(['46に54をたす。'])
  })

  // On a phone the native driver leaves the value where the swipe sent it,
  // off the screen; the next answered card must start back in its place.
  it('starts every swipe with the answered card in its place', () => {
    const timing = Animated.timing
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const animation = timing(value, config)
      return {
        ...animation,
        start: (callback) =>
          animation.start((result) => {
            if (result.finished && typeof config.toValue === 'number') (value as Animated.Value).setValue(config.toValue)
            callback?.(result)
          }),
      }
    })
    renderRound()
    answerBeads(81)
    finishRightAnswerRoll()
    answerBeads(100)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    spy.mockRestore()
    expect(within(screen.getByTestId('card-leaving')).getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(movedBy('card-leaving')).toBe(0)
  })

  it('swipes to the next problem after a miss’s つぎへ', () => {
    renderRound()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Review: on a phone a second tap can land on つぎへ before the blocker is
  // drawn, and reach it after the swipe has started. It must not stop the
  // swipe and leave the answered card over the next for good.
  it('moves on once when つぎへ is pressed again as the swipe starts', () => {
    renderRound()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    const next = screen.getByTestId('review-next')
    fireEvent.press(next)
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    fireEvent.press(next)
    passTime(2_000)
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  it('swipes the last card off over the summary, the count staying put', () => {
    const { onFinish } = renderRound({ problems: [{ op: 'add', digits: 2, a: 23, b: 58 }] })
    answerBeads(81)
    expect(screen.queryByTestId('summary-text')).toBeNull()
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    expect(within(screen.getByTestId('card')).getByTestId('summary-result').props.children).toBe('1問中 1問正解')
    expect(within(screen.getByTestId('card-leaving')).getByTestId('prompt').props.children).toBe('23に58をたす。')
    finishRoll()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(screen.getByTestId('summary-result').props.children).toBe('1問中 1問正解')
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 1')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  // The count bar stays on the summary so nothing jumps as the last card
  // goes; there, with nothing left to lose, its ✕ just finishes.
  it('lets the summary’s ✕ finish the round without asking', () => {
    const onQuit = jest.fn()
    const { onFinish } = renderRound({ problems: [{ op: 'add', digits: 2, a: 23, b: 58 }], onQuit })
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onQuit).not.toHaveBeenCalled()
  })

  // Review focus: leaving mid-roll keeps the answer and fires nothing later.
  it('keeps the answer and fires nothing once unmounted during the hold', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledTimes(1)
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('fires nothing once unmounted mid-swipe', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_SWIPE_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('fades the answered card away in place with Reduce Motion on', async () => {
    // Once only: restoring RN's own jest mock of it would leave it returning
    // undefined for the tests after this one.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true)
    // As on a phone, each value ends where it was sent.
    const timing = Animated.timing
    const swipes: { value: unknown; toValue: unknown }[] = []
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (config.duration === ROLL_SWIPE_MS) swipes.push({ value, toValue: config.toValue })
      const animation = timing(value, config)
      return {
        ...animation,
        start: (callback) =>
          animation.start((result) => {
            if (result.finished && typeof config.toValue === 'number') (value as Animated.Value).setValue(config.toValue)
            callback?.(result)
          }),
      }
    })
    // The animated opacity the leaving card is drawn with (its host view gets
    // only the number).
    const leavingOpacity = () => StyleSheet.flatten(screen.UNSAFE_getAllByProps({ testID: 'card-leaving' })[0]?.props.style).opacity
    renderRound()
    await act(async () => {})
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    // The next problem underneath, still; the answered card fading to nothing
    // and not moving.
    expect(styleOf('card').opacity).toBeUndefined()
    expect(swipes).toEqual([{ value: leavingOpacity(), toValue: 0 }])
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    // The next answered card starts fully there, not where the last fade left
    // the value.
    answerBeads(100)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    spy.mockRestore()
    expect(styleOf('card-leaving').opacity).toBe(1)
    expect(swipes).toHaveLength(2)
  })
})
