import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { PracticeAttempt } from '@/domain/practice'
import {
  dayKey,
  emptyProgress,
  markDayPracticed,
  recordPracticeAttempt,
  type Progress,
} from '@/domain/progress'
import { loadProgress, saveProgress } from '@/storage/progressStore'

type ProgressApi = {
  progress: Progress
  hydrated: boolean
  practise: (attempt: PracticeAttempt) => void
  flush: () => Promise<void>
  reset: () => Promise<void>
  completeTutorial: () => Promise<void>
  completeMultiplyIntro: () => Promise<void>
  completeDivideIntro: () => Promise<void>
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

  // A round's answers are saved when it ends (flush). But the commonest way a
  // short practice habit actually ends is the app being backgrounded
  // part-way through one, and without this that path would write nothing at
  // all — the answers so far silently discarded.
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

  const practise = useCallback((attempt: PracticeAttempt) => {
    const now = Date.now()
    // Spec (core rounds) §5: an answer with help leaves the kind's fade and
    // streaks as they were.
    const withAttempt = attempt.assisted
      ? latest.current
      : recordPracticeAttempt(latest.current, attempt.id, attempt.correct, attempt.pace, now)
    // A round of problems is practice too, so it stamps the day's seal.
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

  // Saved at once, as completeTutorial is: a walkthrough is shown only
  // until it has been seen, so a crash before the next flush must not bring
  // it back.
  const markIntroDone = useCallback(async (flag: 'multiplyIntroDone' | 'divideIntroDone') => {
    const next = { ...latest.current, [flag]: true }
    latest.current = next
    setProgress(next)
    await saveProgress(next)
  }, [])
  const completeMultiplyIntro = useCallback(() => markIntroDone('multiplyIntroDone'), [markIntroDone])
  const completeDivideIntro = useCallback(() => markIntroDone('divideIntroDone'), [markIntroDone])

  return (
    <ProgressContext.Provider
      value={{
        progress,
        hydrated,
        practise,
        flush,
        reset,
        completeTutorial,
        completeMultiplyIntro,
        completeDivideIntro,
      }}
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
