import {
  applyPracticeAttempt,
  isPracticeRecord,
  newPracticeRecord,
  practiceStage,
  type PracticeRecord,
} from './practice'

function at(fade: PracticeRecord['fade'], overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return { ...newPracticeRecord(0), fade, ...overrides }
}

// Each answer made at the record's level as it stands.
function play(record: PracticeRecord, answers: [boolean, number | null][]): PracticeRecord {
  return answers.reduce((r, [correct, pace], i) => applyPracticeAttempt(r, correct, pace, r.fade, i), record)
}

// Every answer made at one level, as in a round, which holds its level.
function playRoundAt(record: PracticeRecord, answers: [boolean, number | null][]): PracticeRecord {
  const playedAt = record.fade
  return answers.reduce((r, [correct, pace], i) => applyPracticeAttempt(r, correct, pace, playedAt, i), record)
}

describe('applyPracticeAttempt', () => {
  it('promotes after five fast correct answers', () => {
    const record = play(at(3), Array.from({ length: 5 }, () => [true, 0.8] as [boolean, number]))
    expect(record.fade).toBe(4)
    expect(record.consecutiveCorrect).toBe(0)
  })

  it('does not count a slow correct answer toward promotion', () => {
    const record = play(at(3), [[true, 0.8], [true, 0.8], [true, 1.2], [true, 0.8], [true, 0.8]])
    expect(record.fade).toBe(3)
    expect(record.consecutiveCorrect).toBe(2)
  })

  it('demotes after two misses in a row', () => {
    expect(play(at(4), [[false, 0.5], [false, 0.5]]).fade).toBe(3)
  })

  it('counts an untimed correct answer on accuracy alone at a bead level', () => {
    expect(play(at(0), Array.from({ length: 5 }, () => [true, null] as [boolean, null])).fade).toBe(1)
  })

  // The owner (2026-09-30): every level is answered on the beads, faded or
  // not, and speed does not gate moving up.
  it('counts an untimed correct answer on accuracy alone at the faded levels too', () => {
    for (const fade of [3, 5] as const) {
      expect(play(at(fade), Array.from({ length: 5 }, () => [true, null] as [boolean, null])).fade).toBe(fade + 1)
    }
  })

  // A round holds the level it started at (app/round.tsx). Once its answers
  // move the record, the rest of the round was still played at the old
  // level, so it must not count toward the next: a perfect round at level 2
  // went on to level 4, and level 3 was never played (review, 2026-09-30).
  it('moves at most one level in a round, however many answers follow', () => {
    const right = Array.from({ length: 10 }, () => [true, null] as [boolean, null])
    const wrong = Array.from({ length: 10 }, () => [false, null] as [boolean, null])
    expect(playRoundAt(at(2), right)).toEqual(expect.objectContaining({ fade: 3, consecutiveCorrect: 0 }))
    expect(playRoundAt(at(6), wrong)).toEqual(expect.objectContaining({ fade: 5, consecutiveWrong: 0 }))
  })

  it('stamps when it was practised', () => {
    expect(applyPracticeAttempt(at(0), true, null, 0, 42).lastPractisedAt).toBe(42)
    expect(applyPracticeAttempt(at(3), true, null, 2, 43).lastPractisedAt).toBe(43)
  })
})

describe('isPracticeRecord', () => {
  it('accepts a record and rejects anything malformed', () => {
    expect(isPracticeRecord(newPracticeRecord(5))).toBe(true)
    expect(isPracticeRecord({ ...newPracticeRecord(5), fade: 9 })).toBe(false)
    expect(isPracticeRecord({ ...newPracticeRecord(5), consecutiveWrong: 'x' })).toBe(false)
    expect(isPracticeRecord(null)).toBe(false)
  })
})

describe('practiceStage', () => {
  it('names where a kind stands by its fade level', () => {
    expect(practiceStage(undefined)).toBe('unseen')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 2 })).toBe('beads')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 3 })).toBe('fading')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 6 })).toBe('mental')
  })
})
