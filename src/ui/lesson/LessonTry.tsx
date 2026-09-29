import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tryProblem, type Lesson } from '@/domain/lessons'
import { useStrings } from '@/i18n'
import { ProblemQuestion } from '@/ui/round/ProblemQuestion'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (howto tutorial) §2: やってみよう. A problem like the lesson's, on the
// beads drawn solid (fade 0, whose coaching opens the step panel with a
// miss's ✕), answered as in a round but recorded nowhere: nothing here
// reaches progress. もう一問 draws another; おわる leaves.
export function LessonTry({
  lesson,
  onLeave,
  random = Math.random,
}: {
  lesson: Lesson
  onLeave: () => void
  random?: () => number
}) {
  const strings = useStrings()
  // `n` keys the question, so another problem starts afresh.
  const [draw, setDraw] = useState(() => ({ n: 0, problem: tryProblem(lesson, random) }))
  const again = () => setDraw((previous) => ({ n: previous.n + 1, problem: tryProblem(lesson, random, previous.problem) }))

  return (
    <View style={styles.try}>
      <Text accessibilityRole="header" style={styles.title}>
        {strings.lessonTry}
      </Text>
      <ProblemQuestion
        key={draw.n}
        problem={draw.problem}
        fade={0}
        // Bead answers are untimed, so the clock is never read for pace.
        shownAt={0}
        now={Date.now}
        onSubmit={() => {}}
        onMoveOn={again}
        afterAnswer={{ leaveLabel: strings.done, onLeave, againLabel: strings.lessonAgain }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  try: { flex: 1 },
  title: { marginTop: space.sm, fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
})
