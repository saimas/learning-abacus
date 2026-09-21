import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/ui/kit/Icon'
import { colors, fontSizes, space } from '@/ui/theme'

// The session's time, not its item count: it fills linearly from the moment
// the runner mounts across the practice blocks' seconds. Animated, so the
// runner is not re-rendered every second to move it.
export function SessionTrack({
  segments,
  label,
  quitLabel,
  onQuit,
}: {
  segments: readonly number[]
  label: string
  quitLabel: string
  onQuit?: () => void
}) {
  const total = segments.reduce((sum, seconds) => sum + seconds, 0)
  const [progress] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(total, 1) * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    })
    fill.start()
    return () => fill.stop()
  }, [progress, total])

  const starts = segments.map((_, i) => segments.slice(0, i).reduce((sum, s) => sum + s, 0))

  return (
    <View style={styles.bar}>
      {onQuit !== undefined ? (
        <Pressable
          testID="quit"
          accessibilityRole="button"
          accessibilityLabel={quitLabel}
          onPress={onQuit}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      ) : null}
      <View style={styles.track}>
        {segments.map((seconds, i) => {
          const from = (starts[i] ?? 0) / Math.max(total, 1)
          const to = ((starts[i] ?? 0) + seconds) / Math.max(total, 1)
          const width = progress.interpolate({
            inputRange: [from, to],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          })
          return (
            <View key={i} testID={`track-segment-${i}`} style={[styles.segment, { flex: seconds }]}>
              <Animated.View style={[styles.fill, { width }]} />
            </View>
          )
        })}
      </View>
      <Text testID="block-label" style={styles.label}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 28 },
  track: { flex: 1, flexDirection: 'row', gap: 3, height: 4 },
  segment: { backgroundColor: colors.track, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
  label: { fontSize: fontSizes.small, color: colors.muted },
})
