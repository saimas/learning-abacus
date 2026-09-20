import { Pressable, View } from 'react-native'

export function Bead({
  active,
  kind,
  onPress,
}: {
  active: boolean
  kind: 'heaven' | 'earth'
  onPress?: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <View
        testID={`bead-${kind}`}
        style={{
          width: 34,
          height: 18,
          borderRadius: 9,
          marginVertical: 2,
          backgroundColor: active ? '#8B5A2B' : '#D8C3A5',
        }}
      />
    </Pressable>
  )
}
