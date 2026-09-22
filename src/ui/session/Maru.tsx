import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// A big vermilion 〇 stamped over the soroban, drawn and gone in ~0.8s.
// Decoration only: the next question is already on screen and taking
// input while it animates, so the latency the fluency model records is
// untouched, and it never intercepts a tap.
export function Maru({ size = 140 }: { size?: number }) {
  const { scale, opacity } = useStamp()

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
          borderWidth: Math.round(size * STAMP_STROKE_RATIO),
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
