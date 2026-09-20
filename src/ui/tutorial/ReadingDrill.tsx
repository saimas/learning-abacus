import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from '@/ui/abacus/Abacus'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const target = values[index] ?? 0

  function submit() {
    if (Number(answer) !== target) {
      setAnswer('')
      return
    }
    setAnswer('')
    if (index + 1 >= values.length) {
      onComplete()
      return
    }
    setIndex(index + 1)
  }

  return (
    <View>
      <Text testID="reading-index">{`Rod ${index + 1} of ${values.length}`}</Text>
      <Abacus soroban={setValue(emptySoroban(1), target)} fade={0} />
      <Text>What number is on this rod?</Text>
      <TextInput
        testID="reading-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="reading-submit" accessibilityRole="button" onPress={submit}>
        <Text>Check</Text>
      </Pressable>
    </View>
  )
}
