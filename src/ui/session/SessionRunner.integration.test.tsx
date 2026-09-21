import { fireEvent, render } from '@testing-library/react-native'
import { emptyProgress, recordAttempt, type Progress } from '@/domain/progress'
import { BLOCK_SECONDS, SESSION_SECONDS, selectSession } from '@/domain/session'
import { SessionRunner } from './SessionRunner'

// Every other runner test hands the component a hand-built SessionPlan
// literal. That is exactly why two defects survived fifteen per-task
// reviews: the plans real learners get — a warm-up with nothing due and a
// fade-rep block with nothing fluent enough to stretch — never appeared in
// any of them. These tests build a real Progress, plan from it, run the
// result, and feed every answer back through recordAttempt.

const START = 1_700_000_000_000
const PRACTICE_SECONDS = SESSION_SECONDS - BLOCK_SECONDS.close

function manualClock(start: number) {
  let value = start
  return { now: () => value, set: (next: number) => (value = next) }
}

function expectedFor(prompt: string): number {
  const match = /^(\d)(?:に|から)(\d)を(たす|ひく)。$/.exec(prompt)
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
    fireEvent.changeText(getByTestId('answer-input'), String(expectedFor(prompt)))
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
    expect(drilled.every((record) => record.fade > 0)).toBe(true)
    // Beads actually gone, not merely dimmed: this is the anzan the app exists
    // to produce, reached through the real plan and the real runner.
    expect(drilled.some((record) => record.fade >= 4)).toBe(true)
  })
})
