import { Pressable, View, type GestureResponderEvent } from 'react-native'
import { readRod, type BeadRef, type Rod as RodState } from '@/domain/soroban'
import { Bead, type BeadTint } from './Bead'
import { beadAt, beadTops, geometryFor } from './geometry'

// One rod's beads, placed by value. The rod line and beam live in the static
// layer (Frame.tsx), so they survive the fade.
//
// With handlers, the whole column is one tap target (the tap's height picks
// the bead), and VoiceOver treats the rod as an adjustable value. `tints`
// colours this rod's beads while stepping; a bead listed as both 'group' and
// 'latest' is drawn 'latest'.
export function Rod({
  rod,
  index,
  scale = 1,
  label,
  tints = [],
  onTapBead,
  onAdjust,
}: {
  rod: RodState
  index: number
  scale?: number
  label?: string
  tints?: readonly { bead: BeadRef; tint: BeadTint }[]
  onTapBead?: (bead: BeadRef) => void
  onAdjust?: (delta: number) => void
}) {
  const g = geometryFor(scale)
  const tops = beadTops(rod, scale)
  const size = { width: g.rodWidth, height: g.columnHeight }
  const value = { text: String(readRod(rod)) }
  const beads = (
    <>
      <Bead kind="heaven" top={tops.heaven} scale={scale} tint={tintOf(tints, { kind: 'heaven' })} />
      {tops.earth.map((top, i) => (
        <Bead key={i} kind="earth" top={top} scale={scale} tint={tintOf(tints, { kind: 'earth', index: i })} />
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
      // An adjustable rod is moved by the increment/decrement actions above,
      // never by activation. Without this, VoiceOver's double-tap falls back
      // to a synthetic tap at the rod's centre and moves a bead by accident.
      onAccessibilityTap={() => {}}
      onPress={(event: GestureResponderEvent) => onTapBead(beadAt(rod, event.nativeEvent.locationY, scale))}
      style={size}
    >
      {beads}
    </Pressable>
  )
}

function tintOf(tints: readonly { bead: BeadRef; tint: BeadTint }[], bead: BeadRef): BeadTint | undefined {
  const mine = tints.filter((listed) => sameBead(listed.bead, bead)).map((listed) => listed.tint)
  if (mine.includes('latest')) return 'latest'
  return mine.includes('group') ? 'group' : undefined
}

function sameBead(a: BeadRef, b: BeadRef): boolean {
  return a.kind === 'heaven' ? b.kind === 'heaven' : b.kind === 'earth' && a.index === b.index
}
