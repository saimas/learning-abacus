import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { rankOf, rankProgress } from '@/domain/rank'
import { useStrings } from '@/i18n'
import { formatPoints } from '@/i18n/format'
import { feel } from '@/ui/feel'
import { Button } from '@/ui/kit/Button'
import { Seal } from '@/ui/kit/Seal'
import { RankBar } from '@/ui/rank/RankBar'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (runs) §5: a run's results, in the round summary's place: the score
// and how it stands to the kind's best, three facts, and the rank bar
// filling with the run's points, a rank crossed stamped as a seal. もう一回
// is the big button. `best` is the kind's best before this run, and
// `pointsBefore` the lifetime points before it.
export function RunResults({
  score,
  best,
  right,
  longestCombo,
  highestLevel,
  pointsBefore,
  onAgain,
  onDone,
}: {
  score: number
  best: number | undefined
  right: number
  longestCombo: number
  highestLevel: FadeLevel
  pointsBefore: number
  onAgain: () => void
  onDone: () => void
}) {
  const strings = useStrings()
  const newBest = score > 0 && (best === undefined || score > best)
  const after = pointsBefore + score
  const rank = rankOf(after)
  const crossed = rank > rankOf(pointsBefore)
  useEffect(() => {
    if (crossed) feel.rankUp()
  }, [crossed])

  return (
    <View testID="run-results" style={styles.results}>
      <View style={styles.body}>
        <Text style={styles.caption}>{strings.resultsScore}</Text>
        <Text testID="results-score" style={styles.score}>
          {formatPoints(score)}
        </Text>
        {newBest ? (
          <Text testID="results-best" style={styles.newBest}>
            {strings.newBest}
          </Text>
        ) : best !== undefined ? (
          <Text testID="results-best" style={styles.muted}>
            {strings.bestScore(best)}
          </Text>
        ) : null}
        <View style={styles.facts}>
          <Text testID="results-right" style={styles.fact}>
            {strings.resultsRight(right)}
          </Text>
          <Text testID="results-combo" style={styles.fact}>
            {strings.resultsCombo(longestCombo)}
          </Text>
          <Text testID="results-level" style={styles.fact}>
            {strings.resultsLevel(highestLevel)}
          </Text>
        </View>
        <View style={styles.rank}>
          <Seal testID="results-rank-seal" state="stamped" text={strings.rankSeal(rank)} size={64} animateIn={crossed} />
          <View style={styles.rankText}>
            <Text testID="results-rank-name" style={styles.rankName}>
              {crossed ? strings.rankUp(rank) : strings.rankName(rank)}
            </Text>
            {/* A rank crossed fills its new bar from empty. */}
            <RankBar from={crossed ? 0 : rankProgress(pointsBefore)} to={rankProgress(after)} />
          </View>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button testID="run-again" label={strings.runAgain} onPress={onAgain} />
        <Button testID="run-done" variant="outline" label={strings.done} onPress={onDone} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  results: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  caption: { fontSize: fontSizes.small, letterSpacing: 2, color: colors.muted },
  score: { fontFamily: fonts.display, fontSize: 56, color: colors.ink, fontVariant: ['tabular-nums'] },
  newBest: { fontSize: fontSizes.body, fontWeight: '700', color: colors.accent },
  muted: { fontSize: fontSizes.small, color: colors.muted },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.md },
  fact: { fontSize: fontSizes.small, color: colors.ink },
  rank: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: space.md, marginTop: space.xl },
  rankText: { flex: 1, gap: space.xs },
  rankName: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  buttons: { gap: space.sm },
})
