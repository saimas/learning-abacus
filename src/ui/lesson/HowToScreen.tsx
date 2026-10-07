import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { lessonsFor, type Lesson } from '@/domain/lessons'
import { DIGITS, type PairOperation } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { BackLink } from '@/ui/kit/BackLink'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { useOnePush } from '@/ui/useOnePush'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

// Spec (howto tutorial) §3: an operation's lessons, under their 桁数, each
// with a ✓ once done. A row opens its lesson.
export function HowToScreen({ op }: { op: PairOperation }) {
  const { progress } = useProgress()
  const strings = useStrings()
  // A double tap must not stack a second lesson on the first.
  const onePush = useOnePush()

  const open = (lesson: Lesson) => {
    onePush(() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } }))
  }
  const lessons = lessonsFor(op)

  return (
    <Screen>
      <BackLink />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          {strings.howToTitle(op)}
        </Text>
        {DIGITS.map((digits) => (
          <View key={digits} style={styles.section}>
            <Text style={styles.heading}>{strings.digitsName(digits)}</Text>
            {lessons
              .filter((lesson) => lesson.digits === digits)
              .map((lesson) => {
                const done = progress.lessonsSeen.includes(lesson.id)
                return (
                  <Pressable
                    key={lesson.id}
                    testID={`lesson-${lesson.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={strings.lessonRowLabel(lesson, done)}
                    onPress={() => open(lesson)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  >
                    <Text style={styles.rowLabel}>{strings.lessonRow(lesson)}</Text>
                    {done ? (
                      <Text testID={`lesson-done-${lesson.id}`} style={styles.check}>
                        ✓
                      </Text>
                    ) : null}
                  </Pressable>
                )
              })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  section: { marginTop: space.lg, gap: space.sm },
  heading: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  // The kit Button's height, so every row is a full tap target.
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.cardLine,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.85 },
  rowLabel: { flexShrink: 1, fontSize: fontSizes.body, color: colors.ink },
  check: { fontSize: fontSizes.title, color: colors.ok },
})
