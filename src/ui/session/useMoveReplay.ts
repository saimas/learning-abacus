import { useEffect, useState } from 'react'
import type { Soroban } from '@/domain/soroban'

// Spec (miss review) §4: slow enough to watch each bead slide and read the
// step it made.
export const REPLAY_STEP_MS = 900

type Shown = { states: Soroban[]; step: number }

// Plays a move on the soroban: the first state at once, then the next one
// every REPLAY_STEP_MS until the last, where it stays. `step` indexes the
// state on show; both it and `soroban` are null when nothing has been played
// or the replay was stopped.
export function useMoveReplay(): {
  soroban: Soroban | null
  step: number | null
  play: (states: Soroban[]) => void
  stop: () => void
} {
  const [shown, setShown] = useState<Shown | null>(null)

  // Whichever state is on show schedules the next one. A new play or a stop
  // replaces `shown`, which clears the step still pending; so does unmounting.
  useEffect(() => {
    if (shown === null || shown.step >= shown.states.length - 1) return
    const timer = setTimeout(() => setShown({ states: shown.states, step: shown.step + 1 }), REPLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [shown])

  return {
    soroban: shown === null ? null : (shown.states[shown.step] ?? null),
    step: shown === null ? null : shown.step,
    play: (states) => setShown({ states, step: 0 }),
    stop: () => setShown(null),
  }
}
