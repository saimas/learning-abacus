import { useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg'
import { colors } from '@/ui/theme'
import { geometryFor } from './geometry'

// How long a bead takes to slide to its new place.
export const BEAD_SLIDE_MS = 150

// The soroban bead seen side-on: a bicone, so a flattened hexagon.
function hexagon(width: number, height: number): string {
  const shoulder = width * 0.19
  return [
    `0,${height / 2}`,
    `${shoulder},0`,
    `${width - shoulder},0`,
    `${width},${height / 2}`,
    `${width - shoulder},${height}`,
    `${shoulder},${height}`,
  ].join(' ')
}

// Slides rather than jumps when its place changes. A new place mid-slide
// stops the old slide and heads for the new one. The bead never takes
// touches itself: its rod does.
export function Bead({ kind, top, scale = 1 }: { kind: 'heaven' | 'earth'; top: number; scale?: number }) {
  const g = geometryFor(scale)
  const [y] = useState(() => new Animated.Value(top))
  const shown = useRef(top)

  useEffect(() => {
    if (shown.current === top) return
    shown.current = top
    const slide = Animated.timing(y, { toValue: top, duration: BEAD_SLIDE_MS, useNativeDriver: false })
    slide.start()
    return () => slide.stop()
  }, [top, y])

  return (
    <Animated.View
      testID={`bead-${kind}`}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: y,
        left: (g.rodWidth - g.beadWidth) / 2,
        width: g.beadWidth,
        height: g.beadHeight,
      }}
    >
      <Svg width={g.beadWidth} height={g.beadHeight}>
        <Defs>
          <LinearGradient id="bead" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.beadHighlight} />
            <Stop offset="0.55" stopColor={colors.bead} />
            <Stop offset="1" stopColor={colors.beadShade} />
          </LinearGradient>
        </Defs>
        <Polygon points={hexagon(g.beadWidth, g.beadHeight)} fill="url(#bead)" />
      </Svg>
    </Animated.View>
  )
}
