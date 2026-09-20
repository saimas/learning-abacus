import { atomsForStage, highestUnlockedStage, isStageUnlocked, STAGES } from './curriculum'
import { classify } from './atoms'
import { newRecord, type AtomRecord } from './fluency'

const NOW = 1_700_000_000_000

function reflexRecord(atomId: string): AtomRecord {
  return {
    ...newRecord(atomId, NOW),
    box: 5,
    fade: 4,
    recentLatencyMs: [300, 300, 300, 300, 300],
  }
}

function allReflex(stage: 1 | 2 | 3 | 4): Record<string, AtomRecord> {
  const records: Record<string, AtomRecord> = {}
  for (const atom of atomsForStage(stage)) records[atom.id] = reflexRecord(atom.id)
  return records
}

describe('STAGES', () => {
  it('covers stages 0 to 4', () => {
    expect(STAGES.map((s) => s.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('assigns every atom to exactly one stage', () => {
    const counts = new Map<string, number>()
    for (const stage of [1, 2, 3, 4] as const) {
      for (const atom of atomsForStage(stage)) {
        counts.set(atom.id, (counts.get(atom.id) ?? 0) + 1)
      }
    }
    expect(counts.size).toBe(180)
    expect([...counts.values()].every((n) => n === 1)).toBe(true)
  })

  it('puts direct atoms in stage 1', () => {
    expect(atomsForStage(1).every((a) => classify(a) === 'direct')).toBe(true)
  })
})

describe('isStageUnlocked', () => {
  it('always unlocks stages 0 and 1', () => {
    expect(isStageUnlocked({}, 900, 0)).toBe(true)
    expect(isStageUnlocked({}, 900, 1)).toBe(true)
  })

  it('locks stage 2 with no history', () => {
    expect(isStageUnlocked({}, 900, 2)).toBe(false)
  })

  it('unlocks stage 2 once stage 1 is reflex and faded', () => {
    expect(isStageUnlocked(allReflex(1), 900, 2)).toBe(true)
  })

  it('keeps stage 2 locked when stage 1 is fast but not faded', () => {
    const records = allReflex(1)
    for (const id of Object.keys(records)) {
      const record = records[id]
      if (record !== undefined) records[id] = { ...record, fade: 2 }
    }
    expect(isStageUnlocked(records, 900, 2)).toBe(false)
  })
})

describe('highestUnlockedStage', () => {
  it('is 1 for a new learner', () => {
    expect(highestUnlockedStage({}, 900)).toBe(1)
  })

  it('advances to 2 once stage 1 is mastered', () => {
    expect(highestUnlockedStage(allReflex(1), 900)).toBe(2)
  })
})
