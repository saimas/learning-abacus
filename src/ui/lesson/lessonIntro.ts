import { techniqueOf, type Lesson } from '@/domain/lessons'
import { answerOf } from '@/domain/problem'
import type { Strings } from '@/i18n/ja'
import type { IntroTexts } from '@/ui/intro/MethodIntro'

// Spec (howto tutorial) §2: a ＋ − × lesson's words. A technique lesson says
// what its move is; a ＋ − 2けた or 3けた lesson how the operation is worked
// by place; × how 両落とし works and where a 九九's digits go at its size.
export function lessonIntro(strings: Strings, lesson: Lesson): IntroTexts {
  const move = techniqueOf(lesson)
  const pages =
    move !== null
      ? [strings.techniqueIntro(move.op, move.technique)]
      : lesson.op === 'add' || lesson.op === 'sub'
        ? [strings.lessonMethod(lesson.op)]
        : [strings.introMethod, strings.multiplyPlacement(lesson.digits)]
  return {
    title: strings.lessonTitle(lesson),
    pages,
    result: strings.lessonResult(lesson.example, answerOf(lesson.example)),
  }
}
