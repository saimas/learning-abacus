import { BEAD_OPACITY, showsFrame } from './beadOpacity'

describe('BEAD_OPACITY', () => {
  it('shows beads fully when solid', () => {
    expect(BEAD_OPACITY.solid).toBe(1)
  })

  it('hides beads entirely at frame and hidden', () => {
    expect(BEAD_OPACITY.frame).toBe(0)
    expect(BEAD_OPACITY.hidden).toBe(0)
  })

  it('fades monotonically from solid to ghost', () => {
    expect(BEAD_OPACITY.solid).toBeGreaterThan(BEAD_OPACITY.dim)
    expect(BEAD_OPACITY.dim).toBeGreaterThan(BEAD_OPACITY.ghost)
  })
})

describe('showsFrame', () => {
  it('keeps the frame until everything disappears', () => {
    expect(showsFrame('frame')).toBe(true)
    expect(showsFrame('hidden')).toBe(false)
  })
})
