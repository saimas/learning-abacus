import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import { BEAD_OPACITY, FadeLayer, showsFrame } from './FadeLayer'

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

describe('FadeLayer', () => {
  it('renders its children at full opacity for F0', () => {
    const { getByTestId } = render(
      <FadeLayer level={0}>
        <Text>beads</Text>
      </FadeLayer>,
    )
    expect(getByTestId('fade-layer').props.style).toEqual(
      expect.objectContaining({ opacity: 1 }),
    )
  })

  it('renders its children invisible at F6', () => {
    const { getByTestId } = render(
      <FadeLayer level={6}>
        <Text>beads</Text>
      </FadeLayer>,
    )
    expect(getByTestId('fade-layer').props.style).toEqual(
      expect.objectContaining({ opacity: 0 }),
    )
  })
})
