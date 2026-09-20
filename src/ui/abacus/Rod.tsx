import { View } from 'react-native'
import { readRod, type Rod as RodState } from '@/domain/soroban'
import { Bead } from './Bead'

export function Rod({
  rod,
  index,
  onBeadPress,
}: {
  rod: RodState
  index: number
  onBeadPress?: (kind: 'heaven' | 'earth', beadIndex: number) => void
}) {
  return (
    <View
      testID={`rod-${index}`}
      accessibilityValue={{ text: String(readRod(rod)) }}
      style={{ alignItems: 'center', marginHorizontal: 6 }}
    >
      <Bead active={rod.heaven} kind="heaven" onPress={() => onBeadPress?.('heaven', 0)} />
      <View style={{ height: 2, width: 40, backgroundColor: '#444', marginVertical: 6 }} />
      {[0, 1, 2, 3].map((i) => (
        <Bead key={i} active={i < rod.earth} kind="earth" onPress={() => onBeadPress?.('earth', i)} />
      ))}
    </View>
  )
}
