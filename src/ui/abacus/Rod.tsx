import { View } from 'react-native'
import { readRod, type Rod as RodState } from '@/domain/soroban'
import { Bead } from './Bead'
import { beadTops, COLUMN_HEIGHT, ROD_WIDTH } from './geometry'

// One rod's beads, placed by value. The rod line and beam live in the static
// layer (Frame.tsx), so they survive the fade.
export function Rod({ rod, index }: { rod: RodState; index: number }) {
  const tops = beadTops(rod)
  return (
    <View
      testID={`rod-${index}`}
      accessibilityValue={{ text: String(readRod(rod)) }}
      style={{ width: ROD_WIDTH, height: COLUMN_HEIGHT }}
    >
      <Bead kind="heaven" top={tops.heaven} />
      {tops.earth.map((top, i) => (
        <Bead key={i} kind="earth" top={top} />
      ))}
    </View>
  )
}
