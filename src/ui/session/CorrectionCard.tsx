import { Fragment } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { describeStepParts } from '@/domain/explain'
import { useStrings } from '@/i18n'
import { colors, fonts } from '@/ui/theme'
import { useActiveLineLayout } from './useActiveLineLayout'

// The explanation of a single move, as the step panel shows it: the answer,
// and the substitution that reaches it. `activeStep` indexes
// describeStepParts(atom): the step the learner has just stepped to. The
// panel draws the card around these lines. `showAnswer` is false before an
// answer, where the lines explain the move without giving the answer away.
export function CorrectionCard({
  atom,
  expected,
  activeStep,
  showAnswer = true,
}: {
  atom: Atom
  expected: number
  activeStep?: number
  showAnswer?: boolean
}) {
  const strings = useStrings()
  // Where the lines scroll on their own (bead mode), the line of the step on
  // show tells the scroll where it sits, so it can be scrolled into view.
  // Every step is a span of the one coaching line, and a span is not laid
  // out on its own, so that line (line 0) is the one to show, active from
  // the first step on.
  const lineLayout = useActiveLineLayout(activeStep === undefined ? undefined : 0)
  return (
    <View testID="correction">
      {showAnswer ? (
        <Text testID="correction-answer" style={styles.answer}>
          {strings.correctionAnswer(expected)}
        </Text>
      ) : null}
      {/* Reads exactly as strings.coaching(atom); each step is its own span
          so the panel can point at the one just stepped to. */}
      <Text testID="correction-coaching" onLayout={lineLayout(0)} style={styles.coaching}>
        {strings.coachingLead(atom)}
        {describeStepParts(atom).map((part, index) => (
          <Fragment key={index}>
            {index > 0 ? ' ' : null}
            <Text
              testID={`correction-step-${index}`}
              style={index === activeStep ? styles.activeStep : undefined}
            >
              {part}
            </Text>
          </Fragment>
        ))}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  coaching: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeStep: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
