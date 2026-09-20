import { fireEvent, render } from '@testing-library/react-native'
import type { SessionItem, SessionPlan } from '@/domain/session'
import { SessionRunner } from './SessionRunner'

function item(atomId: string, overrides: Partial<SessionItem> = {}): SessionItem {
  return { atomId, fade: 0, coaching: 'demo', ...overrides }
}

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

function answer(getByTestId: ReturnType<typeof render>['getByTestId'], value: string) {
  fireEvent.changeText(getByTestId('answer-input'), value)
  fireEvent.press(getByTestId('submit'))
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
    const clock = manualClock(0)
    const { getByTestId, onAttempt } = renderRunner(basicPlan, clock.now)
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

  it('cycles items within a block while time remains', () => {
    const { getByTestId, onAttempt } = renderRunner(basicPlan, autoClock())
    answer(getByTestId, '7')
    answer(getByTestId, '7')
    answer(getByTestId, '7')
    const attempts = onAttempt.mock.calls.filter((call) => call[0].atomId === '3+4')
    expect(attempts).toHaveLength(3)
    expect(getByTestId('prompt')).toBeTruthy()
  })

  it('advances to the next block once its cumulative deadline passes', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'focus', seconds: 10, items: [item('3+4')] },
        { kind: 'close', seconds: 30, items: [] },
      ],
      totalSeconds: 40,
    }
    const clock = manualClock(0)
    const { getByTestId, queryByTestId, onBlockEnd } = renderRunner(plan, clock.now)

    clock.set(5_000)
    answer(getByTestId, '7')
    expect(onBlockEnd).not.toHaveBeenCalled()
    expect(getByTestId('prompt')).toBeTruthy()

    clock.set(15_000)
    answer(getByTestId, '7')
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('prompt')).toBeNull()
    expect(queryByTestId('session-summary')).not.toBeNull()
  })

  it('skips an empty block without firing onBlockEnd, and its time carries into the next block', () => {
    const plan: SessionPlan = {
      blocks: [
        { kind: 'warmup', seconds: 10, items: [] },
        { kind: 'focus', seconds: 10, items: [item('3+4')] },
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
    answer(getByTestId, '7')
    expect(onBlockEnd).not.toHaveBeenCalled()
    expect(getByTestId('prompt')).toBeTruthy()

    // Past the cumulative 20s deadline.
    clock.set(25_000)
    answer(getByTestId, '7')
    expect(onBlockEnd).toHaveBeenCalledTimes(1)
    expect(onBlockEnd).toHaveBeenCalledWith('focus')
    expect(queryByTestId('session-summary')).not.toBeNull()
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
})
