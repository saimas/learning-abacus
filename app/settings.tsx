import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useProgress } from '@/ui/ProgressProvider'

export default function Settings() {
  const { progress, hydrated, reset } = useProgress()
  const [confirming, setConfirming] = useState(false)

  if (!hydrated) return <Text testID="hydrating">Loading…</Text>

  return (
    <View>
      <Text testID="days-practiced">{`${progress.daysPracticed} days practised`}</Text>
      {confirming ? (
        <Pressable testID="reset-confirm" accessibilityRole="button" onPress={() => void reset()}>
          <Text>Really erase everything?</Text>
        </Pressable>
      ) : (
        <Pressable testID="reset" accessibilityRole="button" onPress={() => setConfirming(true)}>
          <Text>Reset all progress</Text>
        </Pressable>
      )}
      <Link href="/" testID="link-today">
        Back to today
      </Link>
    </View>
  )
}
