import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// A big vermilion 〇 stamped over the answered question's soroban. The
// round holds the answered question under it before rolling on
// (RunRunner, spec (roll) §3), so it is `lasting`: it stays until its
// question rolls away, and the latency the next question records starts
// after it. `still`, on a problem looked back at, it is drawn at once and
// stays (useStamp). Decoration only: it never intercepts a tap.
export function Maru({
  size = 140,
  lasting = false,
  still = false,
}: {
  size?: number
  lasting?: boolean
  still?: boolean
}) {
  const { scale, opacity } = useStamp(lasting, still)

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
