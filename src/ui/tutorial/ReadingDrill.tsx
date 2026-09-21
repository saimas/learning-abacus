import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { Card } from '@/ui/kit/Card'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
  const strings = useStrings()
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const target = values[index] ?? 0

  function submit() {
    // Number('') is 0, so without this a blank field would read as a correct
    // answer on the drill's 0 rod and finish the tutorial.
    const given = parseAnswer(answer)
    if (given === null) return

    if (given !== target) {
      setFeedback(strings.readingFeedback(target))
      setAnswer('')
      return
    }
    setAnswer('')
    setFeedback(null)
    if (index + 1 >= values.length) {
      onComplete()
      return
    }
    setIndex(index + 1)
  }

  return (
    <View style={styles.drill}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.readingTitle}</Text>
        <View
          testID="reading-index"
          accessible
          accessibilityLabel={strings.readingIndex(index + 1, values.length)}
          style={styles.dots}
        >
          {values.map((_, i) => (
            <View key={i} style={[styles.dot, i <= index && styles.dotReached]} />
          ))}
        </View>
      </View>
      {/* R9: the keypad below is always fully visible, pinned at the bottom.
          The instruction, soroban, prompt and feedback — everything that can
          grow — scroll instead of pushing the keypad off a short screen. On
          a screen tall enough to show it all, this scrolls nowhere and looks
          the same as a plain View. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text testID="reading-instruction" style={styles.instruction}>
          {strings.readingInstruction}
        </Text>
        <View style={styles.soroban}>
          <Abacus soroban={setValue(emptySoroban(1), target)} fade={0} />
        </View>
        <Text style={styles.prompt}>{strings.readingPrompt}</Text>
        {feedback !== null ? (
          <Card accent style={styles.feedback}>
            <Text testID="reading-feedback" style={styles.feedbackText}>
              {feedback}
            </Text>
          </Card>
        ) : null}
      </ScrollView>
      <AnswerPad
        value={answer}
        onChange={setAnswer}
        onSubmit={submit}
        submitLabel={strings.check}
        submitTestID="reading-submit"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  drill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  title: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.track },
  dotReached: { backgroundColor: colors.accent },
  instruction: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.panel,
    overflow: 'hidden',
    backgroundColor: colors.soft,
    color: colors.ink,
    fontSize: fontSizes.small,
    lineHeight: 21,
  },
  soroban: { marginTop: space.lg },
  prompt: {
    marginTop: space.md,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.ink,
  },
  feedback: { marginTop: space.sm, paddingVertical: space.sm },
  feedbackText: { fontSize: fontSizes.small, lineHeight: 19, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
})
