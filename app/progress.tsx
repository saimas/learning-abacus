import { Text, View } from 'react-native'
import { useProgress } from '@/ui/ProgressProvider'
import { AtomGrid } from '@/ui/progress/AtomGrid'

export default function ProgressScreen() {
  const { progress, hydrated } = useProgress()
  if (!hydrated) return <Text testID="hydrating">Loading…</Text>
  return (
    <View>
      <Text>{`${progress.daysPracticed} days practised`}</Text>
      <AtomGrid progress={progress} />
    </View>
  )
}
