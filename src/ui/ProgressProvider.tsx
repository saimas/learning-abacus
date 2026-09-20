import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { dayKey, emptyProgress, markDayPracticed, recordAttempt, type Progress } from '@/domain/progress'
import { loadProgress, saveProgress } from '@/storage/progressStore'
import type { AttemptResult } from '@/ui/session/SessionRunner'

type ProgressApi = {
  progress: Progress
  hydrated: boolean
  attempt: (result: AttemptResult) => void
  flush: () => Promise<void>
  reset: () => Promise<void>
  completeTutorial: () => Promise<void>
}

const ProgressContext = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(emptyProgress())
  const [hydrated, setHydrated] = useState(false)
  const latest = useRef<Progress>(progress)
  // Mirrors `hydrated` for the listener below, which must not re-subscribe
  // every time hydration flips.
  const loaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadProgress().then((stored) => {
      if (cancelled) return
      latest.current = stored
      loaded.current = true
      setProgress(stored)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Spec §9 persists at block boundaries, so a crash costs at most one block.
  // But the commonest way a five-minute commute habit actually ends is the
  // app being backgrounded part-way through one, and that path wrote nothing
  // at all — the block was silently discarded.
  useEffect(() => {
    const persist = () => {
      // Before the load resolves `latest.current` is still the empty default.
      // Writing it here would wipe a real learner's history on a fast
      // open-and-close.
      if (!loaded.current) return
      void saveProgress(latest.current)
    }
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'background' || status === 'inactive') persist()
    })
    return () => {
      subscription.remove()
      persist()
    }
  }, [])

  const attempt = useCallback((result: AttemptResult) => {
    const now = Date.now()
    const withAttempt = recordAttempt(
      latest.current,
      result.atomId,
      result.correct,
      result.latencyMs,
      now,
    )
    const next = markDayPracticed(withAttempt, dayKey(now))
    latest.current = next
    setProgress(next)
  }, [])

  const flush = useCallback(async () => {
    await saveProgress(latest.current)
  }, [])

  const reset = useCallback(async () => {
    const fresh = emptyProgress()
    latest.current = fresh
    setProgress(fresh)
    await saveProgress(fresh)
  }, [])

  const completeTutorial = useCallback(async () => {
    const next = { ...latest.current, tutorialDone: true }
    latest.current = next
    setProgress(next)
    await saveProgress(next)
  }, [])

  return (
    <ProgressContext.Provider
      value={{ progress, hydrated, attempt, flush, reset, completeTutorial }}
    >
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext)
  if (api === null) throw new Error('useProgress must be used inside a ProgressProvider')
  return api
}
