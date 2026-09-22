import { fireEvent, render } from '@testing-library/react-native'
import { emptyProgress, recordAttempt, type Progress } from '@/domain/progress'
import { BLOCK_SECONDS, SESSION_SECONDS, selectSession } from '@/domain/session'
import { SessionRunner } from './SessionRunner'
import { setBeads } from './testing'

// Every other runner test hands the component a hand-built SessionPlan
// literal. That is exactly why two defects survived fifteen per-task
// reviews: the plans real learners get — a warm-up with nothing due and a
// fade-rep block with nothing fluent enough to stretch — never appeared in
// any of them. These tests build a real Progress, plan from it, run the
// result, and feed every answer back through recordAttempt.

const START = 1_700_000_000_000
const PRACTICE_SECONDS = SESSION_SECONDS - BLOCK_SECONDS.close

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

function manualClock(start: number) {
  let value = start
  return { now: () => value, set: (next: number) => (value = next) }
}

function expectedFor(prompt: string): number {
  const match = /^(\d{1,2})(?:に|から)(\d)を(たす|ひく)。$/.exec(prompt)
  if (match === null) throw new Error(`unexpected prompt: ${prompt}`)
  const [, rod, operand, verb] = match
  if (rod === undefined || operand === undefined || verb === undefined) {
    throw new Error(`unexpected prompt: ${prompt}`)
  }
  return Number(rod) + (verb === 'たす' ? 1 : -1) * Number(operand)
}

// Plays a whole session at a steady pace, always answering correctly so the
// block is never drained by the three-failure cap, and returns where the
// clock stood when practice gave way to the close screen.
function playSession(stepMs: number, maxSubmits: number) {
  let progress: Progress = emptyProgress()
  const plan = selectSession(progress, START)
  const clock = manualClock(START)
  let attempts = 0

  const { getByTestId, queryByTestId } = render(
    <SessionRunner
      plan={plan}
      onAttempt={(result) => {
        attempts++
        progress = recordAttempt(
          progress,
          result.atomId,
          result.correct,
          result.latencyMs,
          clock.now(),
        )
      }}
      onBlockEnd={() => {}}
      onFinish={() => {}}
      now={clock.now}
    />,
  )

  let elapsedMs = 0
  let submits = 0
  while (queryByTestId('session-summary') === null && submits < maxSubmits) {
    const prompt = getByTestId('prompt').props.children as string
    elapsedMs += stepMs
    clock.set(START + elapsedMs)
    const value = expectedFor(prompt)
    if (queryByTestId('key-0') !== null) {
      for (const digit of String(value)) fireEvent.press(getByTestId(`key-${digit}`))
    } else {
      // F0–F2: set the beads through each rod's VoiceOver adjust action.
      setBeads(getByTestId, value)
    }
    fireEvent.press(getByTestId('submit'))
    submits++
  }

  return {
    plan,
    progress: () => progress,
    attempts: () => attempts,
    elapsedMs,
    submits,
    queryByTestId,
    getByTestId,
  }
}

describe('selectSession composed with SessionRunner', () => {
  it('gives a first-day learner a plan whose fade-rep block is empty', () => {
    // The precondition that made the lost-budget defect bite every learner on
    // every first day, and keep biting until something is fluent enough to
    // stretch. Stated here so the tests below are not quietly vacuous.
    const plan = selectSession(emptyProgress(), START)
    const kinds = plan.blocks.map((block) => block.kind)
    expect(kinds).toEqual(['warmup', 'focus', 'faderep', 'close'])
    expect(plan.blocks[0]?.items).toHaveLength(0)
    expect(plan.blocks[1]?.items.length).toBeGreaterThan(0)
    expect(plan.blocks[2]?.items).toHaveLength(0)
    expect(plan.totalSeconds).toBe(SESSION_SECONDS)
  })

  it('still delivers the whole practice budget when warm-up and fade rep are empty', () => {
    const { elapsedMs, queryByTestId } = playSession(5_000, 200)

    expect(queryByTestId('session-summary')).not.toBeNull()
    // 255s of practice, not the 165s that stopping at focus's own cumulative
    // deadline would have given — and not more than one answer past it.
    expect(elapsedMs).toBeGreaterThanOrEqual(PRACTICE_SECONDS * 1000)
    expect(elapsedMs).toBeLessThan(PRACTICE_SECONDS * 1000 + 5_000)
  })

  it('records every answer into real progress and moves atoms up the fade ladder', () => {
    // A brisk, accurate learner. Under the old latency target this produced
    // no promotion at all: the gate was "beat your own median", so five in a
    // row was a ~1-in-95 event and the beads never faded.
    const session = playSession(800, 500)
    const progress = session.progress()
    const drilled = Object.values(progress.atoms)

    expect(drilled.length).toBeGreaterThan(0)
    // Every submit reached the domain, not just the ones at a block boundary.
    expect(session.attempts()).toBe(session.submits)
    // The two starting focus atoms are drilled from the very first answer,
    // so an accurate learner always carries them all the way to F3 (see
    // below for why F3 is the ceiling this session can reach).
    const startingAtomIds = session.plan.blocks.find((b) => b.kind === 'focus')?.items.map((i) => i.atomId) ?? []
    expect(startingAtomIds.length).toBeGreaterThan(0)
    for (const atomId of startingAtomIds) {
      expect(progress.atoms[atomId]?.fade).toBe(3)
    }
    // A first-day session no longer just cycles those two starting atoms for
    // the whole five minutes: once they are secure, the reserve brings in
    // more (see session.ts's reserve and SessionRunner's join logic), so a
    // brisk learner drills at least a third atom too.
    expect(drilled.length).toBeGreaterThan(startingAtomIds.length)
    // This session's atoms are never due, so the plan presents them all with
    // beads (fade frozen at F0 until promoted — see session.ts). Untimed bead
    // answers promote on accuracy alone through F0-F2, so every one climbs to
    // F3, but no further: past F2 an atom needs a timed answer to advance,
    // and nothing here ever produces one. A late joiner may not have had time
    // to reach F3 before the session ends, so every drilled atom lands
    // somewhere between F0 (just joined) and F3 (the ceiling), never beyond.
    for (const record of drilled) {
      expect(record.fade).toBeGreaterThanOrEqual(0)
      expect(record.fade).toBeLessThanOrEqual(3)
    }
  })
})
