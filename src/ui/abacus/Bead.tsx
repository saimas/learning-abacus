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

// While stepping, a bead the current operation has moved is red: 'latest'
// if the step on show moved it, 'group' if an earlier step of the same
// operation did (the owner's request, 2026-09-23).
export type BeadTint = 'group' | 'latest'

// Wood, or one of the two reds, each lit the same way (a highlight, the body,
// a shade) so a coloured bead still looks like a bead. Each has its own
// gradient id, so no two different gradients on screen share a name, and a
// bead whose tint changes points its fill at another definition rather than
// counting on the stops behind an unchanged id being redrawn.
const FILLS = {
  wood: { id: 'bead', highlight: colors.beadHighlight, body: colors.bead, shade: colors.beadShade },
  group: { id: 'bead-group', highlight: colors.beadGroupHighlight, body: colors.beadGroup, shade: colors.beadGroupShade },
  latest: { id: 'bead-latest', highlight: colors.beadLatestHighlight, body: colors.accent, shade: colors.accentShadow },
} as const

// Slides rather than jumps when its place changes. A new place mid-slide
// stops the old slide and heads for the new one. The bead never takes
// touches itself: its rod does. A tinted bead's testID says its tint
// (`bead-earth-latest`); an untinted one keeps the plain `bead-earth`.
export function Bead({
  kind,
  top,
  scale = 1,
  tint,
}: {
  kind: 'heaven' | 'earth'
  top: number
  scale?: number
  tint?: BeadTint
}) {
  const g = geometryFor(scale)
  const fill = FILLS[tint ?? 'wood']
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
      testID={tint === undefined ? `bead-${kind}` : `bead-${kind}-${tint}`}
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
          <LinearGradient id={fill.id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fill.highlight} />
            <Stop offset="0.55" stopColor={fill.body} />
            <Stop offset="1" stopColor={fill.shade} />
          </LinearGradient>
        </Defs>
        <Polygon points={hexagon(g.beadWidth, g.beadHeight)} fill={`url(#${fill.id})`} />
      </Svg>
    </Animated.View>
  )
}
