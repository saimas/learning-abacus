import {
  currentStage,
  dayKey,
  DEFAULT_CALIBRATION_MS,
  emptyProgress,
  markDayPracticed,
  recordAttempt,
  SCHEMA_VERSION,
} from './progress'

const NOW = 1_700_000_000_000

describe('emptyProgress', () => {
  it('is stamped with the schema version', () => {
    expect(emptyProgress().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('starts with no atom history and the default calibration', () => {
    const p = emptyProgress()
    expect(Object.keys(p.atoms)).toHaveLength(0)
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
    expect(p.daysPracticed).toBe(0)
  })
})

describe('recordAttempt', () => {
  it('creates a record the first time an atom is seen', () => {
    const p = recordAttempt(emptyProgress(), '1+3', true, 700, NOW)
    expect(p.atoms['1+3']?.box).toBe(2)
  })

  it('does not mutate the input', () => {
    const before = emptyProgress()
    recordAttempt(before, '1+3', true, 700, NOW)
    expect(Object.keys(before.atoms)).toHaveLength(0)
  })

  it('recalibrates once a direct atom has a full window', () => {
    let p = emptyProgress()
    for (let i = 0; i < 5; i++) p = recordAttempt(p, '1+3', true, 400, NOW)
    expect(p.calibrationMs).toBe(400)
  })

  it('leaves calibration at the default before any full window', () => {
    const p = recordAttempt(emptyProgress(), '1+3', true, 400, NOW)
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
  })
})

describe('markDayPracticed', () => {
  it('counts a new day', () => {
    const p = markDayPracticed(emptyProgress(), '2026-09-20')
    expect(p.daysPracticed).toBe(1)
    expect(p.lastSessionDay).toBe('2026-09-20')
  })

  it('is idempotent within the same day', () => {
    const once = markDayPracticed(emptyProgress(), '2026-09-20')
    expect(markDayPracticed(once, '2026-09-20').daysPracticed).toBe(1)
  })

  it('counts a gap as one day, not a broken streak', () => {
    const first = markDayPracticed(emptyProgress(), '2026-09-01')
    expect(markDayPracticed(first, '2026-09-20').daysPracticed).toBe(2)
  })
})

describe('currentStage', () => {
  it('is 1 for a new learner', () => {
    expect(currentStage(emptyProgress())).toBe(1)
  })
})

describe('dayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(dayKey(Date.UTC(2026, 8, 20, 12))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  describe('in a UTC+9 timezone', () => {
    const originalTz = process.env.TZ

    beforeAll(() => {
      process.env.TZ = 'Asia/Tokyo'
    })

    afterAll(() => {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    })

    it('uses the local calendar day, not the UTC day', () => {
      // 2026-09-20T23:30Z is still 2026-09-20 in UTC, but already 2026-09-21 in Tokyo.
      expect(dayKey(Date.UTC(2026, 8, 20, 23, 30))).toBe('2026-09-21')
    })
  })
})
