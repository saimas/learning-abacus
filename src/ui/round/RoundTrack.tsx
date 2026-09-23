import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { colors, fontSizes, space } from '@/ui/theme'

// A round is a count of problems, not a stretch of time: a segment per
// problem, filled once answered, and "3 / 10" for the one on screen.
export function RoundTrack({ index, total, onQuit }: { index: number; total: number; onQuit?: () => void }) {
  const strings = useStrings()
  return (
    <View style={styles.bar}>
      {onQuit !== undefined ? (
        <Pressable
          testID="quit"
          accessibilityRole="button"
          accessibilityLabel={strings.quitLabel}
          onPress={onQuit}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      ) : null}
      <View style={styles.track}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, i < index && styles.done]} />
        ))}
      </View>
      <Text testID="round-count" style={styles.label}>
        {strings.roundCount(Math.min(index + 1, total), total)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 28 },
  track: { flex: 1, flexDirection: 'row', gap: 3, height: 4 },
  segment: { flex: 1, backgroundColor: colors.track, borderRadius: 2 },
  done: { backgroundColor: colors.accent },
  label: { fontSize: fontSizes.small, color: colors.muted },
})
