import { CLASS_TARGET_MS, latencyTargetMs, MAX_TARGET_MS, MIN_TARGET_MS, TARGET_MARGIN } from './fluency'

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
