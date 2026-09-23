import { StyleSheet, Text } from 'react-native'
import { problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, space } from '@/ui/theme'

// The answer card for a missed problem: the answer, then how each group is
// worked, highest place first, in the same words as a single move's card. A
// column group (＋ −) reads as its rod and move; a product group (×) reads
// as the 九九 and where its digits land. `activeGroup` indexes
// problemSteps(problem): the group a replay is in.
export function ProblemCorrectionCard({
  problem,
  expected,
  activeGroup,
}: {
  problem: Problem
  expected: number
  activeGroup?: number
}) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      {problemSteps(problem).map((group, index) => {
        const active = index === activeGroup
        if (group.kind === 'product') {
          return (
            <Text key={index} testID={`correction-product-${index}`} style={[styles.line, active && styles.activeLine]}>
              {strings.productLine(group.x, group.y, group.place, group.cascades)}
            </Text>
          )
        }
        return group.atom === null ? null : (
          <Text key={index} testID={`correction-column-${group.place}`} style={[styles.line, active && styles.activeLine]}>
            {strings.columnLine(group.place, group.atom, group.cascades)}
          </Text>
        )
      })}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
