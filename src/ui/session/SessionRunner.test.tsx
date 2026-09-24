import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView, StyleSheet } from 'react-native'
import type { SessionItem, SessionPlan } from '@/domain/session'
import { SessionRunner } from './SessionRunner'
import { colors } from '@/ui/theme'
import { setBeads, textOf } from './testing'

function item(atomId: string, overrides: Partial<SessionItem> = {}): SessionItem {
  return { atomId, fade: 0, coaching: 'demo', ...overrides }
}

// SessionTrack, Maru and the close screen's Seal each run a real
// Animated.timing on mount. Under real timers, its zero-delay
// requestAnimationFrame tick can fire between tests and update an
// already-rendered component outside `act(...)`, printing a warning that is
// unrelated to what any given test asserts. Fake timers keep that tick from
// firing unless a test explicitly advances the clock.
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Advances by a fixed step every call. Good enough when a test only needs
// "some positive time passed" and the block budget is generous.
function autoClock(start = 1_000, step = 500) {
  let value = start
  return () => (value += step)
}

// A clock the test sets explicitly, for asserting exact deadlines.
function manualClock(start = 0) {
  let value = start
  return { now: () => value, set: (next: number) => (value = next) }
}

function renderRunner(
  plan: SessionPlan,
  now: () => number,
  overrides: Partial<Parameters<typeof SessionRunner>[0]> = {},
) {
  const onAttempt = jest.fn()
  const onBlockEnd = jest.fn()
  const onFinish = jest.fn()
  const utils = render(
    <SessionRunner
      plan={plan}
      onAttempt={onAttempt}
      onBlockEnd={onBlockEnd}
      onFinish={onFinish}
      now={now}
      {...overrides}
    />,
  )
  return { ...utils, onAttempt, onBlockEnd, onFinish }
}

// Answers the current question the way the learner would: on the keypad at
// F3+, or by setting the beads at F0–F2. Then submits.
function answer(getByTestId: ReturnType<typeof render>['getByTestId'], value: string) {
  if (screen.queryByTestId('key-0') !== null) {
    for (const digit of value) fireEvent.press(getByTestId(`key-${digit}`))
  } else {
    setBeads(getByTestId, Number(value))
  }
  fireEvent.press(getByTestId('submit'))
}

// Reads the expected value straight off the prompt text, so a reserve test
// can answer whichever atom happens to be current without hard-coding a
// submit order the runner's cycling only happens to produce today.
function expectedFor(prompt: string): number {
  const match = /^(\d{1,2})(?:に|から)(\d)を(たす|ひく)。$/.exec(prompt)
  if (match === null) throw new Error(`unexpected prompt: ${prompt}`)
  const [, rod, operand, verb] = match
  if (rod === undefined || operand === undefined || verb === undefined) {
    throw new Error(`unexpected prompt: ${prompt}`)
  }
  return Number(rod) + (verb === 'たす' ? 1 : -1) * Number(operand)
}

function answerCorrectly(getByTestId: ReturnType<typeof render>['getByTestId']) {
  const prompt = getByTestId('prompt').props.children as string
  answer(getByTestId, String(expectedFor(prompt)))
}

// Looks at the steps with 手順を見る first, then answers correctly: an
// answer "with help" (spec (core rounds) §5).
function answerWithHelp(getByTestId: ReturnType<typeof render>['getByTestId']) {
  fireEvent.press(getByTestId('steps-open'))
  fireEvent.press(getByTestId('step-next'))
  fireEvent.press(getByTestId('steps-close'))
  answerCorrectly(getByTestId)
}

// After a miss the question stays on screen for review until つぎへ. Tests
// about what comes after a wrong answer press it, as the learner would.
function moveOn() {
  fireEvent.press(screen.getByTestId('review-next'))
}

const basicPlan: SessionPlan = {
  blocks: [
    { kind: 'focus', seconds: 120, items: [item('3+4')] },
    { kind: 'close', seconds: 30, items: [] },
  ],
  totalSeconds: 150,
}

describe('SessionRunner', () => {
  it('shows the current atom as a prompt', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    expect(getByTestId('prompt').props.children).toContain('3')
  })

  it('reports a correct attempt with the measured latency', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const clock = manualClock(0)
    const { getByTestId, onAttempt } = renderRunner(plan, clock.now)
    clock.set(3_000)
    answer(getByTestId, '7')
    expect(onAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ atomId: '3+4', correct: true, latencyMs: 3_000 }),
    )
  })

  it('reports a wrong answer as incorrect', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    answer(getByTestId, '9')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
  })

  it('shows the correction when coaching is demo', () => {
    const { getByTestId, queryByTestId } = renderRunner(basicPlan, autoClock())
    answer(getByTestId, '9')
    expect(queryByTestId('correction')).not.toBeNull()
  })

  it('keeps a missed question on screen, with its answer card, until つぎへ', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    expect(getByTestId('correction-answer').props.children).toBe('こたえは 7')
    // The card is about the question on screen, so it names no other one.
    expect(queryByTestId('correction-problem')).toBeNull()

    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(queryByTestId('correction')).toBeNull()
  })

  // A single-item block now ends the moment its one move is answered (see
  // "no block cycles a single move" below), so a next question to not-hold-up
  // needs a second item still queued behind it.
  const twoItemFocusPlan: SessionPlan = {
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }

  it('marks a correct answer without holding up the next question', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { getByTestId } = renderRunner(twoItemFocusPlan, autoClock())
    answer(getByTestId, '7')
    expect(getByTestId('maru')).toBeTruthy()
    expect(getByTestId('prompt')).toBeTruthy()
    expect(announce).toHaveBeenCalledWith('正解')
    announce.mockRestore()
  })

  it('shows no mark after a wrong answer', () => {
    const { getByTestId, queryByTestId } = renderRunner(twoItemFocusPlan, autoClock())
    answer(getByTestId, '7')
    answer(getByTestId, '9')
    expect(queryByTestId('maru')).toBeNull()
  })

  it('shows which block the learner is in', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    expect(getByTestId('block-label').props.children).toBe('集中')
  })

  it('keeps one time track across questions, so its fill never starts over', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+1')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    const track = getByTestId('track-segment-0')
    answer(getByTestId, '7')
    expect(getByTestId('prompt').props.children).toBe('2に1をたす。')
    expect(getByTestId('track-segment-0')).toBe(track)
  })

  it('offers the way out it is given', () => {
    const onQuit = jest.fn()
    const { getByTestId } = renderRunner(basicPlan, autoClock(), { onQuit })
    fireEvent.press(getByTestId('quit'))
    expect(onQuit).toHaveBeenCalledTimes(1)
  })

  it('demonstrates the move before the learner answers at F0', () => {
    // Spec §4: F0 is "app demonstrates the move". Revealing the number after
    // a miss is F1's job — at F0 the substitution has to be on screen first,
    // or the app never teaches the soroban method at all.
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    expect(getByTestId('demonstration').props.children).toBe('五の合成：4をたす = +5 − 1')
  })

  it('stops demonstrating once coaching moves to F1', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 1, coaching: 'correct' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { queryByTestId } = renderRunner(plan, autoClock())
    expect(queryByTestId('demonstration')).toBeNull()
  })

  it('corrects a wrong answer with the method, not only the number', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 1, coaching: 'correct' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('correction-answer').props.children).toContain('7')
    expect(textOf(getByTestId('correction-coaching'))).toContain('+5 − 1')
  })

  it('does not show a correction for a wrong answer at silent coaching', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 4, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(queryByTestId('correction')).toBeNull()
  })

  it('drops one fade level on a silent wrong answer at fade >= 4, revealing beads for the retry', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 4, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    const before = getByTestId('fade-layer').props.style.opacity as number
    answer(getByTestId, '9')
    moveOn()
    const after = getByTestId('fade-layer').props.style.opacity as number
    // fade 4 is 'ghost' (more transparent); dropping to fade 3 is 'dim' (more opaque).
    expect(after).toBeGreaterThan(before)
  })

  it('drops an atom after three failures and it never reappears via cycling', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 300, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 330,
    }
    const { getByTestId, queryByTestId, onAttempt } = renderRunner(plan, autoClock())

    for (let i = 0; i < 12; i++) {
      const prompt = queryByTestId('prompt')
      if (prompt === null) break
      const showsDroppedAtom = (prompt.props.children as string).includes('shows 3')
      answer(getByTestId, showsDroppedAtom ? '0' : '5')
      if (queryByTestId('review-next') !== null) moveOn()
    }

    const droppedAttempts = onAttempt.mock.calls.filter((call) => call[0].atomId === '3+4')
    expect(droppedAttempts).toHaveLength(3)
    expect(droppedAttempts.every((call) => call[0].correct === false)).toBe(true)
  })

  it('ignores a submit with an empty field instead of scoring it correct', () => {
    // Number('') is 0, so on an n−n atom an empty submit used to be marked
    // correct. It must not count as a wrong answer either — that would burn
    // one of the atom's three attempts for no answer at all.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('4-4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    fireEvent.press(getByTestId('submit'))
    expect(onAttempt).not.toHaveBeenCalled()
    expect(getByTestId('prompt').props.children).toContain('4')

    answer(getByTestId, '0')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
  })

  it('cycles items within a block while time remains', () => {
    // A block with more than one live move still refills once its queue
    // drains, for as long as time is left — only a single remaining move
    // must never be asked back-to-back (covered separately below).
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    for (let i = 0; i < 5; i++) answerCorrectly(getByTestId)
    const attempts = onAttempt.mock.calls.filter(
      (call) => call[0].atomId === '3+4' || call[0].atomId === '2+3',
    )
    expect(attempts).toHaveLength(5)
    // More answers than there are items in the block: the queue must have
    // drained and refilled at least once.
    expect(attempts.filter((call) => call[0].atomId === '3+4').length).toBeGreaterThan(1)
    expect(getByTestId('prompt')).toBeTruthy()
  })

  it('advances to the next block once its cumulative deadline passes', () => {
    // A single-item block would end on its very first correct answer (see
    // "no block cycles a single move" below), which would reach the deadline
    // this test wants to check for the wrong reason. Two items keep the
    // block open past the first answer, so the second checkpoint is the one
    // actually exercising the cumulative deadline.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 10, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 40,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    clock.set(5_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).not.toHaveBeenCalled()
    expect(getByTestId('prompt')).toBeTruthy()

    clock.set(15_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('prompt')).toBeNull()
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('skips an empty block without firing onBlockEnd, and its time carries into the next block', () => {
    // Two items in focus, not one: a single-item block would end on its
    // first correct answer regardless of the deadline (see "no block cycles
    // a single move" below), which would make the 15s checkpoint pass for
    // the wrong reason.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 10, items: [] },
        { kind: 'focus', seconds: 10, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 50,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    // warmup (10s) had no items and was skipped at mount; we land on focus directly.
    expect(getByTestId('prompt')).toBeTruthy()

    // Past what a naive per-block timer (10s counted from focus's own start)
    // would allow, but before the cumulative deadline (warmup + focus = 20s).
    clock.set(15_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).not.toHaveBeenCalled()
    expect(getByTestId('prompt')).toBeTruthy()

    // Past the cumulative 20s deadline.
    clock.set(25_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).toHaveBeenCalledTimes(1)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('inherits the budget of empty practice blocks that follow it', () => {
    // Fade rep is empty for every learner on day one, and empty blocks at the
    // *tail* are skipped by findActiveBlock — so without this their 90s is
    // simply lost and the session delivers 165s of practice instead of 255s,
    // every single day.
    // Two items in focus: a single-item block would end on its first correct
    // answer regardless of the deadline (see "no block cycles a single move"
    // below), which would make the first checkpoint pass for the wrong
    // reason.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 45, items: [] },
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'faderep', seconds: 90, items: [] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 285,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    // Past focus's own cumulative deadline (45 + 120 = 165s), but inside the
    // full practice budget the skipped fade-rep block hands it.
    clock.set(200_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).not.toHaveBeenCalled()
    expect(getByTestId('prompt')).toBeTruthy()

    // Past the whole practice budget (45 + 120 + 90 = 255s).
    clock.set(256_000)
    answerCorrectly(getByTestId)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('does not raid the budget of a following block that still has items', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4')] },
        { kind: 'faderep', seconds: 90, items: [item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 240,
    }
    const clock = manualClock(0)
    const { getByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    clock.set(121_000)
    answer(getByTestId, '7')
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(getByTestId('prompt').props.children).toContain('2')
  })

  it('reports the session result on the close screen', () => {
    // Spec §6 gives the close block "result, atoms mastered, tomorrow's
    // preview". It rendered only the words "Session complete".
    // Two items in focus: a single-item block would end on the very first
    // correct answer (see "no block cycles a single move" below), leaving no
    // block alive to take the rest of this test's answers.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 10, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 40,
    }
    const clock = manualClock(0)
    const { getByTestId } = renderRunner(plan, clock.now)

    clock.set(1_000)
    answerCorrectly(getByTestId)
    clock.set(2_000)
    answer(getByTestId, '99')
    clock.set(2_500)
    moveOn()
    clock.set(3_000)
    answerCorrectly(getByTestId)

    clock.set(11_000)
    answerCorrectly(getByTestId)

    const result = getByTestId('summary-result').props.children as string
    expect(result).toContain('4問中')
    expect(result).toContain('3問正解')
  })

  it('counts nothing when nothing was answered', () => {
    const plan: SessionPlan = {
      blocks: [{ kind: 'close', seconds: 30, items: [] }],
      totalSeconds: 30,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    expect(getByTestId('summary-result').props.children).toContain('0問中')
  })

  it('renders the close screen with both its summary and a finish button', () => {
    // Guards against a fallback branch silently taking over "session-summary"
    // (the no-close-block and empty-queue guards render that testID's
    // sibling but never a finish-button) — this asserts the legitimate close
    // path, and only it, produces both together.
    const plan: SessionPlan = {
      blocks: [{ kind: 'close', seconds: 30, items: [] }],
      totalSeconds: 30,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    expect(getByTestId('session-summary')).toBeTruthy()
    expect(getByTestId('finish-button')).toBeTruthy()
  })

  it('reaches the close summary and finishes only on acknowledgement', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 1, items: [item('3+4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 31,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onFinish } = renderRunner(plan, clock.now)

    clock.set(2_000)
    answer(getByTestId, '7')

    expect(queryByTestId('session-summary')).not.toBeNull()
    expect(onFinish).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('finish-button'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('ends a block early if every item in it fails out before the deadline', () => {
    const plan: SessionPlan = {
      // A huge budget: if the block ends here, it is because both items
      // were dropped, not because time ran out.
      blocks: [
        { kind: 'focus', seconds: 1_000, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 1_030,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    // Wrong answers to both atoms, three times each, drains the block.
    for (let i = 0; i < 6; i++) {
      clock.set((i + 1) * 1_000)
      answer(getByTestId, '0')
      clock.set((i + 1) * 1_000 + 500)
      moveOn()
    }

    expect(onBlockEnd).toHaveBeenCalledTimes(1)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('starts a borrowing subtraction at 13 and accepts 8 on the keypad', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3-5', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    expect(getByTestId('prompt').props.children).toBe('13から5をひく。')
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('1')
    answer(getByTestId, '8')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ atomId: '3-5', correct: true }))
  })
})

describe('SessionRunner answering with beads', () => {
  const twoItems: SessionPlan = {
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }

  it('shows a soroban to answer on, and no keypad, while the beads are solid', () => {
    const { getByTestId, queryByTestId } = renderRunner(basicPlan, autoClock())
    expect(queryByTestId('key-0')).toBeNull()
    expect(getByTestId('rod-1').props.accessibilityRole).toBe('adjustable')
    expect(getByTestId('reset-beads')).toBeTruthy()
  })

  it('answers on the keypad once the beads fade', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4', { fade: 3, coaching: 'silent' })] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    expect(getByTestId('key-0')).toBeTruthy()
    expect(queryByTestId('reset-beads')).toBeNull()
  })

  it('moves the beads under a tap', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    // 3 on the ones rod; a tap above the beam brings the heaven bead down.
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('8')
  })

  it('keeps こたえる disabled until a bead moves', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
    fireEvent.press(getByTestId('submit'))
    expect(onAttempt).not.toHaveBeenCalled()

    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: false })
  })

  it('puts the beads back with もどす', () => {
    const { getByTestId } = renderRunner(basicPlan, autoClock())
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    fireEvent.press(getByTestId('reset-beads'))
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('3')
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('scores the value on the beads, untimed', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    answer(getByTestId, '7')
    expect(onAttempt).toHaveBeenCalledWith({ atomId: '3+4', correct: true, latencyMs: null, assisted: false })
  })

  it('sets the beads back to the start for the next question', () => {
    const { getByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '7')
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('2')
    expect(getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('starts a borrowing subtraction at 13 and accepts 8 on the beads', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3-5')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('1')
    answer(getByTestId, '8')
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ atomId: '3-5', correct: true }))
  })

  // At a silent level the ✕ lands on the beads as the learner set them, and
  // they stay so until こたえを見る.
  it('keeps the beads as the learner set them, and locks them, while a miss is reviewed', () => {
    const silent: SessionPlan = {
      blocks: [
        {
          kind: 'focus',
          seconds: 120,
          items: [item('3+4', { fade: 2, coaching: 'silent' }), item('2+3', { fade: 2, coaching: 'silent' })],
        },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(silent, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('9')
    expect(getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    expect(queryByTestId('reset-beads')).toBeNull()
    expect(queryByTestId('submit')).toBeNull()
  })

  // Where coaching speaks, the step panel opens with the ✕, at the start of
  // the move, ready for the first ▶ (the owner, 2026-09-24). The beads take
  // no taps either way.
  it('shows the start of the move, locked, where the panel opens with the miss', () => {
    const { getByTestId, queryByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('3')
    expect(getByTestId('step-count').props.children).toBe('0 / 2')
    expect(getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    expect(queryByTestId('reset-beads')).toBeNull()
    expect(queryByTestId('submit')).toBeNull()
  })
})

describe('SessionRunner bringing in reserve atoms', () => {
  const focusPlan = (reserve?: SessionItem[]): SessionPlan => ({
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
    reserve,
  })

  it('makes the first reserve atom the very next prompt once every focus atom has five right in a row', () => {
    const plan = focusPlan([item('5+3')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const correctCount = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId && call[0].correct).length

    while (correctCount('3+4') < 5 || correctCount('2+3') < 5) answerCorrectly(getByTestId)

    expect(getByTestId('prompt').props.children).toBe('5に3をたす。')
    answerCorrectly(getByTestId)
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ atomId: '5+3', correct: true }))
  })

  it('resets a reserve atom on a wrong answer, delaying it joining', () => {
    const plan = focusPlan([item('5+3')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const correctCount = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId && call[0].correct).length

    // Run until one focus atom reaches a streak of five. The other is not
    // yet due for its own fifth — joining needs both.
    while (correctCount('3+4') < 5 && correctCount('2+3') < 5) answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')

    // Whichever atom is now current is due for its own fifth in a row.
    // Answering it wrong (99 cannot be right for either atom) resets that
    // streak instead, so the reserve atom must not join here.
    answer(getByTestId, '99')
    moveOn()
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')

    // Rebuilding the reset streak takes real work — if a wrong answer failed
    // to reset it, one more correct answer would be enough to join.
    let guard = 0
    while (getByTestId('prompt').props.children !== '5に3をたす。') {
      answerCorrectly(getByTestId)
      guard++
      if (guard > 40) throw new Error('reserve atom never joined')
    }
    expect(guard).toBeGreaterThanOrEqual(5)
  })

  // Spec (core rounds) §5: an answer after 手順を見る is not the learner's
  // own, so it counts in the tally but not toward the streak.
  it('does not count an answer after 手順を見る toward bringing in a reserve atom', () => {
    const plan = focusPlan([item('5+3')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const correctCount = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId && call[0].correct).length

    answerWithHelp(getByTestId)
    expect(onAttempt).toHaveBeenLastCalledWith({ atomId: '3+4', correct: true, latencyMs: null, assisted: true })

    // Five right each, but only four of 3+4's are the learner's own.
    while (correctCount('3+4') < 5 || correctCount('2+3') < 5) answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')

    let guard = 0
    while (getByTestId('prompt').props.children !== '5に3をたす。') {
      answerCorrectly(getByTestId)
      guard++
      if (guard > 10) throw new Error('reserve atom never joined')
    }
    expect(correctCount('3+4')).toBe(6)
  })

  it('does not break a streak with a miss after 手順を見る', () => {
    const plan = focusPlan([item('5+3')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const correctCount = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId && call[0].correct).length

    // As in the reset test above: one atom has five in a row, and the one
    // now current is due for its fifth.
    while (correctCount('3+4') < 5 && correctCount('2+3') < 5) answerCorrectly(getByTestId)
    fireEvent.press(getByTestId('steps-open'))
    fireEvent.press(getByTestId('steps-close'))
    answer(getByTestId, '99')
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ correct: false, assisted: true }))
    moveOn()

    // Its streak of four stands, so its next right answer brings in 5+3,
    // where a miss of the learner's own would have cost five more.
    let guard = 0
    while (getByTestId('prompt').props.children !== '5に3をたす。') {
      answerCorrectly(getByTestId)
      guard++
      if (guard > 40) throw new Error('reserve atom never joined')
    }
    expect(guard).toBeLessThan(5)
  })

  it('does not bring in a reserve atom on an answer after 手順を見る, even with everything else secure', () => {
    // 2+3 misses twice early on, then fails out for good once 3+4 and 6+1
    // have five in a row each. Everything left in play is then secure, so
    // the next right answer of the learner's own brings in 5+3; one given
    // with help must not.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('6+1'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
      reserve: [item('5+3')],
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const answers = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId).map((call) => call[0].correct as boolean)
    const misses = (atomId: string) => answers(atomId).filter((correct) => !correct).length
    const streak = (atomId: string) => {
      const all = answers(atomId)
      const lastMiss = all.lastIndexOf(false)
      return all.length - lastMiss - 1
    }
    const prompt = () => getByTestId('prompt').props.children as string

    let guard = 0
    while (misses('2+3') < 3) {
      if (++guard > 60) throw new Error('2+3 never failed out')
      expect(prompt()).not.toBe('5に3をたす。')
      const failNow = misses('2+3') < 2 || (streak('3+4') >= 5 && streak('6+1') >= 5)
      if (prompt() === '2に3をたす。' && failNow) {
        answer(getByTestId, '99')
        moveOn()
      } else {
        answerCorrectly(getByTestId)
      }
    }

    answerWithHelp(getByTestId)
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ correct: true, assisted: true }))
    expect(prompt()).not.toBe('5に3をたす。')
    answerCorrectly(getByTestId)
    expect(prompt()).toBe('5に3をたす。')
  })

  it('joins the reserve one atom at a time', () => {
    const plan = focusPlan([item('5+3'), item('6+2')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    const correctCount = (atomId: string) =>
      onAttempt.mock.calls.filter((call) => call[0].atomId === atomId && call[0].correct).length

    while (correctCount('3+4') < 5 || correctCount('2+3') < 5) answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).toBe('5に3をたす。')

    // The second reserve atom must not join until the first also has five in
    // a row, even though the original two are already well past five.
    let guard = 0
    while (getByTestId('prompt').props.children !== '6に2をたす。') {
      answerCorrectly(getByTestId)
      guard++
      if (guard > 60) throw new Error('second reserve atom never joined')
    }
    expect(correctCount('5+3')).toBeGreaterThanOrEqual(5)
  })

  it('never joins a reserve atom into a warm-up block', () => {
    // Warm-up makes one pass (see SessionRunner.test.tsx's "no block cycles
    // a single move" tests), so it never reaches a five-in-a-row streak to
    // begin with — its one pass through both items, and only that, is what
    // this test can check.
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
      reserve: [item('5+3')],
    }
    const { getByTestId, queryByTestId, onAttempt } = renderRunner(plan, autoClock())

    answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).not.toBe('5に3をたす。')
    answerCorrectly(getByTestId)
    expect(queryByTestId('session-summary')).not.toBeNull()

    const seenAtoms = new Set(onAttempt.mock.calls.map((call) => call[0].atomId))
    expect(seenAtoms).toEqual(new Set(['3+4', '2+3']))
  })

  it('joins no more atoms than the reserve holds', () => {
    const plan = focusPlan([item('5+3')])
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())

    for (let i = 0; i < 40; i++) answerCorrectly(getByTestId)

    const seenAtoms = new Set(onAttempt.mock.calls.map((call) => call[0].atomId))
    expect(seenAtoms).toEqual(new Set(['3+4', '2+3', '5+3']))
  })

  it('behaves exactly as before when the plan has no reserve', () => {
    const plan = focusPlan(undefined)
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())

    for (let i = 0; i < 20; i++) answerCorrectly(getByTestId)

    const seenAtoms = new Set(onAttempt.mock.calls.map((call) => call[0].atomId))
    expect(seenAtoms).toEqual(new Set(['3+4', '2+3']))
  })
})

// The TestFlight repeat bug: a block with only one live move used to refill
// its queue from that same move for the rest of its time slice, so the
// learner saw the identical question over and over. These tests pin down
// the fix's exact rules (see advance() in SessionRunner.tsx).
describe('SessionRunner never repeating one question to fill time', () => {
  it('ends warm-up after its one move instead of asking it again', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 120, items: [item('3+4')] },
        { kind: 'focus', seconds: 120, items: [item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 270,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    answerCorrectly(getByTestId)
    expect(getByTestId('block-label').props.children).toBe('集中')
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })

  it('asks each warm-up move once, in a single pass, then moves on', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 120, items: [item('3+4'), item('2+3'), item('1+4')] },
        { kind: 'focus', seconds: 120, items: [item('6+2')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 270,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    answerCorrectly(getByTestId)
    answerCorrectly(getByTestId)
    answerCorrectly(getByTestId)
    expect(getByTestId('block-label').props.children).toBe('集中')
    const warmupAtomIds = ['3+4', '2+3', '1+4']
    const warmupAttempts = onAttempt.mock.calls.filter((call) =>
      warmupAtomIds.includes(call[0].atomId as string),
    )
    expect(warmupAttempts).toHaveLength(3)
    expect(new Set(warmupAttempts.map((call) => call[0].atomId))).toEqual(new Set(warmupAtomIds))
  })

  it('still retries a missed warm-up move before the block ends', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 120, items: [item('3+4')] },
        { kind: 'focus', seconds: 120, items: [item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 270,
    }
    const { getByTestId, onAttempt } = renderRunner(plan, autoClock())
    answer(getByTestId, '9') // wrong: expected 7
    moveOn()
    expect(getByTestId('block-label').props.children).toBe('準備')
    answerCorrectly(getByTestId)
    expect(getByTestId('block-label').props.children).toBe('集中')
    const warmupAttempts = onAttempt.mock.calls.filter((call) => call[0].atomId === '3+4')
    expect(warmupAttempts).toHaveLength(2)
  })

  it('ends a single-move fade-rep block after its one pass', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'faderep', seconds: 120, items: [item('3+4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, autoClock())
    answerCorrectly(getByTestId)
    expect(onBlockEnd).toHaveBeenCalledWith('faderep')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('brings in the reserve move once a single-move focus block has nothing else to offer', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
      reserve: [item('5+3')],
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).toBe('5に3をたす。')
  })

  it('ends a single-move focus block with no reserve instead of repeating it', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, autoClock())
    answerCorrectly(getByTestId)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('does not ask the just-retried item again right after its retry (rotation)', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    answer(getByTestId, '0') // wrong: 3+4 requeued at the back -> [2+3, 3+4]
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    answerCorrectly(getByTestId) // 2+3 right -> queue is just the 3+4 retry
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    answerCorrectly(getByTestId) // 3+4 retry right -> queue drains and refills
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })
})

describe('SessionRunner and the correct-answer stamp', () => {
  it('stamps a big 〇 centred over the soroban in bead mode', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '7')
    const wrap = getByTestId('soroban-wrap')
    const maru = within(wrap).getByTestId('maru')
    const flat = StyleSheet.flatten(maru.props.style)
    expect(flat.width).toBe(140)
  })
})

// Spec (miss review) §4: a miss holds its question for review. The ✕ stamps
// over it, and つぎへ moves on. Spec (core rounds) §4: the step panel walks
// the move on the soroban, ▶ by ▶; it is open at once at F0–F1 and opens
// from こたえを見る above that.
describe('SessionRunner reviewing a miss', () => {
  const beadPlan: SessionPlan = {
    blocks: [
      { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }
  // F2: bead answers, silent coaching, so the panel waits for こたえを見る.
  const silentBeadPlan: SessionPlan = {
    blocks: [
      {
        kind: 'focus',
        seconds: 120,
        items: [item('3+4', { fade: 2, coaching: 'silent' }), item('2+3', { fade: 2, coaching: 'silent' })],
      },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }
  // F3: keypad answers, a dimmed soroban, silent coaching.
  const keypadPlan: SessionPlan = {
    blocks: [
      {
        kind: 'focus',
        seconds: 120,
        items: [item('7+8', { fade: 3, coaching: 'silent' }), item('2+3', { fade: 3, coaching: 'silent' })],
      },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 150,
  }

  // Tens then ones, as the soroban reads.
  const rods = () => [0, 1].map((index) => screen.getByTestId(`rod-${index}`).props.accessibilityValue.text).join('')
  const opacity = () => screen.getByTestId('fade-layer').props.style.opacity as number
  const highlighted = () =>
    [0, 1].filter(
      (index) => StyleSheet.flatten(screen.getByTestId(`correction-step-${index}`).props.style)?.color === colors.accent,
    )

  it('stamps a big ✕ over the soroban and offers こたえを見る and つぎへ', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { getByTestId, queryByTestId } = renderRunner(silentBeadPlan, autoClock())
    answer(getByTestId, '9')
    const batsu = within(getByTestId('soroban-wrap')).getByTestId('batsu')
    expect(StyleSheet.flatten(batsu.props.style).width).toBe(140)
    expect(queryByTestId('maru')).toBeNull()
    expect(within(getByTestId('review-show')).getByText('こたえを見る')).toBeTruthy()
    expect(within(getByTestId('review-next')).getByText('つぎへ')).toBeTruthy()
    expect(announce).toHaveBeenCalledWith('ちがいます')
    announce.mockRestore()
  })

  // At F0–F1 the panel with the answer opens by itself (no こたえを見る is
  // ever pressed), so its announcement has to ride along with the miss
  // announcement, or VoiceOver never hears the answer at all.
  it('tells VoiceOver the answer along with the miss where coaching still speaks', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { getByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    expect(announce).toHaveBeenCalledWith('ちがいます こたえは 7')
    announce.mockRestore()
  })

  it('hides the keypad while a keypad answer is reviewed', () => {
    const { getByTestId, queryByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('prompt').props.children).toBe('7に8をたす。')
    expect(queryByTestId('key-0')).toBeNull()
    expect(queryByTestId('submit')).toBeNull()
    expect(StyleSheet.flatten(getByTestId('batsu').props.style).width).toBe(110)
  })

  // In bead mode the demonstration stays under the prompt with the card up,
  // since its going would move the soroban under it (the owner,
  // 2026-09-24); keypad mode lets the card stand in for it.
  it('shows the answer card at once where coaching still speaks, under the demonstration in bead mode', () => {
    const { getByTestId } = renderRunner(beadPlan, autoClock())
    expect(getByTestId('demonstration')).toBeTruthy()
    answer(getByTestId, '9')
    expect(getByTestId('correction')).toBeTruthy()
    expect(getByTestId('demonstration')).toBeTruthy()
  })

  it('holds the card back at a silent level until こたえを見る', () => {
    const plan: SessionPlan = {
      blocks: [
        {
          kind: 'focus',
          seconds: 120,
          items: [item('3+4', { fade: 2, coaching: 'silent' }), item('2+3', { fade: 2, coaching: 'silent' })],
        },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId, queryByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(queryByTestId('correction')).toBeNull()
    fireEvent.press(getByTestId('review-show'))
    expect(getByTestId('correction-answer').props.children).toBe('こたえは 7')
  })

  it('steps the move on the soroban with ▶ and ◀, drawn solid while stepping', () => {
    const { getByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    expect(opacity()).toBe(0.35)

    // The panel opens at the start, drawn solid, the one time keypad mode
    // shows it so, and the first ▶ plays the first move (the owner,
    // 2026-09-24).
    fireEvent.press(getByTestId('review-show'))
    expect(rods()).toBe('07')
    expect(opacity()).toBe(1)
    expect(getByTestId('step-count').props.children).toBe('0 / 2')

    fireEvent.press(getByTestId('step-next'))
    expect(rods()).toBe('17')
    expect(getByTestId('step-count').props.children).toBe('1 / 2')

    fireEvent.press(getByTestId('step-next'))
    expect(rods()).toBe('15')
    expect(getByTestId('step-count').props.children).toBe('2 / 2')

    // ▶ stops at the last move, and nothing plays on by itself.
    fireEvent.press(getByTestId('step-next'))
    act(() => jest.advanceTimersByTime(5_000))
    expect(rods()).toBe('15')

    fireEvent.press(getByTestId('step-back'))
    expect(rods()).toBe('17')
    expect(getByTestId('step-count').props.children).toBe('1 / 2')
  })

  it('highlights the step just played, and goes back to the start from 最初から', () => {
    const { getByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    fireEvent.press(getByTestId('review-show'))
    expect(highlighted()).toEqual([])
    fireEvent.press(getByTestId('step-next'))
    expect(highlighted()).toEqual([0])
    fireEvent.press(getByTestId('step-next'))
    expect(highlighted()).toEqual([1])
    fireEvent.press(getByTestId('step-back'))
    expect(highlighted()).toEqual([0])

    fireEvent.press(getByTestId('step-restart'))
    expect(rods()).toBe('07')
    expect(highlighted()).toEqual([])
    expect(getByTestId('step-count').props.children).toBe('0 / 2')
  })

  it('moves on with つぎへ and brings the missed move back later in the block', () => {
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(queryByTestId('batsu')).toBeNull()
    expect(queryByTestId('review-next')).toBeNull()
    expect(getByTestId('rod-1').props.accessibilityRole).toBe('adjustable')
    answerCorrectly(getByTestId)
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
  })

  it('scores a miss once, at the answer, and not again at つぎへ', () => {
    const { getByTestId, onAttempt } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onAttempt).toHaveBeenCalledWith({ atomId: '3+4', correct: false, latencyMs: null, assisted: false })
    moveOn()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it("leaves the time spent reviewing out of the next answer's latency", () => {
    const clock = manualClock(0)
    const { getByTestId, onAttempt } = renderRunner(keypadPlan, clock.now)
    clock.set(1_000)
    answer(getByTestId, '9')
    clock.set(61_000)
    moveOn()
    clock.set(64_000)
    answer(getByTestId, '5')
    expect(onAttempt).toHaveBeenLastCalledWith({ atomId: '2+3', correct: true, latencyMs: 3_000, assisted: false })
  })

  it('ends the block at つぎへ when its time ran out during the review', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 10, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 40,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)
    clock.set(5_000)
    answer(getByTestId, '9')
    clock.set(15_000)
    expect(onBlockEnd).not.toHaveBeenCalled()
    moveOn()
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('leaves the stepping behind at つぎへ', () => {
    const { getByTestId } = renderRunner(keypadPlan, autoClock())
    answer(getByTestId, '9')
    fireEvent.press(getByTestId('review-show'))
    fireEvent.press(getByTestId('step-next'))
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(rods()).toBe('02')
    expect(opacity()).toBe(0.35)
    act(() => jest.advanceTimersByTime(3_000))
    expect(rods()).toBe('02')
  })

  it('leaves a correct answer as it was: 〇 and the next question at once', () => {
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '7')
    expect(getByTestId('maru')).toBeTruthy()
    expect(queryByTestId('batsu')).toBeNull()
    expect(queryByTestId('review-next')).toBeNull()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })

  it('ignores つぎへ in the moment after a miss, so a double tap on こたえる cannot skip the review', () => {
    const clock = manualClock(0)
    const { getByTestId, queryByTestId } = renderRunner(beadPlan, clock.now)
    clock.set(1_000)
    answer(getByTestId, '9')
    clock.set(1_200)
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    expect(queryByTestId('review-next')).not.toBeNull()
    clock.set(1_500)
    moveOn()
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })

  it('steps the move on the beads themselves in bead mode, from the start', () => {
    const { getByTestId } = renderRunner(beadPlan, autoClock())
    answer(getByTestId, '9')
    // At F0 the panel is open at once, at the start, and the first ▶ plays
    // the first move.
    expect(rods()).toBe('03')
    fireEvent.press(getByTestId('step-next'))
    expect(rods()).toBe('08')
    fireEvent.press(getByTestId('step-next'))
    expect(rods()).toBe('07')
    fireEvent.press(getByTestId('step-restart'))
    expect(rods()).toBe('03')
  })

  // The owner's request (2026-09-23): in bead mode the lines fill the space
  // below ◀ ▶, and the step on show is scrolled into view there.
  it('scrolls the line of steps into view below the controls in bead mode', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    try {
      const { getByTestId } = renderRunner(beadPlan, autoClock())
      answer(getByTestId, '9')
      const layout = (testID: string, y: number, height: number) =>
        fireEvent(getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })
      // Room for the answer alone.
      layout('step-lines-scroll', 0, 20)
      layout('correction-coaching', 24, 14)
      // Open at the start, with nothing stepped to.
      expect(scrollTo).not.toHaveBeenCalled()
      fireEvent.press(getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 18, animated: true })
    } finally {
      scrollTo.mockRestore()
    }
  })

  it('tells VoiceOver the answer when こたえを見る is pressed', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const { getByTestId } = renderRunner(silentBeadPlan, autoClock())
    answer(getByTestId, '9')
    fireEvent.press(getByTestId('review-show'))
    expect(announce).toHaveBeenLastCalledWith('こたえは 7')
    announce.mockRestore()
  })
})

// A fade-rep move leaves the rotation once it has earned its one level, so a
// long 暗算 block cannot promote its stored fade past what the learner saw.
describe('SessionRunner retiring fade-rep moves', () => {
  const fadePlan: SessionPlan = {
    blocks: [
      {
        kind: 'faderep',
        seconds: 255,
        items: [item('3+4', { fade: 3, coaching: 'silent' }), item('2+3', { fade: 3, coaching: 'silent' })],
      },
      { kind: 'close', seconds: 30, items: [] },
    ],
    totalSeconds: 285,
  }

  it('ends the block once every move has five right in a row, instead of cycling on', () => {
    const { getByTestId, queryByTestId, onAttempt, onBlockEnd } = renderRunner(fadePlan, autoClock())
    for (let i = 0; i < 9; i++) answerCorrectly(getByTestId)
    expect(queryByTestId('session-summary')).toBeNull()
    answerCorrectly(getByTestId)
    expect(onAttempt).toHaveBeenCalledTimes(10)
    expect(onBlockEnd).toHaveBeenCalledWith('faderep')
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  // Spec (core rounds) §5: an answer after 手順を見る does not count toward
  // the level a fade-rep move earns.
  it('needs five right of the learner’s own to retire a move, not counting one after 手順を見る', () => {
    const { getByTestId, queryByTestId, onAttempt } = renderRunner(fadePlan, autoClock())
    answerWithHelp(getByTestId)
    expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ atomId: '3+4', assisted: true }))
    for (let i = 0; i < 9; i++) answerCorrectly(getByTestId)
    expect(queryByTestId('session-summary')).toBeNull()
    answerCorrectly(getByTestId)
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('keeps a move in the rotation until its streak is rebuilt after a miss', () => {
    const { getByTestId, queryByTestId, onAttempt } = renderRunner(fadePlan, autoClock())
    answer(getByTestId, '9') // 3+4 wrong: its streak is 0, and it retries at the back
    moveOn()
    while (queryByTestId('session-summary') === null) answerCorrectly(getByTestId)
    const answers = (atomId: string) => onAttempt.mock.calls.filter((call) => call[0].atomId === atomId)
    expect(answers('3+4').filter((call) => call[0].correct)).toHaveLength(5)
    expect(answers('2+3')).toHaveLength(5)
  })
})
