import {
  dayKey,
  DEFAULT_CALIBRATION_MS,
  emptyProgress,
  markDayPracticed,
  markLessonSeen,
  recordPracticeAttempt,
  SCHEMA_VERSION,
} from './progress'

describe('emptyProgress', () => {
  it('is stamped with the schema version', () => {
    expect(emptyProgress().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('starts with nothing practised and the default calibration', () => {
    const p = emptyProgress()
    expect(p.practices).toEqual({})
    expect(p.calibrationMs).toBe(DEFAULT_CALIBRATION_MS)
    expect(p.daysPracticed).toBe(0)
  })

  it('has done no lessons yet', () => {
    expect(emptyProgress().lessonsSeen).toEqual([])
  })
})

// Spec (howto tutorial) §4: the lessons done, each once.
describe('markLessonSeen', () => {
  it('adds a lesson once', () => {
    const once = markLessonSeen(emptyProgress(), 'add:five')
    expect(once.lessonsSeen).toEqual(['add:five'])
    expect(markLessonSeen(once, 'add:five')).toBe(once)
    expect(markLessonSeen(once, 'mul:2').lessonsSeen).toEqual(['add:five', 'mul:2'])
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

describe('recordPracticeAttempt', () => {
  it('starts a record for the kind and leaves the calibration alone', () => {
    const before = emptyProgress()
    const after = recordPracticeAttempt(before, 'add:2', false, 0.9, 0, 1_000)
    expect(after.practices['add:2']).toEqual({ fade: 0, consecutiveCorrect: 0, consecutiveWrong: 1, lastPractisedAt: 1_000 })
    expect(after.calibrationMs).toBe(before.calibrationMs)
  })

  it('starts empty', () => {
    expect(emptyProgress().practices).toEqual({})
  })
})
