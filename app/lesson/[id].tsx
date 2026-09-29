import { Redirect, useLocalSearchParams } from 'expo-router'
import { lessonById } from '@/domain/lessons'
import { LessonScreen } from '@/ui/lesson/LessonScreen'

// Spec (howto tutorial) §3: /lesson/add:five, or /lesson/mul:2?kind=mul:2
// before a round. An id it does not know goes Home.
export default function LessonRoute() {
  const lesson = lessonById(useLocalSearchParams().id)
  if (lesson === null) return <Redirect href="/" />
  return <LessonScreen lesson={lesson} />
}
