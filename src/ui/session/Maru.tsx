import { useEffect, useState } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'

// A big vermilion 〇 stamped over the soroban, drawn and gone in ~0.8s.
// Decoration only: the next question is already on screen and taking
// input while it animates, so the latency the fluency model records is
// untouched, and it never intercepts a tap.
const POP_IN_MS = 120
const HOLD_MS = 450
const FADE_OUT_MS = 250
const STROKE_RATIO = 0.07

export function Maru({ size = 140 }: { size?: number }) {
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

  return (
    <Animated.View
      testID="maru"
      pointerEvents="none"
      style={[
        styles.maru,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.round(size * STROKE_RATIO),
          opacity,
          transform: [{ rotate: '-8deg' }, { scale }],
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  maru: {
    borderColor: colors.accent,
  },
})
