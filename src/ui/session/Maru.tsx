import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// A big vermilion 〇 stamped over the answered question's soroban, drawn
// and faded in ~0.8s. The round holds the answered question under it
// before rolling on (RoundRunner, spec (roll) §3), so the latency the next
// question records starts after it. Decoration only: it never intercepts a
// tap.
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
