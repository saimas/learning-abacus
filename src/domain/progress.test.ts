import { atomsForStage, highestUnlockedStage } from './curriculum'
import { newRecord, type AtomRecord } from './fluency'
import {
  currentStage,
  dayKey,
  DEFAULT_CALIBRATION_MS,
  emptyProgress,
  markDayPracticed,
  recordAttempt,
  SCHEMA_VERSION,
  type Progress,
} from './progress'

const NOW = 1_700_000_000_000

function reflexRecord(atomId: string): AtomRecord {
  return { ...newRecord(atomId, NOW), box: 5, fade: 4, recentLatencyMs: [300, 300, 300] }
}

// Every atom of the given stage at reflex fluency and well past F3, which is
// what isStageUnlocked asks for.
function mastered(...stages: (1 | 2 | 3 | 4)[]): Progress {
  const atoms: Record<string, AtomRecord> = {}
  for (const stage of stages) {
    for (const atom of atomsForStage(stage)) atoms[atom.id] = reflexRecord(atom.id)
  }
  return { ...emptyProgress(), atoms }
}

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

describe('recordAttempt, untimed', () => {
  it('promotes on accuracy and leaves latency and calibration untouched', () => {
    let p = emptyProgress()
    for (let i = 0; i < 5; i++) p = recordAttempt(p, '1+3', true, null, NOW)
    expect(p.atoms['1+3']?.fade).toBe(1)
    expect(p.atoms['1+3']?.recentLatencyMs).toEqual([])
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

  it('starts latched at 1', () => {
    expect(emptyProgress().highestStage).toBe(1)
  })

  it('raises the latch when a stage is genuinely unlocked', () => {
    const progress = recordAttempt(mastered(1), '1+3', true, 300, NOW)
    expect(progress.highestStage).toBe(2)
    expect(currentStage(progress)).toBe(2)
  })

  it('keeps raising it as further stages open', () => {
    const progress = recordAttempt(mastered(1, 2), '1+3', true, 300, NOW)
    expect(progress.highestStage).toBe(3)
  })

  it('does not hand back a stage when current form would re-close the gate', () => {
    // The gate asks whether 85% of the previous stage is at box >= 4 *right
    // now*, and box resets to 1 on any miss — so a bad day re-closes it. The
    // learner would watch new material appear and then vanish, which in an
    // app whose only milestone system is visible progress is how a habit ends.
    let progress = recordAttempt(mastered(1), '1+3', true, 300, NOW)
    expect(progress.highestStage).toBe(2)

    for (const atom of atomsForStage(1).slice(0, 20)) {
      progress = recordAttempt(progress, atom.id, false, 9_000, NOW)
    }

    // The gate really has re-closed: without the latch this is what the
    // learner would be given.
    expect(highestUnlockedStage(progress.atoms, progress.calibrationMs)).toBe(1)
    expect(progress.highestStage).toBe(2)
    expect(currentStage(progress)).toBe(2)
  })

  it('honours a live gate that outruns a stale latch', () => {
    // A document stored before the field existed loads with the default 1.
    // Its owner must not be dropped back to stage 1 material for the session
    // that follows, before any answer has had a chance to raise the latch.
    const stale: Progress = { ...mastered(1), highestStage: 1 }
    expect(currentStage(stale)).toBe(2)
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
