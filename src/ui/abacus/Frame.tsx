import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { colors } from '@/ui/theme'
import {
  BEAM_HEIGHT,
  BEAM_TOP,
  DECK_PADDING,
  FRAME_RADIUS,
  ROD_LINE,
  ROD_WIDTH,
  UNIT_DOT,
} from './geometry'

// The walnut frame, lit from above.
export function FrameBackground() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.frameTop} />
          <Stop offset="1" stopColor={colors.frameBottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={FRAME_RADIUS} ry={FRAME_RADIUS} fill="url(#frame)" />
    </Svg>
  )
}

// Rods, beam, and the dot marking the ones rod (定位点). Drawn behind the
// beads and outside the fade layer, so an F5 "empty frame" still has rods to
// imagine beads on. The ones rod is the rightmost.
export function DeckLines({ rodCount }: { rodCount: number }) {
  const unit = rodCount - 1
  return (
    <View testID="deck-lines" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: rodCount }, (_, index) => (
        <View
          key={index}
          testID={`frame-rod-${index}`}
          style={[styles.rodLine, { left: DECK_PADDING + index * ROD_WIDTH + (ROD_WIDTH - ROD_LINE) / 2 }]}
        />
      ))}
      <View style={styles.beam} />
      <View
        testID="unit-dot"
        style={[styles.dot, { left: DECK_PADDING + unit * ROD_WIDTH + (ROD_WIDTH - UNIT_DOT) / 2 }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  rodLine: { position: 'absolute', top: 0, bottom: 0, width: ROD_LINE, backgroundColor: colors.rod },
  beam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: BEAM_TOP,
    height: BEAM_HEIGHT,
    backgroundColor: colors.beam,
  },
  dot: {
    position: 'absolute',
    top: BEAM_TOP + (BEAM_HEIGHT - UNIT_DOT) / 2,
    width: UNIT_DOT,
    height: UNIT_DOT,
    borderRadius: UNIT_DOT / 2,
    backgroundColor: colors.paper,
  },
})
