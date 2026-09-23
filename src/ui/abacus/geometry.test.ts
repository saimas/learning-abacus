import { rodFor } from '@/domain/soroban'
import {
  BEAD_HEIGHT,
  BEAD_MODE_SCALE,
  BEAM_TOP,
  COLUMN_HEIGHT,
  EARTH_TOP,
  EDGE_GAP,
  beadAt,
  beadModeScale,
  beadTops,
  geometryFor,
  scaleToFit,
} from './geometry'

describe('beadTops', () => {
  it('rests an inactive heaven bead against the top of the frame', () => {
    expect(beadTops(rodFor(0)).heaven).toBe(EDGE_GAP)
  })

  it('lowers an active heaven bead onto the beam', () => {
    expect(beadTops(rodFor(5)).heaven + BEAD_HEIGHT).toBe(BEAM_TOP)
  })

  it('pushes active earth beads up against the beam, stacked', () => {
    expect(beadTops(rodFor(3)).earth.slice(0, 3)).toEqual([
      EARTH_TOP,
      EARTH_TOP + BEAD_HEIGHT,
      EARTH_TOP + 2 * BEAD_HEIGHT,
    ])
  })

  it('rests inactive earth beads at the bottom of the frame', () => {
    const last = beadTops(rodFor(0)).earth[3] ?? 0
    expect(last + BEAD_HEIGHT).toBe(COLUMN_HEIGHT - EDGE_GAP)
  })

  it('leaves a visible gap between counted and resting earth beads', () => {
    const earth = beadTops(rodFor(2)).earth
    const counted = (earth[1] ?? 0) + BEAD_HEIGHT
    const resting = earth[2] ?? 0
    expect(resting - counted).toBeGreaterThan(BEAD_HEIGHT / 2)
  })
})

describe('geometryFor', () => {
  it('reproduces the base sizes at scale 1', () => {
    const g = geometryFor(1)
    expect(g.beadHeight).toBe(BEAD_HEIGHT)
    expect(g.beamTop).toBe(BEAM_TOP)
    expect(g.earthTop).toBe(EARTH_TOP)
    expect(g.columnHeight).toBe(COLUMN_HEIGHT)
  })

  it('makes bead-mode beads big enough to tap', () => {
    const g = geometryFor(BEAD_MODE_SCALE)
    expect(g.beadWidth).toBeCloseTo(69)
    expect(g.beadHeight).toBeCloseTo(28.98, 1)
    expect(g.rodWidth).toBeCloseTo(88.32, 1)
  })
})

describe('beadTops at a scale', () => {
  it('scales every position', () => {
    const base = beadTops(rodFor(7))
    const big = beadTops(rodFor(7), 2)
    expect(big.heaven).toBe(base.heaven * 2)
    expect(big.earth).toEqual(base.earth.map((top) => top * 2))
  })
})

describe('beadAt', () => {
  it('reads a tap above the beam as the heaven bead', () => {
    expect(beadAt(rodFor(0), 5)).toEqual({ kind: 'heaven' })
  })

  it('reads a tap on a counted earth bead as that bead', () => {
    const top = beadTops(rodFor(3)).earth[1] ?? 0
    expect(beadAt(rodFor(3), top + BEAD_HEIGHT / 2)).toEqual({ kind: 'earth', index: 1 })
  })

  it('reads a tap on a resting earth bead as that bead', () => {
    const top = beadTops(rodFor(1)).earth[3] ?? 0
    expect(beadAt(rodFor(1), top + 2)).toEqual({ kind: 'earth', index: 3 })
  })

  it('picks the nearest bead for a tap in the gap', () => {
    const tops = beadTops(rodFor(2)).earth
    const justBelowBead1 = (tops[1] ?? 0) + BEAD_HEIGHT + 2
    expect(beadAt(rodFor(2), justBelowBead1)).toEqual({ kind: 'earth', index: 1 })
  })

  it('works at bead-mode scale', () => {
    const top = beadTops(rodFor(0), BEAD_MODE_SCALE).earth[0] ?? 0
    expect(beadAt(rodFor(0), top + 5, BEAD_MODE_SCALE)).toEqual({ kind: 'earth', index: 0 })
  })
})

describe('beadModeScale', () => {
  it('keeps the full bead-mode size when the rods fit', () => {
    expect(beadModeScale(2, 335)).toBe(BEAD_MODE_SCALE)
    expect(beadModeScale(3, 335)).toBe(BEAD_MODE_SCALE)
  })

  it('shrinks four rods to fit a 375 pt phone', () => {
    // 4 rods × 64 + 2 × (6 + 10) of deck and frame padding = 288 pt at scale 1.
    expect(beadModeScale(4, 335)).toBeCloseTo(335 / 288)
  })
})

describe('scaleToFit', () => {
  it('never draws larger than the cap', () => {
    expect(scaleToFit(2, 335, 1)).toBe(1)
  })

  it('shrinks six rods to fit a 375 pt phone', () => {
    // 6 × 64 + 2 × (6 + 10) = 416 pt at scale 1.
    expect(scaleToFit(6, 335, 1)).toBeCloseTo(335 / 416)
  })
})
