import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import type { SessionItem, SessionPlan } from '@/domain/session'
import { SessionRunner } from './SessionRunner'
import { setBeads } from './testing'

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

  it('names the problem a correction belongs to, since it shows under the next one', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 120, items: [item('3+4'), item('2+3')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 150,
    }
    const { getByTestId } = renderRunner(plan, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    expect(getByTestId('correction-problem').props.children).toBe('3に4をたす。')
    expect(getByTestId('correction-answer').props.children).toBe('こたえは 7')
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
    expect(getByTestId('correction-coaching').props.children).toContain('+5 − 1')
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
      clock.set((i + 1) * 100)
      answer(getByTestId, '0')
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
    expect(onAttempt).toHaveBeenCalledWith({ atomId: '3+4', correct: true, latencyMs: null })
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

  it('still names the previous problem after a wrong bead answer', () => {
    const { getByTestId } = renderRunner(twoItems, autoClock())
    answer(getByTestId, '9')
    expect(getByTestId('correction-problem').props.children).toBe('3に4をたす。')
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
// the fix's exact rules (see submit() in SessionRunner.tsx).
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
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
    answerCorrectly(getByTestId) // 2+3 right -> queue is just the 3+4 retry
    expect(getByTestId('prompt').props.children).toBe('3に4をたす。')
    answerCorrectly(getByTestId) // 3+4 retry right -> queue drains and refills
    expect(getByTestId('prompt').props.children).toBe('2に3をたす。')
  })
})
