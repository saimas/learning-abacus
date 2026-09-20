import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from '@/ui/abacus/Abacus'
import { parseAnswer } from '@/ui/parseAnswer'

const DEFAULT_VALUES = [1, 4, 5, 6, 9, 3, 8, 2, 7, 0]

const INSTRUCTION =
  'The heaven bead above the bar is worth 5. Each earth bead pushed up to the bar is worth 1. The rod reads as their total.'

// Says what the beads on this rod actually add up to, so a miss teaches the
// reading rather than just resetting the field.
function breakdown(value: number): string {
  const earth = value % 5
  const beads = `${earth} earth bead${earth === 1 ? '' : 's'}`
  if (value === 0) return 'no beads pushed in'
  if (value < 5) return beads
  if (earth === 0) return 'the heaven bead on its own'
  return `the heaven bead and ${beads}, 5 + ${earth}`
}

export function ReadingDrill({
  onComplete,
  values = DEFAULT_VALUES,
}: {
  onComplete: () => void
  values?: number[]
}) {
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
      setFeedback(`Not quite. This rod shows ${target}: ${breakdown(target)}.`)
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
      <Text testID="reading-index">{`Rod ${index + 1} of ${values.length}`}</Text>
      <Text testID="reading-instruction">{INSTRUCTION}</Text>
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
      {feedback !== null ? <Text testID="reading-feedback">{feedback}</Text> : null}
    </View>
  )
}
