import { StyleSheet, Text } from 'react-native'
import { problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, space } from '@/ui/theme'

// The answer card for a missed problem: the answer, then how each group is
// worked, highest place first, in the same words as a single move's card.
// `activeGroup` indexes problemSteps(problem): the group a replay is in.
// A product group (×) does not yet get a line here; that is Task 2's job.
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
      {problemSteps(problem).map((group, index) =>
        group.kind !== 'column' || group.atom === null ? null : (
          <Text
            key={group.place}
            testID={`correction-column-${group.place}`}
            style={[styles.line, index === activeGroup && styles.activeLine]}
          >
            {strings.columnLine(group.place, group.atom, group.cascades)}
          </Text>
        ),
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
