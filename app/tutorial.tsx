import { router } from 'expo-router'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { ReadingDrill } from '@/ui/tutorial/ReadingDrill'

export default function Tutorial() {
  const { completeTutorial } = useProgress()

  return (
    <Screen>
      <ReadingDrill
        onComplete={() => {
          void completeTutorial().then(() => router.replace('/'))
        }}
      />
    </Screen>
  )
}
