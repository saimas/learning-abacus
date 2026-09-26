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

function play(record: PracticeRecord, answers: [boolean, number | null][]): PracticeRecord {
  return answers.reduce((r, [correct, pace], i) => applyPracticeAttempt(r, correct, pace, i), record)
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

  it('does not count an untimed answer once the record is past the bead levels', () => {
    expect(play(at(3), [[true, null]]).consecutiveCorrect).toBe(0)
  })

  it('stamps when it was practised', () => {
    expect(applyPracticeAttempt(at(0), true, null, 42).lastPractisedAt).toBe(42)
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
