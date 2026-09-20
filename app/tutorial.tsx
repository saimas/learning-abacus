import { router } from 'expo-router'
import { useProgress } from '@/ui/ProgressProvider'
import { ReadingDrill } from '@/ui/tutorial/ReadingDrill'

export default function Tutorial() {
  const { completeTutorial } = useProgress()

  return (
    <ReadingDrill
      onComplete={() => {
        void completeTutorial().then(() => router.replace('/'))
      }}
    />
  )
}
