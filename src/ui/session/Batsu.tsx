import { Animated, StyleSheet, View } from 'react-native'
import { colors } from '@/ui/theme'
import { STAMP_STROKE_RATIO, useStamp } from './useStamp'

// The 〇's counterpart for a miss: a big vermilion ✕ over the soroban, the
// same size and timing as the 〇. The missed question stays on screen for
// review underneath it, and it never intercepts a tap.
export function Batsu({ size = 140 }: { size?: number }) {
  const { scale, opacity } = useStamp()
  const stroke = Math.round(size * STAMP_STROKE_RATIO)
  // Each stroke is a bar down the middle of the square, turned ±45°.
  const bar = { left: (size - stroke) / 2, width: stroke, height: size, borderRadius: stroke / 2 }

  return (
    <Animated.View
      testID="batsu"
      pointerEvents="none"
      style={{ width: size, height: size, opacity, transform: [{ rotate: '-6deg' }, { scale }] }}
    >
      <View testID="batsu-stroke" style={[styles.stroke, bar, styles.forward]} />
      <View testID="batsu-stroke" style={[styles.stroke, bar, styles.back]} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  stroke: { position: 'absolute', top: 0, backgroundColor: colors.accent },
  forward: { transform: [{ rotate: '45deg' }] },
  back: { transform: [{ rotate: '-45deg' }] },
})
