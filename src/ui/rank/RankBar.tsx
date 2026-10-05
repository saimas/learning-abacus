import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors } from '@/ui/theme'

export const RANK_FILL_MS = 900

// A rank's bar: how far from its threshold to the next. Given `from`, it
// fills from there to `to` once, on mount (spec (runs) §5's results);
// without, it is simply drawn at `to`.
export function RankBar({ to, from }: { to: number; from?: number }) {
  const [fill] = useState(() => new Animated.Value(from ?? to))
  useEffect(() => {
    if (from === undefined) {
      fill.setValue(to)
      return
    }
    const filling = Animated.timing(fill, {
      toValue: to,
      duration: RANK_FILL_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    })
    filling.start()
    return () => filling.stop()
  }, [fill, from, to])
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  return (
    <View testID="rank-bar" style={styles.track}>
      <Animated.View testID="rank-bar-fill" style={[styles.fill, { width }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
})
