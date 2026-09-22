import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { colors } from '@/ui/theme'
import { geometryFor } from './geometry'

// The walnut frame, lit from above. Clipped to the frame's own bounds: an
// absolutely-filled Svg sizes its percentage width/height against the
// screen, not the (content-sized) frame View, so without this wrapper the
// gradient paints past the frame's edges.
export function FrameBackground({ scale = 1 }: { scale?: number }) {
  const g = geometryFor(scale)
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: g.frameRadius, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.frameTop} />
            <Stop offset="1" stopColor={colors.frameBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={g.frameRadius} ry={g.frameRadius} fill="url(#frame)" />
      </Svg>
    </View>
  )
}

// Rods, beam, and the dot marking the ones rod (定位点). Drawn behind the
// beads and outside the fade layer, so an F5 "empty frame" still has rods to
// imagine beads on. The ones rod is the rightmost.
export function DeckLines({ rodCount, scale = 1 }: { rodCount: number; scale?: number }) {
  const g = geometryFor(scale)
  const unit = rodCount - 1
  return (
    <View testID="deck-lines" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: rodCount }, (_, index) => (
        <View
          key={index}
          testID={`frame-rod-${index}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: g.rodLine,
            left: g.deckPadding + index * g.rodWidth + (g.rodWidth - g.rodLine) / 2,
            backgroundColor: colors.rod,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: g.beamTop,
          height: g.beamHeight,
          backgroundColor: colors.beam,
        }}
      />
      <View
        testID="unit-dot"
        style={{
          position: 'absolute',
          top: g.beamTop + (g.beamHeight - g.unitDot) / 2,
          left: g.deckPadding + unit * g.rodWidth + (g.rodWidth - g.unitDot) / 2,
          width: g.unitDot,
          height: g.unitDot,
          borderRadius: g.unitDot / 2,
          backgroundColor: colors.paper,
        }}
      />
    </View>
  )
}
