import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from './Abacus'
import { BEAD_HEIGHT, BEAM_TOP, EARTH_TOP } from './geometry'

function topOf(element: { props: { style?: unknown } } | undefined): number | undefined {
  // StyleSheet.flatten<T> is an unconstrained generic, so deriving its
  // parameter type via `Parameters<typeof StyleSheet.flatten>[0]` resolves T
  // to `{}` under this TS version, and the call then returns `{}`, which has
  // no `top` property. Naming the shape we actually read sidesteps that.
  const style = StyleSheet.flatten<{ top?: number }>(element?.props.style as { top?: number })
  return style?.top
}

describe('Abacus', () => {
  it('renders one rod per column', () => {
    const { getAllByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={0} />)
    expect(getAllByTestId(/^rod-/)).toHaveLength(2)
  })

  it('renders the frame at F5 but not at F6', () => {
    const framed = render(<Abacus soroban={emptySoroban(2)} fade={5} />)
    expect(framed.queryByTestId('abacus-frame')).not.toBeNull()

    const hidden = render(<Abacus soroban={emptySoroban(2)} fade={6} />)
    expect(hidden.queryByTestId('abacus-frame')).toBeNull()
  })

  it('reflects the value it is given', () => {
    const { getByTestId } = render(<Abacus soroban={setValue(emptySoroban(2), 47)} fade={0} />)
    expect(getByTestId('rod-0').props.accessibilityValue.text).toBe('4')
    expect(getByTestId('rod-1').props.accessibilityValue.text).toBe('7')
  })

  it('shows value by position: counted beads touch the beam', () => {
    const { getAllByTestId } = render(<Abacus soroban={setValue(emptySoroban(1), 7)} fade={0} />)
    expect(topOf(getAllByTestId('bead-heaven')[0])).toBe(BEAM_TOP - BEAD_HEIGHT)
    const earth = getAllByTestId('bead-earth').map(topOf)
    expect(earth[0]).toBe(EARTH_TOP)
    expect(earth[1]).toBe(EARTH_TOP + BEAD_HEIGHT)
    expect(earth[2]).toBeGreaterThan(EARTH_TOP + 2 * BEAD_HEIGHT)
  })

  it('keeps the rods and beam at F5 while only the beads vanish', () => {
    // F5 is "empty frame": the learner needs rods to imagine beads on.
    const { getByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={5} />)
    expect(getByTestId('deck-lines')).toBeTruthy()
    expect(getByTestId('frame-rod-1')).toBeTruthy()
    expect(getByTestId('fade-layer').props.style).toEqual(expect.objectContaining({ opacity: 0 }))
  })

  it('keeps its layout at F6 so the prompt and keypad do not jump', () => {
    const { getAllByTestId, queryByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={6} />)
    expect(queryByTestId('deck-lines')).toBeNull()
    expect(getAllByTestId(/^rod-/)).toHaveLength(2)
  })

  it('marks the ones rod on the beam', () => {
    const { getByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={0} />)
    expect(getByTestId('unit-dot')).toBeTruthy()
  })

  it('makes no bead a button', () => {
    const { queryAllByRole } = render(<Abacus soroban={setValue(emptySoroban(2), 47)} fade={0} />)
    expect(queryAllByRole('button')).toHaveLength(0)
  })
})
