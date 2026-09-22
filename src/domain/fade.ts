export type FadeLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type FadeVisual = 'solid' | 'dim' | 'ghost' | 'frame' | 'hidden'
export type Coaching = 'demo' | 'correct' | 'silent'

export const MAX_FADE: FadeLevel = 6
export const FADE_PROMOTE_STREAK = 5
export const FADE_DEMOTE_STREAK = 2

const VISUALS: Record<FadeLevel, FadeVisual> = {
  0: 'solid',
  1: 'solid',
  2: 'solid',
  3: 'dim',
  4: 'ghost',
  5: 'frame',
  6: 'hidden',
}

export function visualForFade(level: FadeLevel): FadeVisual {
  return VISUALS[level]
}

export function coachingForFade(level: FadeLevel): Coaching {
  if (level === 0) return 'demo'
  if (level === 1) return 'correct'
  return 'silent'
}

export function nextFadeLevel(
  level: FadeLevel,
  consecutiveCorrect: number,
  consecutiveWrong: number,
): FadeLevel {
  if (consecutiveWrong >= FADE_DEMOTE_STREAK) return Math.max(0, level - 1) as FadeLevel
  if (consecutiveCorrect >= FADE_PROMOTE_STREAK) return Math.min(MAX_FADE, level + 1) as FadeLevel
  return level
}

export type AnswerMode = 'beads' | 'keypad'

// While the beads are fully drawn (F0–F2) the learner answers by moving
// them. Once they start to fade, the answer is typed from the image in the
// learner's head. This is the only place that decides.
export function answerModeForFade(level: FadeLevel): AnswerMode {
  return visualForFade(level) === 'solid' ? 'beads' : 'keypad'
}
