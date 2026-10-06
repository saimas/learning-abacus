import { act, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { Abacus } from './Abacus'
import { BEAD_EASE_MS } from './Rod'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

const opacities = () =>
  screen.getAllByTestId('fade-layer').map((layer) => StyleSheet.flatten(layer.props.style).opacity)

const soroban = setValue(emptySoroban(2), 7)

// Spec (runs) §5: on the first problem at a new look, the beads ease from
// the old one, so the fade is seen happening.
describe('Abacus easing its fade', () => {
  it('eases the beads to a new level instead of jumping', () => {
    render(<Abacus soroban={soroban} fade={2} easeFade />)
    expect(opacities()).toEqual([1, 1])
    screen.rerender(<Abacus soroban={soroban} fade={3} easeFade />)
    expect(opacities()).toEqual([1, 1])
    passTime(BEAD_EASE_MS + 100)
    expect(opacities()).toEqual([0.35, 0.35])
  })

  it('jumps without easeFade, as always', () => {
    render(<Abacus soroban={soroban} fade={2} />)
    screen.rerender(<Abacus soroban={soroban} fade={3} />)
    expect(opacities()).toEqual([0.35, 0.35])
  })
})
