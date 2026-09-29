import { lessonById } from '@/domain/lessons'
import { IntroScreen } from '@/ui/intro/IntroScreen'
import { LessonWalkthrough } from '@/ui/lesson/LessonWalkthrough'
import { useProgress } from '@/ui/ProgressProvider'

const LESSON = lessonById('div:2')

function Walkthrough({ finishLabel, onFinish }: { finishLabel: string; onFinish: () => void }) {
  return LESSON === null ? null : <LessonWalkthrough lesson={LESSON} finishLabel={finishLabel} onFinish={onFinish} />
}

// The ÷ 2けた lesson, before the first ÷ round and from Home's わり算 button,
// until /lesson/[id] takes over (spec (howto tutorial) §3).
export default function DivideIntroScreen() {
  const { completeLesson } = useProgress()
  return <IntroScreen op="div" complete={() => completeLesson('div:2')} walkthrough={Walkthrough} />
}
