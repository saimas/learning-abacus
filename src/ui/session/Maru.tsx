import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// A big vermilion 〇 stamped over the answered question's soroban. The
// round holds the answered question under it before rolling on
// (RunRunner, spec (roll) §3), so it is `lasting`: it stays until its
// question rolls away, and the latency the next question records starts
// after it. Decoration only: it never intercepts a tap.
export function Maru({ size = 140, lasting = false }: { size?: number; lasting?: boolean }) {
  const { scale, opacity } = useStamp(lasting)

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
