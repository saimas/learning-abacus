import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { dayKey, emptyProgress, markDayPracticed, recordAttempt, type Progress } from '@/domain/progress'
import { loadProgress, saveProgress } from '@/storage/progressStore'
import type { AttemptResult } from '@/ui/session/SessionRunner'

type ProgressApi = {
  progress: Progress
  hydrated: boolean
  attempt: (result: AttemptResult) => void
  flush: () => Promise<void>
  reset: () => Promise<void>
}

const ProgressContext = createContext<ProgressApi | null>(null)

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(emptyProgress())
  const [hydrated, setHydrated] = useState(false)
  const latest = useRef<Progress>(progress)

  useEffect(() => {
    let cancelled = false
    void loadProgress().then((stored) => {
      if (cancelled) return
      latest.current = stored
      setProgress(stored)
      setHydrated(true)
    })
    return () => {
      cancelled = true
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

  return (
    <ProgressContext.Provider value={{ progress, hydrated, attempt, flush, reset }}>
      {children}
    </ProgressContext.Provider>
  )
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext)
  if (api === null) throw new Error('useProgress must be used inside a ProgressProvider')
  return api
}
