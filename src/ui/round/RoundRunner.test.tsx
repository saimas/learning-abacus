import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, Animated, ScrollView, StyleSheet } from 'react-native'
import { problemSteps, problemTargetMs, type MitoriProblem, type Problem } from '@/domain/problem'
import { beadModeScale, FRAME_PADDING, SHORT_WINDOW_BEAD_SCALE, SHORT_WINDOW_KEYPAD_SCALE } from '@/ui/abacus/geometry'
import { OPERAND_MAX_SCALE, OPERAND_SHORT_WINDOW_SCALE } from '@/ui/multiply/OperandBoard'
import { setBeads, tintedBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { ROLL_DRIFT, ROLL_HOLD_MS, ROLL_IN_MS, ROLL_OUT_MS, RoundRunner } from './RoundRunner'

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
// the roll's fade-in starts from an effect, once the next problem is on
// screen.
function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// Spec (roll) §3: after a right answer the problem is held under its 〇,
// then rolls out and the next rolls in.
function finishRightAnswerRoll() {
  passTime(ROLL_HOLD_MS + ROLL_OUT_MS + ROLL_IN_MS + 50)
}
// After a miss's つぎへ there is no hold, only the roll.
function finishRoll() {
  passTime(ROLL_OUT_MS + ROLL_IN_MS + 50)
}

// What the rolling view shows at this moment: its problem, how faded it is,
// and how far it has drifted from its place.
function rollFrame() {
  const style = StyleSheet.flatten(screen.getByTestId('roll').props.style) as {
    opacity?: number
    transform?: Record<string, number>[]
  }
  const shift = style.transform?.find((t) => 'translateX' in t)
  return {
    prompt: screen.queryByTestId('prompt')?.props.children as string | undefined,
    opacity: style.opacity ?? 1,
    translateX: shift?.translateX ?? 0,
  }
}

// A right answer's roll, sampled every 10 ms from the end of its hold to
// just past its end.
function sampleRightAnswerRoll() {
  act(() => jest.advanceTimersByTime(ROLL_HOLD_MS))
  const frames: ReturnType<typeof rollFrame>[] = []
  for (let t = 0; t < ROLL_OUT_MS + ROLL_IN_MS + 50; t += 10) {
    act(() => jest.advanceTimersByTime(10))
    frames.push(rollFrame())
  }
  return frames
}

describe('RoundRunner', () => {
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

// Spec (見取算) §2: the problem is a column above the soroban, and stepping
// through a miss highlights the number each move belongs to.
describe('RoundRunner with 見取算', () => {
  const column: MitoriProblem = { op: 'mitori', digits: 2, terms: [47, 30, -23, 61, -19] }
  const mitoriRound: Partial<Parameters<typeof RoundRunner>[0]> = { kind: { op: 'mitori', digits: 2 }, problems: [column] }
  const lit = () =>
    [0, 1, 2, 3, 4].filter((row) => {
      const number = within(screen.getByTestId(`term-${row}`)).getByText(String(Math.abs(column.terms[row] ?? 0)))
      return StyleSheet.flatten(number.props.style).color === colors.accent
    })
  // How many bead steps the moves of number `term` take.
  const stepsOf = (term: number) =>
    problemSteps(column).reduce((n, g) => (g.kind === 'column' && g.term === term ? n + g.steps.length : n), 0)

  it('shows the column, read as one sentence, and the soroban starting at the first number', () => {
    renderRound(mitoriRound)
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、ひく23、たす61、ひく19。')
    expect(screen.getByTestId('rod-1').props.accessibilityValue.text).toBe('4')
    expect(screen.getByTestId('rod-2').props.accessibilityValue.text).toBe('7')
    expect(lit()).toEqual([])
  })

  it('takes the total on the beads', () => {
    const { onAttempt } = renderRound(mitoriRound)
    answerBeads(96)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'mitori:2', correct: true, pace: null, assisted: false })
  })

  it('highlights the number, and its line, of each move stepped through', () => {
    renderRound(mitoriRound)
    answerBeads(95)
    expect(lit()).toEqual([])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(lit()).toEqual([1])
    expect(StyleSheet.flatten(screen.getByTestId('correction-term-1-1').props.style)?.color).toBe(colors.accent)
    // Past 30's moves, onto 23's.
    for (let i = 1; i < stepsOf(1) + 1; i++) fireEvent.press(screen.getByTestId('step-next'))
    expect(lit()).toEqual([2])
    fireEvent.press(screen.getByTestId('step-restart'))
    expect(lit()).toEqual([])
  })

  // The owner (2026-09-27): it was hard to tell which clicks were −59's and
  // which +39's. A number's beads stay coloured across its rods, and its
  // heading and lines are shaded together, until the next number begins.
  it('keeps a number coloured and shaded as one, across its rods', () => {
    renderRound(mitoriRound)
    answerBeads(95)
    const tinted = () => tintedBeads(screen.getByTestId('soroban-wrap'), 3)
    const shaded = (testID: string) =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style)?.backgroundColor === colors.accentSoft
    // Into −23: its tens move (rod 1), then the first step of its ones (rod 2).
    for (let i = 0; i < stepsOf(1) + 2; i++) fireEvent.press(screen.getByTestId('step-next'))
    expect(tinted().some((bead) => bead.startsWith('1 ') && bead.endsWith(' group'))).toBe(true)
    expect(tinted().some((bead) => bead.startsWith('2 ') && bead.endsWith(' latest'))).toBe(true)
    expect([shaded('correction-heading-0'), shaded('correction-heading-1'), shaded('correction-term-2-1')]).toEqual([
      false,
      true,
      true,
    ])
  })

  it('shows the column above the keypad too', () => {
    renderRound({ ...mitoriRound, fade: 3 })
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、ひく23、たす61、ひく19。')
    expect(screen.getByTestId('term-4')).toBeTruthy()
    // Spec (見取算) §4: the column is what a keypad answer is read from, so
    // with a renderPrompt it is drawn above the soroban, as in bead mode.
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('prompt')).toBeLessThan(drawn.indexOf('abacus-frame'))
  })

  it('keeps the soroban before the text prompt in keypad mode for other problems', () => {
    renderRound({ fade: 3 })
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('abacus-frame')).toBeLessThan(drawn.indexOf('prompt'))
  })

  // Review focus: 3けた can total four digits, and the keypad must take them.
  it('takes a four-digit 3けた total on the keypad', () => {
    const { onAttempt } = renderRound({
      kind: { op: 'mitori', digits: 3 },
      problems: [{ op: 'mitori', digits: 3, terms: [999, 999, 999, -999, 999] }],
      fade: 3,
    })
    for (const digit of '2997') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ id: 'mitori:3', correct: true }))
  })

  it('draws a two-number problem’s prompt as text, with no column', () => {
    renderRound()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.queryByTestId('term-0')).toBeNull()
  })

  describe('on a short window', () => {
    let restoreWindow = () => {}
    afterEach(() => {
      restoreWindow()
      restoreWindow = () => {}
    })

    it.each([
      ['a short window', 375, 667, SHORT_WINDOW_BEAD_SCALE],
      ['a tall window', 402, 874, beadModeScale(3, 402 - 40)],
    ])('sizes the soroban for %s, as with a board', (_window, width, height, scale) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in the × test above
      const reactNative = require('react-native')
      const spy = jest
        .spyOn(reactNative, 'useWindowDimensions')
        .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
      restoreWindow = () => spy.mockRestore()
      renderRound(mitoriRound)
      const frame = within(screen.getByTestId('soroban-wrap')).getByTestId('abacus-frame')
      expect(StyleSheet.flatten(frame.props.style).padding).toBeCloseTo(FRAME_PADDING * scale)
    })

    it.each([
      ['a short window', 375, 667, SHORT_WINDOW_KEYPAD_SCALE],
      ['a tall window', 402, 874, 1],
    ])('caps the keypad soroban for %s too, so the column fits above it', (_window, width, height, scale) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in the × test above
      const reactNative = require('react-native')
      const spy = jest
        .spyOn(reactNative, 'useWindowDimensions')
        .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
      restoreWindow = () => spy.mockRestore()
      renderRound({ ...mitoriRound, fade: 3 })
      // Keypad mode's soroban is not inside soroban-wrap, and there is only
      // one soroban on screen for a 見取算 problem.
      const frame = screen.getByTestId('abacus-frame')
      expect(StyleSheet.flatten(frame.props.style).padding).toBeCloseTo(FRAME_PADDING * scale)
    })
  })
})

describe('RoundRunner rolling from problem to problem', () => {
  it('holds a right answer under its 〇, then rolls to the next problem', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    // Recorded at once; the answered problem stays, stamped, and cannot be
    // answered again.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    expect(screen.getByTestId('round-count').props.children).toBe('1 / 3')
    // Still there just before the hold ends.
    act(() => jest.advanceTimersByTime(ROLL_HOLD_MS - 50))
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('round-count').props.children).toBe('2 / 3')
    expect(screen.queryByTestId('maru')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
  })

  it('rolls to the next problem after a miss’s つぎへ', () => {
    renderRound()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  it('rolls the summary in after the last problem', () => {
    const { onFinish } = renderRound({ problems: [{ op: 'add', digits: 2, a: 23, b: 58 }] })
    answerBeads(81)
    expect(screen.queryByTestId('summary-text')).toBeNull()
    finishRightAnswerRoll()
    expect(screen.getByTestId('summary-result').props.children).toBe('1問中 1問正解')
    fireEvent.press(screen.getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  // Review focus: the next problem's clock starts when it has arrived.
  it('times the next problem from its arrival, not from the last answer', () => {
    let clock = 0
    const onAttempt = jest.fn()
    render(
      <RoundRunner
        kind={{ op: 'add', digits: 2 }}
        problems={problems}
        fade={3}
        calibrationMs={900}
        onAttempt={onAttempt}
        onFinish={jest.fn()}
        now={() => clock}
      />,
    )
    clock = 1_000
    for (const digit of '81') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    clock = 10_000
    finishRightAnswerRoll()
    clock = 12_000
    for (const digit of '100') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    // pace is latency over the problem's target, so latency = pace × target.
    // 81 took 1 000 ms from the round's start (clock 0); 100 took 2 000 ms
    // from its arrival at 10 000 — not the 11 000 since the last answer.
    const target = (a: number, b: number) => problemTargetMs({ op: 'add', digits: 2, a, b }, 900)
    expect(onAttempt.mock.calls[0][0].pace * target(23, 58)).toBeCloseTo(1_000, 5)
    expect(onAttempt.mock.calls[1][0].pace * target(46, 54)).toBeCloseTo(2_000, 5)
  })

  // Review focus: leaving mid-roll keeps the answer and fires nothing later.
  it('keeps the answer and fires nothing once unmounted mid-roll', () => {
    const { onAttempt } = renderRound()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledTimes(1)
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_HOLD_MS + ROLL_OUT_MS + ROLL_IN_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  // Spec (gentle roll, 2026-09-29): the eye is not made to chase the problem
  // across the screen (the owner: "it is too visible and makes human eye to
  // chase it so people will get tired"). It fades as it drifts a little. The
  // native driver moves it off the JS thread, so what a test sees is where
  // each half is headed and where the next problem starts from.
  it('fades as it drifts a little, never sweeping across the screen', () => {
    const timing = jest.spyOn(Animated, 'timing')
    renderRound()
    answerBeads(81)
    const frames = sampleRightAnswerRoll()
    const targets = (duration: number) =>
      timing.mock.calls
        .map(([, config]) => config)
        .filter((config) => config.duration === duration)
        .map((config) => config.toValue as number)
        .sort((a, b) => a - b)
    const out = targets(ROLL_OUT_MS)
    const into = targets(ROLL_IN_MS)
    timing.mockRestore()
    // Out: it fades to nothing as it drifts ROLL_DRIFT to the left.
    expect(out).toEqual([-ROLL_DRIFT, 0])
    // In: the next starts unseen, ROLL_DRIFT to the right, and comes back to
    // its place in full.
    expect(frames.find((f) => f.prompt === '46に54をたす。')).toEqual({
      prompt: '46に54をたす。',
      opacity: 0,
      translateX: ROLL_DRIFT,
    })
    expect(into).toEqual([0, 1])
  })

  // Seen on the simulator: fading in before the next problem was committed
  // brought the answered one back for a frame or two, half faded, drifted
  // right, before the next replaced it.
  it('starts fading the next problem in only once it is on screen', () => {
    const timing = Animated.timing
    const onScreenAsItFadesIn: (string | undefined)[] = []
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (config.duration === ROLL_IN_MS) onScreenAsItFadesIn.push(rollFrame().prompt)
      return timing(value, config)
    })
    renderRound()
    answerBeads(81)
    finishRightAnswerRoll()
    spy.mockRestore()
    expect(onScreenAsItFadesIn).toEqual(['46に54をたす。', '46に54をたす。'])
  })

  // On the native thread, so mounting the next problem as it arrives cannot
  // make it stutter. It eases away, then slows softly into place.
  it('rolls on the native driver, easing away and settling in', () => {
    const timing = jest.spyOn(Animated, 'timing')
    renderRound()
    answerBeads(81)
    finishRightAnswerRoll()
    const configs = timing.mock.calls.map(([, config]) => config)
    timing.mockRestore()
    const out = configs.filter((c) => c.duration === ROLL_OUT_MS)
    const into = configs.filter((c) => c.duration === ROLL_IN_MS)
    // The fade and the drift run together, in each half.
    expect(out).toHaveLength(2)
    expect(into).toHaveLength(2)
    for (const c of [...out, ...into]) expect(c.useNativeDriver).toBe(true)
    for (const c of out) expect(c.easing?.(0.5)).toBeLessThan(0.5)
    for (const c of into) expect(c.easing?.(0.5)).toBeGreaterThan(0.5)
  })

  it('fades in place with Reduce Motion on, and gets to the same place', async () => {
    // Once only: restoring RN's own jest mock of it would leave it returning
    // undefined for the tests after this one.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true)
    const timing = jest.spyOn(Animated, 'timing')
    renderRound()
    await act(async () => {})
    answerBeads(81)
    const frames = sampleRightAnswerRoll()
    const targets = timing.mock.calls
      .map(([, config]) => config)
      .filter((config) => config.duration === ROLL_OUT_MS || config.duration === ROLL_IN_MS)
      .map((config) => config.toValue)
    timing.mockRestore()
    // No drift at all, only the fade: the next problem starts unseen in its
    // own place.
    expect(targets.every((value) => value === 0 || value === 1)).toBe(true)
    expect(frames.find((f) => f.prompt === '46に54をたす。')).toEqual({
      prompt: '46に54をたす。',
      opacity: 0,
      translateX: 0,
    })
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })
})
