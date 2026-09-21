import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { parseAnswer } from '@/ui/parseAnswer'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
  const strings = useStrings()
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const target = values[index] ?? 0

  function submit() {
    // Number('') is 0, so without this a blank field would read as a correct
    // answer on the drill's 0 rod and finish the tutorial.
    const given = parseAnswer(answer)
    if (given === null) return

    if (given !== target) {
      setFeedback(strings.readingFeedback(target))
      setAnswer('')
      return
    }
    setAnswer('')
    setFeedback(null)
    if (index + 1 >= values.length) {
      onComplete()
      return
    }
    setIndex(index + 1)
  }

  return (
    <View>
      <Text testID="reading-index">{strings.readingIndex(index + 1, values.length)}</Text>
      <Text testID="reading-instruction">{strings.readingInstruction}</Text>
      <Abacus soroban={setValue(emptySoroban(1), target)} fade={0} />
      <Text>{strings.readingPrompt}</Text>
      <TextInput
        testID="reading-input"
        keyboardType="number-pad"
        value={answer}
        onChangeText={setAnswer}
      />
      <Pressable testID="reading-submit" accessibilityRole="button" onPress={submit}>
        <Text>{strings.check}</Text>
      </Pressable>
      {feedback !== null ? <Text testID="reading-feedback">{feedback}</Text> : null}
    </View>
  )
}
