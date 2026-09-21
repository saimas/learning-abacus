import { StyleSheet, Text, View } from 'react-native'
import { BLOCK_SECONDS, type BlockKind } from '@/domain/session'
import { useStrings } from '@/i18n'
import { colors, fontSizes, space } from '@/ui/theme'

// The fixed shape of every session, so tomorrow's five minutes hold no
// surprises. Close has no segment: it is a summary, not a timed stretch.
const PRACTICE: readonly BlockKind[] = ['warmup', 'focus', 'faderep']

export function PlanBar() {
  const strings = useStrings()
  return (
    <View testID="plan-bar" style={styles.plan}>
      <View style={styles.bar}>
        {PRACTICE.map((kind) => (
          <View key={kind} style={[styles.segment, { flex: BLOCK_SECONDS[kind] }]} />
        ))}
      </View>
      <View style={styles.labels}>
        {PRACTICE.map((kind) => (
          <Text key={kind} numberOfLines={1} style={[styles.label, { flex: BLOCK_SECONDS[kind] }]}>
            {strings.blockLabel(kind)}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  plan: { marginTop: space.xl },
  bar: { flexDirection: 'row', gap: 3, height: 6 },
  segment: { borderRadius: 3, backgroundColor: colors.keyEdge },
  labels: { flexDirection: 'row', gap: 3, marginTop: 6 },
  label: { fontSize: fontSizes.caption, color: colors.muted },
})
