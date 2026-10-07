import { router, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Lesson } from '@/domain/lessons'
import { practiceId } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { LessonTry } from './LessonTry'
import { LessonWalkthrough } from './LessonWalkthrough'

// Spec (howto tutorial) §3: a lesson, opened from the やりかた page, or
// with a round's `kind` before that round. Its ✕ leaves at any point. The
// lesson counts as done when it is left, when やってみよう is reached, or
// when 練習をはじめる starts the round (§4).
export function LessonScreen({ lesson }: { lesson: Lesson }) {
  const { hydrated, completeLesson } = useProgress()
  const strings = useStrings()
  // The round this lesson leads into: only a round of its own kind, since
  // ?kind= arrives from outside.
  const param = useLocalSearchParams().kind
  const kind = param === practiceId({ op: lesson.op, digits: lesson.digits }) ? param : null
  const [trying, setTrying] = useState(false)
  // Leaving saves first; a second tap meanwhile must not save or navigate
  // twice. Reaching やってみよう is guarded the same way.
  const leaving = useRef(false)
  const reached = useRef(false)

  function leave(startRound: boolean) {
    if (leaving.current) return
    leaving.current = true
    void completeLesson(lesson.id).then(() => {
      if (startRound && kind !== null) router.replace({ pathname: '/round', params: { kind } })
      else if (router.canGoBack()) router.back()
      else router.replace('/')
    })
  }

  function finishWalkthrough() {
    if (kind !== null) {
      leave(true)
      return
    }
    if (reached.current) return
    reached.current = true
    void completeLesson(lesson.id)
    setTrying(true)
  }

  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      {/* The same ✕, at the same place, as a run's (RunBar). */}
      <View style={styles.bar}>
        <Pressable
          testID="intro-exit"
          accessibilityRole="button"
          accessibilityLabel={strings.introExit}
          onPress={() => leave(false)}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      {trying ? (
        <LessonTry lesson={lesson} onLeave={() => leave(false)} />
      ) : (
        <LessonWalkthrough
          lesson={lesson}
          finishLabel={kind !== null ? strings.lessonStartRound : strings.lessonTry}
          onFinish={finishWalkthrough}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', height: 28 },
})
