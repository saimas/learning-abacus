import { atomsForStage, highestUnlockedStage, isStageUnlocked } from './curriculum'
import { applyAttempt, newRecord, type AtomRecord } from './fluency'
import { currentStage, emptyProgress, recordAttempt, type Progress } from './progress'
import { selectSession } from './session'

// The fade ladder is the whole product: if an atom cannot climb it, beads
// never fade, `isReflex` is never true, the fade-rep block stays empty, stage
// 2 never unlocks and 130 of the 180 atoms are unreachable. No unit test sees
// that, because each piece behaves correctly in isolation — the failure is in
// the arithmetic between them. This file drives the real domain over a
// simulated learner to check the ladder actually moves.

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function standardNormal(rand: () => number): number {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

// Submit-to-submit latency is a near-constant input cost (read the prompt,
// type, tap) plus a lognormal arithmetic time. Modelling the two separately
// matters: the margin in `latencyTargetMs` applies to the whole measurement,
// not to the thinking alone.
const INPUT_COST_MS = 600
const SPREAD = 0.3
const ACCURACY = 0.9

function makeLearner(medianMs: number, seed: number) {
  const rand = mulberry32(seed)
  const arithmeticMedian = Math.max(1, medianMs - INPUT_COST_MS)
  return {
    latency: () => INPUT_COST_MS + arithmeticMedian * Math.exp(SPREAD * standardNormal(rand)),
    correct: () => rand() < ACCURACY,
  }
}

// Drills one atom forever, with calibration pinned at the learner's own
// median — the hardest honest case, since the target is then derived from
// exactly the distribution being measured.
function attemptsPerPromotion(medianMs: number, seed: number): number {
  const learner = makeLearner(medianMs, seed)
  let record: AtomRecord = newRecord('3+4', 0)
  let promotions = 0
  const ATTEMPTS = 20_000
  for (let i = 0; i < ATTEMPTS; i++) {
    const before = record.fade
    record = applyAttempt(record, 'direct', learner.correct(), learner.latency(), medianMs, 0)
    if (record.fade > before) promotions++
    // Re-seat at F0 on topping out so the measurement keeps sampling.
    if (record.fade === 6) record = { ...record, fade: 0 }
  }
  return promotions === 0 ? Infinity : ATTEMPTS / promotions
}

const DAY_MS = 24 * 60 * 60 * 1000

// Plays real sessions: `selectSession` picks the items, each block is spent at
// the learner's own pace, and every answer goes through `recordAttempt`.
function practise(medianMs: number, days: number, seed: number) {
  const learner = makeLearner(medianMs, seed)
  let progress: Progress = emptyProgress()
  let now = 1_700_000_000_000
  let unlockedStage2OnDay: number | null = null
  // Days on which the *live* gate read lower than the day before — a stage
  // the learner had already been given closing again under them.
  let liveRegressions = 0
  let previousLive = 1

  for (let day = 1; day <= days; day++) {
    for (const block of selectSession(progress, now).blocks) {
      if (block.kind === 'close') continue
      let spentMs = 0
      let index = 0
      while (spentMs < block.seconds * 1000) {
        const item = block.items[index % Math.max(1, block.items.length)]
        if (item === undefined) break
        const latencyMs = learner.latency()
        now += latencyMs
        spentMs += latencyMs
        progress = recordAttempt(progress, item.atomId, learner.correct(), latencyMs, now)
        index++
      }
    }
    if (unlockedStage2OnDay === null && isStageUnlocked(progress.atoms, progress.calibrationMs, 2)) {
      unlockedStage2OnDay = day
    }
    const live = highestUnlockedStage(progress.atoms, progress.calibrationMs)
    if (live < previousLive) liveRegressions++
    previousLive = live
    now += DAY_MS - (now % DAY_MS)
  }

  const fades = atomsForStage(1).map((atom) => progress.atoms[atom.id]?.fade ?? 0)
  return { progress, fades, unlockedStage2OnDay, liveRegressions }
}

describe('fade ladder progression', () => {
  // Before the margin was introduced the direct-class target reduced to the
  // learner's own median, making each attempt a coin flip and a five-long
  // streak a ~1-in-95 event; above a 2250ms median the target sat *below* the
  // median and no streak was possible at all.
  it.each([900, 2000, 4000])('promotes within a workable number of attempts at a %dms median', (medianMs) => {
    const attempts = attemptsPerPromotion(medianMs, 12_345)
    expect(attempts).toBeLessThan(40)
    // Not so loose that an atom clears all six levels in a day or two, which
    // would make F6 — "performed mentally" — mean nothing.
    expect(attempts).toBeGreaterThan(5)
  })

  it('lifts a slow learner off F0 instead of freezing them there', () => {
    // 4000ms is the median at which the old scale cap put the target *below*
    // the learner's own median: all 50 atoms sat at F0 for good, whatever
    // they did. A handful legitimately sit at F0 at any moment — newly
    // introduced, or demoted by two misses — so the check is that the
    // population is climbing, not that the level is empty.
    const { fades } = practise(4000, 60, 99)
    expect(fades).toHaveLength(50)
    expect(fades.filter((fade) => fade > 0).length).toBeGreaterThanOrEqual(45)
    // Beads actually disappearing — ghost outlines or less — is the point.
    expect(fades.filter((fade) => fade >= 4).length).toBeGreaterThanOrEqual(20)
  })

  it('carries a steady learner to mental arithmetic and unlocks the next stage', () => {
    const { fades, unlockedStage2OnDay } = practise(2000, 90, 99)
    // F6 is the anzan level: number in, answer out, no beads.
    expect(fades.filter((fade) => fade === 6).length).toBeGreaterThanOrEqual(40)
    expect(unlockedStage2OnDay).not.toBeNull()
    // Spec §6 budgets roughly three months to meet the atoms and six to nine
    // to make them reflex; stage 2 opening inside that window is the check.
    expect(unlockedStage2OnDay ?? Infinity).toBeLessThanOrEqual(90)
  })

  it('never hands back a stage the learner has already been given', () => {
    const { progress, liveRegressions } = practise(2000, 180, 99)

    // The gate is a snapshot of current form: box resets to 1 on any miss, so
    // over six months it closes again repeatedly on a learner who is plainly
    // still improving. If this ever reads 0 the test below has gone vacuous.
    expect(liveRegressions).toBeGreaterThan(0)

    // Unlatched, this learner reads stage 1 at day 180 with 49 of 50 stage 1
    // atoms at F6 — their stage 2 and 3 material would have vanished.
    expect(highestUnlockedStage(progress.atoms, progress.calibrationMs)).toBeLessThan(3)
    expect(currentStage(progress)).toBeGreaterThanOrEqual(3)
  })
})
