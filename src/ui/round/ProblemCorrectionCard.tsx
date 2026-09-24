import { StyleSheet, Text, View } from 'react-native'
import { problemSteps, type Problem, type StepGroup } from '@/domain/problem'
import { useStrings } from '@/i18n'
import type { Strings } from '@/i18n/ja'
import { useActiveLineLayout } from '@/ui/session/useActiveLineLayout'
import { colors, fonts } from '@/ui/theme'

// The explanation of a problem, as the step panel shows it: the answer, then
// how each group is worked, highest place first, in the same words as a
// single move's card. A column group (＋ −) reads as its rod and move; a
// product group (×) reads as the 九九 and where its digits land. A ÷
// problem alternates a quotient group, read as where its digit is placed and
// why (割れる / 割れない), and a subtract group per divisor digit, read as the
// 九九 and the rods its digits come off.
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
        const line = groupLine(strings, problem, group)
        if (line === null) return null
        return (
          <Text
            key={index}
            // A column is named by its rod, which is unique; the other
            // kinds by their index, since a place repeats across 九九.
            testID={group.kind === 'column' ? `correction-column-${group.place}` : `correction-${group.kind}-${index}`}
            onLayout={lineLayout(index)}
            style={[styles.line, index === activeGroup && styles.activeLine]}
          >
            {line}
          </Text>
        )
      })}
    </View>
  )
}

// A group's line, or null for a group with nothing to say. Every 九九 gets a
// line, even one whose product is 0 (recalling it is still a step), and so
// does a 0 quotient digit (deciding it is too). Shared with the walkthrough
// (MethodIntro), whose pages read each group in the card's own words.
export function groupLine(strings: Strings, problem: Problem, group: StepGroup): string | null {
  switch (group.kind) {
    case 'column':
      // A column that adds 0 moves nothing.
      return group.atom === null ? null : strings.columnLine(group.place, group.atom, group.cascades)
    case 'product':
      return strings.productLine(group.x, group.y, group.place, group.cascades)
    case 'quotient':
      return strings.quotientLine(group.q, group.lead, problem.b, group.split)
    case 'subtract':
      return strings.subtractLine(group.q, group.y, group.place, group.cascades)
  }
}

const styles = StyleSheet.create({
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
