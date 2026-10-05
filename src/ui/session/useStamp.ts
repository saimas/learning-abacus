import { useEffect, useState } from 'react'
import { Animated } from 'react-native'

// The shared life of the 〇 and ✕ stamps: pop in, hold, fade, about 0.8 s
// in all. A `lasting` stamp pops in and stays: a right answer's 〇 goes out
// with its question when the round rolls on (spec (roll) §3), not before.
// A `still` stamp is drawn as it ends up, at once, and stays: a run's
// earlier problem looked back at shows its 〇 or ✕ as it was left, with
// nothing moving (spec (runs) §5).
// Decoration only: whatever is under a stamp keeps taking input.
const POP_IN_MS = 120
const HOLD_MS = 450
const FADE_OUT_MS = 250

// A stamp's stroke width as a share of its size: about 10 pt at 140.
export const STAMP_STROKE_RATIO = 0.07

export function useStamp(lasting = false, still = false): { scale: Animated.Value; opacity: Animated.Value } {
  const [scale] = useState(() => new Animated.Value(still ? 1 : 0.6))
  const [opacity] = useState(() => new Animated.Value(still ? 1 : 0))

  useEffect(() => {
    if (still) return
    const popIn = Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
      Animated.timing(opacity, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
    ])
    const life = lasting
      ? popIn
      : Animated.sequence([
        popIn,
        Animated.delay(HOLD_MS),
        Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: false }),
      ])
    life.start()
  }, [lasting, opacity, scale, still])

  return { scale, opacity }
}
