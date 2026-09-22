import { Pressable, View, type GestureResponderEvent } from 'react-native'
import { readRod, type BeadRef, type Rod as RodState } from '@/domain/soroban'
import { Bead } from './Bead'
import { beadAt, beadTops, geometryFor } from './geometry'

// One rod's beads, placed by value. The rod line and beam live in the static
// layer (Frame.tsx), so they survive the fade.
//
// With handlers, the whole column is one tap target (the tap's height picks
// the bead), and VoiceOver treats the rod as an adjustable value.
export function Rod({
  rod,
  index,
  scale = 1,
  label,
  onTapBead,
  onAdjust,
}: {
  rod: RodState
  index: number
  scale?: number
  label?: string
  onTapBead?: (bead: BeadRef) => void
  onAdjust?: (delta: number) => void
}) {
  const g = geometryFor(scale)
  const tops = beadTops(rod, scale)
  const size = { width: g.rodWidth, height: g.columnHeight }
  const value = { text: String(readRod(rod)) }
  const beads = (
    <>
      <Bead kind="heaven" top={tops.heaven} scale={scale} />
      {tops.earth.map((top, i) => (
        <Bead key={i} kind="earth" top={top} scale={scale} />
      ))}
    </>
  )

  if (onTapBead === undefined) {
    return (
      <View testID={`rod-${index}`} accessibilityValue={value} style={size}>
        {beads}
      </View>
    )
  }

  return (
    <Pressable
      testID={`rod-${index}`}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={value}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => onAdjust?.(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onPress={(event: GestureResponderEvent) => onTapBead(beadAt(rod, event.nativeEvent.locationY, scale))}
      style={size}
    >
      {beads}
    </Pressable>
  )
}
