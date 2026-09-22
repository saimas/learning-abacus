import {
  applyAttempt,
  CLASS_TARGET_MS,
  isReflex,
  latencyTargetMs,
  MAX_TARGET_MS,
  medianLatencyMs,
  MIN_TARGET_MS,
  newRecord,
  TARGET_MARGIN,
} from './fluency'
import type { AtomRecord } from './fluency'

const NOW = 1_700_000_000_000

function recordWith(latencies: number[], box: number) {
  return { ...newRecord('3+4', NOW), recentLatencyMs: latencies, box }
}

describe('medianLatencyMs', () => {
  it('is null before any attempt', () => {
    expect(medianLatencyMs(newRecord('3+4', NOW))).toBeNull()
  })

  it('takes the middle of an odd-length window', () => {
    expect(medianLatencyMs(recordWith([500, 900, 1500], 1))).toBe(900)
  })
})

describe('latencyTargetMs', () => {
  it('is the class target plus the margin when calibration matches the direct baseline', () => {
    expect(latencyTargetMs('five', CLASS_TARGET_MS.direct)).toBe(CLASS_TARGET_MS.five * TARGET_MARGIN)
  })

  it('scales up for a slower learner', () => {
    expect(latencyTargetMs('direct', 1800)).toBe(1800 * TARGET_MARGIN)
  })

  // The gate is "median under target". If the target were ever pinned at or
  // below the learner's own median, beating it would be a coin flip at best
  // and five in a row would be unreachable, so the ladder would never move.
  it.each([900, 1800, 2500, 4000, 6000])('leaves room above a %dms median', (calibrationMs) => {
    expect(latencyTargetMs('direct', calibrationMs)).toBeGreaterThan(calibrationMs)
  })

  // MIN_SCALE binds first at every current class target, so this floor is a
  // backstop rather than the usual binding constraint — it exists so that a
  // future, faster class target cannot drive the gate towards zero.
  it.each(['direct', 'five', 'ten', 'both'] as const)('never puts the %s target below the floor', (cls) => {
    expect(latencyTargetMs(cls, 0)).toBeGreaterThanOrEqual(MIN_TARGET_MS)
  })

  it('clamps runaway calibration in absolute milliseconds', () => {
    expect(latencyTargetMs('direct', 90_000)).toBe(MAX_TARGET_MS)
  })
})

describe('isReflex', () => {
  it('requires both box and speed', () => {
    expect(isReflex(recordWith([400, 500, 600, 500, 400], 4), 'direct', 900)).toBe(true)
  })

  it('rejects a fast atom in a low box', () => {
    expect(isReflex(recordWith([400, 500, 600, 500, 400], 2), 'direct', 900)).toBe(false)
  })

  it('rejects a high-box atom that is still slow', () => {
    expect(isReflex(recordWith([3000, 3200, 3100, 3000, 3300], 5), 'direct', 900)).toBe(false)
  })

  it('rejects an atom with too few timings to judge', () => {
    expect(isReflex(recordWith([400], 5), 'direct', 900)).toBe(false)
  })
})

describe('applyAttempt', () => {
  it('promotes the box and schedules further out on success', () => {
    const next = applyAttempt(newRecord('3+4', NOW), 'direct', true, 600, CLASS_TARGET_MS.direct, NOW)
    expect(next.box).toBe(2)
    expect(next.consecutiveCorrect).toBe(1)
    expect(next.dueAt).toBeGreaterThan(NOW)
  })

  it('resets to box 1 on failure', () => {
    const strong = { ...newRecord('3+4', NOW), box: 5, consecutiveCorrect: 4 }
    const next = applyAttempt(strong, 'direct', false, 2500, CLASS_TARGET_MS.direct, NOW)
    expect(next.box).toBe(1)
    expect(next.consecutiveCorrect).toBe(0)
    expect(next.consecutiveWrong).toBe(1)
  })

  it('keeps only the last three latencies', () => {
    // Seeded at MAX_FADE so the promotion at five correct answers cannot fire
    // and clear the window — this test is about the slice, not about fading.
    let record: AtomRecord = { ...newRecord('3+4', NOW), fade: 6 }
    for (const ms of [100, 200, 300, 400, 500, 600]) {
      record = applyAttempt(record, 'direct', true, ms, CLASS_TARGET_MS.direct, NOW)
    }
    expect(record.recentLatencyMs).toEqual([400, 500, 600])
  })

  it('promotes fade once the streak is met', () => {
    let record = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) record = applyAttempt(record, 'direct', true, 500, CLASS_TARGET_MS.direct, NOW)
    expect(record.fade).toBe(1)
  })

  it('clears the streaks and the latency window when fade changes', () => {
    // A fade promotion makes the atom a materially different exercise, so the
    // old timings and streaks must not carry into it. This is the one test that
    // observes that reset firing.
    let record = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) record = applyAttempt(record, 'direct', true, 500, CLASS_TARGET_MS.direct, NOW)
    expect(record.fade).toBe(1)
    expect(record.recentLatencyMs).toEqual([])
    expect(record.consecutiveCorrect).toBe(0)
    expect(record.consecutiveWrong).toBe(0)
  })

  it('does not advance the fade streak on a slow correct answer', () => {
    let record = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) record = applyAttempt(record, 'direct', true, 5000, CLASS_TARGET_MS.direct, NOW)
    expect(record.fade).toBe(0)
    expect(record.consecutiveCorrect).toBe(0)
  })

  it('still advances the box on a slow correct answer', () => {
    const record = applyAttempt(newRecord('3+4', NOW), 'direct', true, 5000, CLASS_TARGET_MS.direct, NOW)
    expect(record.box).toBe(2)
  })
})

describe('untimed attempts', () => {
  it('counts an untimed correct answer toward the streak with no speed check', () => {
    const next = applyAttempt(newRecord('3+4', NOW), 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.consecutiveCorrect).toBe(1)
  })

  it('promotes the fade level after five untimed correct answers', () => {
    let record: AtomRecord = newRecord('3+4', NOW)
    for (let i = 0; i < 5; i++) {
      record = applyAttempt(record, 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    }
    expect(record.fade).toBe(1)
  })

  it('records no latency for an untimed attempt', () => {
    const before: AtomRecord = { ...newRecord('3+4', NOW), recentLatencyMs: [800, 900] }
    const next = applyAttempt(before, 'direct', true, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.recentLatencyMs).toEqual([800, 900])
  })

  it('still resets the box and counts the miss when an untimed answer is wrong', () => {
    const strong: AtomRecord = { ...newRecord('3+4', NOW), box: 4, consecutiveCorrect: 3 }
    const next = applyAttempt(strong, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    expect(next.box).toBe(1)
    expect(next.consecutiveCorrect).toBe(0)
    expect(next.consecutiveWrong).toBe(1)
  })

  it('demotes after two untimed misses in a row', () => {
    let record: AtomRecord = { ...newRecord('3+4', NOW), fade: 2 }
    record = applyAttempt(record, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    record = applyAttempt(record, 'direct', false, null, CLASS_TARGET_MS.direct, NOW)
    expect(record.fade).toBe(1)
  })
})
