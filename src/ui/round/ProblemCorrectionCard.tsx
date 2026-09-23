import { StyleSheet, Text, View } from 'react-native'
import { problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { useActiveLineLayout } from '@/ui/session/useActiveLineLayout'
import { colors, fonts } from '@/ui/theme'

// The explanation of a problem, as the step panel shows it: the answer, then
// how each group is worked, highest place first, in the same words as a
// single move's card. A column group (＋ −) reads as its rod and move; a
// product group (×) reads as the 九九 and where its digits land.
// `activeGroup` indexes problemSteps(problem): the group the learner has
// stepped into. The panel draws the card around these lines. `showAnswer`
// is false before an answer, where the lines explain the problem without
// giving the answer away.
export function ProblemCorrectionCard({
  problem,
  expected,
  activeGroup,
  showAnswer = true,
}: {
  problem: Problem
  expected: number
  activeGroup?: number
  showAnswer?: boolean
}) {
  const strings = useStrings()
  // Where the lines scroll on their own (bead mode), the active group's line
  // tells the scroll where it sits, so it can be scrolled into view. The
  // lines are numbered as problemSteps numbers the groups.
  const lineLayout = useActiveLineLayout(activeGroup)
  return (
    <View testID="correction">
      {showAnswer ? (
        <Text testID="correction-answer" style={styles.answer}>
          {strings.correctionAnswer(expected)}
        </Text>
      ) : null}
      {problemSteps(problem).map((group, index) => {
        const active = index === activeGroup
        if (group.kind === 'product') {
          return (
            <Text
              key={index}
              testID={`correction-product-${index}`}
              onLayout={lineLayout(index)}
              style={[styles.line, active && styles.activeLine]}
            >
              {strings.productLine(group.x, group.y, group.place, group.cascades)}
            </Text>
          )
        }
        return group.atom === null ? null : (
          <Text
            key={index}
            testID={`correction-column-${group.place}`}
            onLayout={lineLayout(index)}
            style={[styles.line, active && styles.activeLine]}
          >
            {strings.columnLine(group.place, group.atom, group.cascades)}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
