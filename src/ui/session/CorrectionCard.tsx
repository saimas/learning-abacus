import { StyleSheet, Text, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// The runner re-queues a miss at the back of the block, so this card is on
// screen under a *different* question. It has to say which one it corrects.
export function CorrectionCard({ atom, expected }: { atom: Atom; expected: number }) {
  const strings = useStrings()
  return (
    <Card accent testID="correction" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tag}>{strings.previousProblem}</Text>
        <Text testID="correction-problem" style={styles.problem}>
          {strings.prompt(atom)}
        </Text>
      </View>
      <Text testID="correction-answer" style={styles.answer}>
        {strings.correctionAnswer(expected)}
      </Text>
      <Text testID="correction-coaching" style={styles.coaching}>
        {strings.coaching(atom)}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  header: { flexDirection: 'row', gap: space.sm, alignItems: 'baseline' },
  tag: { fontSize: fontSizes.caption, color: colors.accent, fontWeight: '600' },
  problem: { fontSize: fontSizes.caption, color: colors.muted },
  answer: { marginTop: 2, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  coaching: { marginTop: 2, fontSize: 12, color: colors.muted },
})
