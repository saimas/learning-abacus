import type { BeadRef, Rod } from '@/domain/soroban'

// Shared by the static layer (frame, rods, beam) and the bead layer, which are
// drawn separately and stacked. If the two disagree, beads float off their
// rods. All values are points.
export const BEAD_WIDTH = 50
export const BEAD_HEIGHT = 21
export const ROD_WIDTH = 64
export const ROD_LINE = 3
export const HEAVEN_HEIGHT = 46
export const BEAM_HEIGHT = 9
// Four beads plus the gap they travel across.
export const EARTH_HEIGHT = 4 * BEAD_HEIGHT + 26
// Clearance between a resting bead and the frame.
export const EDGE_GAP = 3
export const UNIT_DOT = 4
export const FRAME_PADDING = 10
export const FRAME_RADIUS = 14
export const DECK_PADDING = 6

export const BEAM_TOP = HEAVEN_HEIGHT
export const EARTH_TOP = HEAVEN_HEIGHT + BEAM_HEIGHT
export const COLUMN_HEIGHT = EARTH_TOP + EARTH_HEIGHT

// The bead-answering layout draws the soroban 1.38× larger, so beads are big
// enough to tap: 69 × 29 pt on 88 pt rods.
export const BEAD_MODE_SCALE = 1.38

// A window shorter than this is a 375 × 667 phone (iPhone SE, 8); every newer
// phone is 812 pt or taller. There, a × problem's operand board under the
// soroban leaves bead mode too little height to show the prompt above the
// soroban and 手順を見る below, so with the board present the soroban is
// drawn no larger than SHORT_WINDOW_BEAD_SCALE (and the board smaller too,
// see OperandBoard). At 1.1 the beads are still 55 × 23 pt on 70 pt rods.
export const SHORT_WINDOW_HEIGHT = 750
export const SHORT_WINDOW_BEAD_SCALE = 1.1

// The largest scale, up to `max`, at which `rods` rods fit `width`: the
// frame is its rods plus the deck's and the frame's padding on each side.
export function scaleToFit(rods: number, width: number, max: number): number {
  const natural = rods * ROD_WIDTH + 2 * (DECK_PADDING + FRAME_PADDING)
  return Math.min(max, width / natural)
}

// Bead mode draws the soroban as large as BEAD_MODE_SCALE allows, but a
// 3-digit problem's four rods at that size are wider than a 375 pt phone.
// `width` is the room the soroban has; the frame is its rods plus the deck's
// and the frame's padding on each side.
export function beadModeScale(rods: number, width: number): number {
  return scaleToFit(rods, width, BEAD_MODE_SCALE)
}

export type Geometry = {
  beadWidth: number
  beadHeight: number
  rodWidth: number
  rodLine: number
  heavenHeight: number
  beamHeight: number
  earthHeight: number
  edgeGap: number
  unitDot: number
  framePadding: number
  frameRadius: number
  deckPadding: number
  beamTop: number
  earthTop: number
  columnHeight: number
}

// Every size above, multiplied by `scale`. Scale 1 is today's soroban.
export function geometryFor(scale = 1): Geometry {
  const heavenHeight = HEAVEN_HEIGHT * scale
  const beamHeight = BEAM_HEIGHT * scale
  const earthHeight = EARTH_HEIGHT * scale
  return {
    beadWidth: BEAD_WIDTH * scale,
    beadHeight: BEAD_HEIGHT * scale,
    rodWidth: ROD_WIDTH * scale,
    rodLine: ROD_LINE * scale,
    heavenHeight,
    beamHeight,
    earthHeight,
    edgeGap: EDGE_GAP * scale,
    unitDot: UNIT_DOT * scale,
    framePadding: FRAME_PADDING * scale,
    frameRadius: FRAME_RADIUS * scale,
    deckPadding: DECK_PADDING * scale,
    beamTop: heavenHeight,
    earthTop: heavenHeight + beamHeight,
    columnHeight: heavenHeight + beamHeight + earthHeight,
  }
}

// A bead counts when it touches the beam. That is how a real soroban is read,
// and it is what the reading drill teaches (梁につけた珠だけを数えます).
// Returns each bead's top offset within its rod's column.
export function beadTops(rod: Rod, scale = 1): { heaven: number; earth: number[] } {
  const g = geometryFor(scale)
  const heaven = rod.heaven ? g.beamTop - g.beadHeight : g.edgeGap
  const earth = [0, 1, 2, 3].map((i) =>
    i < rod.earth
      ? g.earthTop + i * g.beadHeight
      : g.columnHeight - g.edgeGap - (4 - i) * g.beadHeight,
  )
  return { heaven, earth }
}

// Which bead a tap at `y` (points from the top of the rod's column) means.
// Above the middle of the beam it is the heaven bead. Below it, it is the
// earth bead whose centre is nearest, so a tap anywhere on the rod picks one.
export function beadAt(rod: Rod, y: number, scale = 1): BeadRef {
  const g = geometryFor(scale)
  if (y < g.beamTop + g.beamHeight / 2) return { kind: 'heaven' }
  const centres = beadTops(rod, scale).earth.map((top) => top + g.beadHeight / 2)
  let nearest = 0
  centres.forEach((centre, index) => {
    const best = centres[nearest] ?? centre
    if (Math.abs(centre - y) < Math.abs(best - y)) nearest = index
  })
  return { kind: 'earth', index: nearest }
}
