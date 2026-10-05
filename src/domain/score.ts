import type { FadeLevel } from './fade'
import { problemTargetMs, type Problem } from './problem'

// Spec (runs) §3: what a right answer without help earns. Every factor only
// adds: being slow, like a miss, costs nothing but the bonus.

// The time targets were built for typed answers, and tapping beads is
// slower: an answer within its target × this earns the whole speed bonus.
// Tuned on the owner's phone after the first runs.
export const BEAD_SPEED_FACTOR = 2

// 10 points per second of the problem's time target, so every kind earns
// about the same per minute: 1けた ＋ is no way to farm points, and a slow
// 3けた ÷ is not punished.
export function basePoints(problem: Problem, calibrationMs: number): number {
  return Math.round(problemTargetMs(problem, calibrationMs) / 100)
}

// The biggest lever: the beads fading is what the app trains.
export function levelFactor(level: FadeLevel): number {
  return 1 + 0.25 * level
}

// `combo` counts the answer being scored.
export function comboFactor(combo: number): number {
  if (combo >= 20) return 3
  if (combo >= 10) return 2
  if (combo >= 5) return 1.5
  return 1
}

// ×1.5 within the bead target, ×1 at twice it or slower, sliding between.
export function speedFactor(answerMs: number, targetMs: number): number {
  const t = answerMs / (targetMs * BEAD_SPEED_FACTOR)
  if (t <= 1) return 1.5
  if (t >= 2) return 1
  return 1.5 - 0.5 * (t - 1)
}

export type ScoredAnswer = {
  problem: Problem
  calibrationMs: number
  level: FadeLevel
  combo: number
  answerMs: number
}

export function answerPoints({ problem, calibrationMs, level, combo, answerMs }: ScoredAnswer): number {
  const targetMs = problemTargetMs(problem, calibrationMs)
  return Math.round(
    basePoints(problem, calibrationMs) * levelFactor(level) * comboFactor(combo) * speedFactor(answerMs, targetMs),
  )
}
