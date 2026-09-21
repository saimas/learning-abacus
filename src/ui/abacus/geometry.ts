import type { Rod } from '@/domain/soroban'

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

// A bead counts when it touches the beam. That is how a real soroban is read,
// and it is what the reading drill teaches (梁につけた珠だけを数えます).
// Returns each bead's top offset within its rod's column.
export function beadTops(rod: Rod): { heaven: number; earth: number[] } {
  const heaven = rod.heaven ? BEAM_TOP - BEAD_HEIGHT : EDGE_GAP
  const earth = [0, 1, 2, 3].map((i) =>
    i < rod.earth
      ? EARTH_TOP + i * BEAD_HEIGHT
      : COLUMN_HEIGHT - EDGE_GAP - (4 - i) * BEAD_HEIGHT,
  )
  return { heaven, earth }
}
