import { rodFor } from '@/domain/soroban'
import {
  BEAD_HEIGHT,
  BEAM_TOP,
  COLUMN_HEIGHT,
  EARTH_TOP,
  EDGE_GAP,
  beadTops,
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
