import { StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Button } from '@/ui/kit/Button'
import { Seal } from '@/ui/kit/Seal'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// The close screen: the stamped seal, what was answered, and おわる. Shared by
// the daily session and a round of problems, which differ only in the title.
export function SessionSummary({
  title,
  answered,
  correct,
  onDone,
}: {
  title: string
  answered: number
  correct: number
  onDone: () => void
}) {
  const strings = useStrings()
  return (
    <View testID="session-summary" style={styles.summary}>
      <View style={styles.summaryBody}>
        <Seal text={strings.sealDone} state="stamped" size={118} animateIn />
        <Text testID="summary-text" style={styles.summaryTitle}>
          {title}
        </Text>
        {/* Spec §6: the close block reports the result. Atoms mastered and
            tomorrow's preview still belong here and are not built yet. */}
        <Text testID="summary-result" style={styles.summaryResult}>
          {strings.sessionResult(answered, correct)}
        </Text>
      </View>
      <Button testID="finish-button" label={strings.done} onPress={onDone} />
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { flex: 1 },
  summaryBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: {
    marginTop: 26,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 2,
    color: colors.ink,
  },
  summaryResult: { marginTop: space.sm, fontSize: fontSizes.body, color: colors.muted },
})
