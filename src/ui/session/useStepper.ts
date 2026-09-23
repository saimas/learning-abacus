import { useState } from 'react'
import type { Soroban } from '@/domain/soroban'

// Spec (core rounds) §3: the learner walks a move one bead step at a time,
// forward and back, at their own pace. `index` is which of `states` is on
// show: state k is the soroban after k bead moves. null means not stepping,
// so the soroban shows whatever it showed before. There are no timers: the
// beads' own slide shows each move.
export function useStepper(states: Soroban[]): {
  index: number | null
  soroban: Soroban | null
  total: number
  next: () => void
  back: () => void
  restart: () => void
  clear: () => void
} {
  const [index, setIndex] = useState<number | null>(null)
  const total = Math.max(0, states.length - 1)
  return {
    index,
    soroban: index === null ? null : (states[index] ?? null),
    total,
    next: () => setIndex((i) => Math.min(total, (i ?? 0) + 1)),
    back: () => setIndex((i) => Math.max(0, (i ?? 0) - 1)),
    restart: () => setIndex(0),
    clear: () => setIndex(null),
  }
}
