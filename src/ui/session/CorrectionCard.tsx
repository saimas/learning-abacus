import { Fragment } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { describeStepParts } from '@/domain/explain'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, space } from '@/ui/theme'

// The answer card for the missed question still on screen: the answer, and
// the substitution that reaches it. `activeStep` indexes
// describeStepParts(atom): the step a replay has just played.
export function CorrectionCard({
  atom,
  expected,
  activeStep,
}: {
  atom: Atom
  expected: number
  activeStep?: number
}) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      {/* Reads exactly as strings.coaching(atom); each step is its own span
          so a replay can point at the one it has just played. */}
      <Text testID="correction-coaching" style={styles.coaching}>
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
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  coaching: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeStep: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
})
