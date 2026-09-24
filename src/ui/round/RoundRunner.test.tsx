import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { ScrollView, StyleSheet } from 'react-native'
import type { Problem } from '@/domain/problem'
import { beadModeScale, FRAME_PADDING, SHORT_WINDOW_BEAD_SCALE } from '@/ui/abacus/geometry'
import { OPERAND_MAX_SCALE, OPERAND_SHORT_WINDOW_SCALE } from '@/ui/multiply/OperandBoard'
import { setBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { RoundRunner } from './RoundRunner'

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

describe('RoundRunner', () => {
  it('plays the problems in order, counting them', () => {
    renderRound()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    answerBeads(81)
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
    answerBeads(100)
    expect(onAttempt).toHaveBeenLastCalledWith({ id: 'add:2', correct: true, pace: null, assisted: false })
  })

  it('records a keypad answer’s pace against the problem’s target', () => {
    const { onAttempt } = renderRound({ fade: 3 })
    for (const digit of '81') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    const pace = onAttempt.mock.calls[0][0].pace
    expect(pace).toBeGreaterThan(0)
    expect(pace).toBeLessThan(1)
  })

  it('reviews a miss, then moves on without repeating it', () => {
    renderRound()
    answerBeads(80)
    expect(screen.getByTestId('correction')).toBeTruthy()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
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
    answerBeads(81)
    answerBeads(100)
    answerBeads(21)
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
    expect(screen.getByTestId('summary-result').props.children).toBe('1問中 1問正解')
  })

  it('takes the quotient on the keypad', () => {
    const { onAttempt } = renderRound({ ...divide, fade: 3 })
    for (const digit of '47') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ id: 'div:2', correct: true }))
  })

  // A keypad answer is checked against the quotient alone, so its review
  // must read exactly as it always has, with no beads reading appended.
  it('leaves the keypad review’s answer line to the quotient alone', () => {
    renderRound({ ...divide, fade: 3 })
    for (const digit of '48') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    fireEvent.press(screen.getByTestId('review-show'))
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47')
  })

  it('moves the highlight to the divisor digit of each 九九 as a miss is stepped through', () => {
    renderRound(divide)
    // 47 on the lowest rods is not where 商除法 leaves the quotient.
    setBeads(onSoroban, 47, 5)
    fireEvent.press(screen.getByTestId('submit'))
    // Bead mode's beads were checked against the final soroban reading
    // (spec (division) §2), so the review names that reading too, not just
    // the quotient.
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47（そろばんは 47000）')
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

  it.each([
    ['a short window', 375, 667, OPERAND_SHORT_WINDOW_SCALE],
    ['a tall window', 402, 874, OPERAND_MAX_SCALE],
  ])('fits a 3けた problem’s seven rods and the board to %s', (_window, width, height, board) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in the × test above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    restoreWindow = () => spy.mockRestore()
    renderRound({ kind: { op: 'div', digits: 3 }, problems: [{ op: 'div', digits: 3, a: 202032, b: 976 }] })
    const padding = (container: string) =>
      StyleSheet.flatten(within(screen.getByTestId(container)).getByTestId('abacus-frame').props.style).padding
    expect(onSoroban('rod-6')).toBeTruthy()
    expect(padding('soroban-wrap')).toBeCloseTo(FRAME_PADDING * beadModeScale(7, width - 40))
    expect(padding('operand-b')).toBeCloseTo(FRAME_PADDING * board)
  })
})
