import type { Lesson } from '@/domain/lessons'
import { useStrings } from '@/i18n'
import { DivideWalkthrough } from '@/ui/intro/DivideWalkthrough'
import { MethodIntro } from '@/ui/intro/MethodIntro'
import { lessonIntro } from './lessonIntro'

// Spec (howto tutorial) §2: a lesson's walkthrough of its example. ÷ keeps
// its own bead-by-bead walk (spec: division walkthrough), which takes any
// problem; ＋ − × are played by MethodIntro.
export function LessonWalkthrough({
  lesson,
  finishLabel,
  onFinish,
}: {
  lesson: Lesson
  finishLabel: string
  onFinish: () => void
}) {
  const strings = useStrings()
  if (lesson.op === 'div') {
    return (
      <DivideWalkthrough
        problem={lesson.example}
        title={strings.lessonTitle(lesson)}
        finishLabel={finishLabel}
        onFinish={onFinish}
      />
    )
  }
  return (
    <MethodIntro
      problem={lesson.example}
      intro={lessonIntro(strings, lesson)}
      finishLabel={finishLabel}
      onFinish={onFinish}
    />
  )
}
