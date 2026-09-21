import { View } from 'react-native'
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg'
import { colors } from '@/ui/theme'
import { BEAD_HEIGHT, BEAD_WIDTH, ROD_WIDTH } from './geometry'

// The soroban bead seen side-on: a bicone, so a flattened hexagon.
const SHOULDER = BEAD_WIDTH * 0.19
const POINTS = [
  `0,${BEAD_HEIGHT / 2}`,
  `${SHOULDER},0`,
  `${BEAD_WIDTH - SHOULDER},0`,
  `${BEAD_WIDTH},${BEAD_HEIGHT / 2}`,
  `${BEAD_WIDTH - SHOULDER},${BEAD_HEIGHT}`,
  `${SHOULDER},${BEAD_HEIGHT}`,
].join(' ')

// Not pressable: Phase 1 takes typed answers only.
export function Bead({ kind, top }: { kind: 'heaven' | 'earth'; top: number }) {
  return (
    <View
      testID={`bead-${kind}`}
      style={{
        position: 'absolute',
        top,
        left: (ROD_WIDTH - BEAD_WIDTH) / 2,
        width: BEAD_WIDTH,
        height: BEAD_HEIGHT,
      }}
    >
      <Svg width={BEAD_WIDTH} height={BEAD_HEIGHT}>
        <Defs>
          <LinearGradient id="bead" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.beadHighlight} />
            <Stop offset="0.55" stopColor={colors.bead} />
            <Stop offset="1" stopColor={colors.beadShade} />
          </LinearGradient>
        </Defs>
        <Polygon points={POINTS} fill="url(#bead)" />
      </Svg>
    </View>
  )
}
