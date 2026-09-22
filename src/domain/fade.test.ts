import { answerModeForFade, coachingForFade, nextFadeLevel, visualForFade } from './fade'

describe('visualForFade', () => {
  it.each([
    [0, 'solid'],
    [1, 'solid'],
    [2, 'solid'],
    [3, 'dim'],
    [4, 'ghost'],
    [5, 'frame'],
    [6, 'hidden'],
  ] as const)('F%i renders %s', (level, expected) => {
    expect(visualForFade(level)).toBe(expected)
  })
})

describe('coachingForFade', () => {
  it.each([
    [0, 'demo'],
    [1, 'correct'],
    [2, 'silent'],
    [6, 'silent'],
  ] as const)('F%i coaches %s', (level, expected) => {
    expect(coachingForFade(level)).toBe(expected)
  })
})

describe('nextFadeLevel', () => {
  it('promotes after five consecutive correct', () => {
    expect(nextFadeLevel(2, 5, 0)).toBe(3)
  })

  it('holds below the promote streak', () => {
    expect(nextFadeLevel(2, 4, 0)).toBe(2)
  })

  it('demotes after two consecutive wrong', () => {
    expect(nextFadeLevel(4, 0, 2)).toBe(3)
  })

  it('never promotes past F6', () => {
    expect(nextFadeLevel(6, 5, 0)).toBe(6)
  })

  it('never demotes below F0', () => {
    expect(nextFadeLevel(0, 0, 2)).toBe(0)
  })
})

describe('answerModeForFade', () => {
  it('answers with the beads while they are solid', () => {
    for (const level of [0, 1, 2] as const) expect(answerModeForFade(level)).toBe('beads')
  })

  it('answers on the keypad once the beads fade', () => {
    for (const level of [3, 4, 5, 6] as const) expect(answerModeForFade(level)).toBe('keypad')
  })
})
