import { StyleSheet, Text, View } from 'react-native'
import { pointsToNextRank, rankOf, rankProgress } from '@/domain/rank'
import { useStrings } from '@/i18n'
import { Seal } from '@/ui/kit/Seal'
import { colors, fontSizes, space } from '@/ui/theme'
import { RankBar } from './RankBar'

// Spec (runs) §5: the rank on Home, beside the days practised: its seal, its
// name, and the bar and points to the next. VoiceOver reads it as one line.
export function RankBadge({ points }: { points: number }) {
  const strings = useStrings()
  const rank = rankOf(points)
  const toNext = pointsToNextRank(points)
  return (
    <View testID="rank-badge" accessible accessibilityLabel={strings.rankLabel(rank, toNext)} style={styles.badge}>
      <Seal testID="rank-seal" state="stamped" text={strings.rankSeal(rank)} />
      <View style={styles.text}>
        <Text testID="rank-name" style={styles.name}>
          {strings.rankName(rank)}
        </Text>
        <RankBar to={rankProgress(points)} />
        <Text testID="rank-next" style={styles.muted}>
          {toNext === 0 ? strings.rankTop : strings.rankToNext(toNext)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  text: { flex: 1, gap: space.xs },
  name: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  muted: { fontSize: fontSizes.small, color: colors.muted },
})
