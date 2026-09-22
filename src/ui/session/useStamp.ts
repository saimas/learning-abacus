import { useEffect, useState } from 'react'
import { Animated } from 'react-native'

// The shared life of the 〇 and ✕ stamps: pop in, hold, fade, about 0.8 s
// in all. Decoration only: whatever is under a stamp keeps taking input.
const POP_IN_MS = 120
const HOLD_MS = 450
const FADE_OUT_MS = 250

// A stamp's stroke width as a share of its size: about 10 pt at 140.
export const STAMP_STROKE_RATIO = 0.07

export function useStamp(): { scale: Animated.Value; opacity: Animated.Value } {
  const [scale] = useState(() => new Animated.Value(0.6))
  const [opacity] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: POP_IN_MS, useNativeDriver: false }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: false }),
    ]).start()
  }, [opacity, scale])

  return { scale, opacity }
}
