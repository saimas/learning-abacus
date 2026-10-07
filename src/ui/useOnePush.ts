import { useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'

// Spec (home menu) §3: /round has no swipe back (app/_layout.tsx), so a double
// tap that pushed twice would stack a second run on the first, and a card and
// やりかた tapped together a run and the lessons. The function returned runs a
// push only the first time, until the screen regains focus: a run ends with
// router.back, onto this screen.
export function useOnePush(): (push: () => void) => void {
  const leaving = useRef(false)
  useFocusEffect(
    useCallback(() => {
      leaving.current = false
    }, []),
  )
  return useCallback((push: () => void) => {
    if (leaving.current) return
    leaving.current = true
    push()
  }, [])
}
