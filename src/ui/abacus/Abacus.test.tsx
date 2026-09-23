import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { emptySoroban, rodFor, setValue } from '@/domain/soroban'
import { colors } from '@/ui/theme'
import { Abacus, tintsFor } from './Abacus'
import { BEAD_HEIGHT, BEAD_MODE_SCALE, BEAM_TOP, EARTH_TOP, beadTops } from './geometry'

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
    expect(getAllByTestId(/^rod-\d+$/)).toHaveLength(2)
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
    expect(getAllByTestId(/^rod-\d+$/)).toHaveLength(2)
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

// The operand board points at the two digits of the 九九 on show by
// highlighting their rods.
describe('highlighted rods', () => {
  it('draws a soft band behind each listed rod and no other', () => {
    const { getByTestId, queryAllByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(3), 472)} fade={0} highlightRods={[0, 2]} />,
    )
    expect(queryAllByTestId(/^rod-highlight-/).map((band) => band.props.testID)).toEqual([
      'rod-highlight-0',
      'rod-highlight-2',
    ])
    expect(StyleSheet.flatten(getByTestId('rod-highlight-2').props.style).backgroundColor).toBe(colors.accentSoft)
  })

  it('puts the band around its rod, under the rod line and the beads', () => {
    const { getByTestId } = render(<Abacus soroban={emptySoroban(3)} fade={0} highlightRods={[1]} />)
    const band = StyleSheet.flatten<{ left: number; width: number }>(getByTestId('rod-highlight-1').props.style)
    const line = StyleSheet.flatten<{ left: number; width: number }>(getByTestId('frame-rod-1').props.style)
    expect(band.left).toBeLessThan(line.left)
    expect(band.left + band.width).toBeGreaterThan(line.left + line.width)
    // Drawn before the rod lines and the beam in the static layer, which is
    // itself under the bead layer, so neither the beam nor a bead is hidden.
    const layer = getByTestId('deck-lines').children.map((child) =>
      typeof child === 'string' ? child : child.props.testID,
    )
    expect(layer.indexOf('rod-highlight-1')).toBeLessThan(layer.indexOf('frame-rod-0'))
  })

  it('highlights nothing without the prop', () => {
    const { queryAllByTestId } = render(<Abacus soroban={emptySoroban(3)} fade={0} />)
    expect(queryAllByTestId(/^rod-highlight-/)).toHaveLength(0)
  })
})

// The owner's request (2026-09-23): while stepping, the beads the current
// operation has moved are red, the latest step's the deepest.
describe('tinted beads', () => {
  type Node = ReturnType<typeof screen.getByTestId>
  // Each rod's beads, heaven first, then earth from the beam out.
  const beadsOn = (rod: number) =>
    within(screen.getByTestId(`rod-${rod}`))
      .getAllByTestId(/^bead-/)
      .map((bead) => bead.props.testID as string)
  // The three stops of the gradient a bead is filled with.
  const stopsOf = (bead: Node) => {
    const host = (node: Node) => typeof node.type === 'string'
    const fill = bead.findAll((node) => host(node) && typeof node.props.fill === 'string')[0]?.props.fill as string
    const id = fill.replace(/^url\(#(.*)\)$/, '$1')
    const gradient = bead.findAll((node) => host(node) && node.props.id === id)[0]
    return gradient?.findAll((node) => host(node) && node.props.stopColor !== undefined).map((stop) => stop.props.stopColor)
  }

  it('marks each listed bead with its tint, on its own rod only', () => {
    render(
      <Abacus
        soroban={setValue(emptySoroban(2), 7)}
        fade={0}
        tintedBeads={[
          { rod: 1, bead: { kind: 'heaven' }, tint: 'group' },
          { rod: 1, bead: { kind: 'earth', index: 1 }, tint: 'latest' },
        ]}
      />,
    )
    expect(beadsOn(0)).toEqual(['bead-heaven', 'bead-earth', 'bead-earth', 'bead-earth', 'bead-earth'])
    expect(beadsOn(1)).toEqual(['bead-heaven-group', 'bead-earth', 'bead-earth-latest', 'bead-earth', 'bead-earth'])
  })

  it('draws the latest step deepest where a bead is listed as both', () => {
    render(
      <Abacus
        soroban={emptySoroban(1)}
        fade={0}
        tintedBeads={[
          { rod: 0, bead: { kind: 'earth', index: 0 }, tint: 'latest' },
          { rod: 0, bead: { kind: 'earth', index: 0 }, tint: 'group' },
        ]}
      />,
    )
    expect(beadsOn(0)).toEqual(['bead-heaven', 'bead-earth-latest', 'bead-earth', 'bead-earth', 'bead-earth'])
  })

  it('fills a bead with wood, the operation’s red, or the latest step’s deeper red', () => {
    render(
      <Abacus
        soroban={emptySoroban(1)}
        fade={0}
        tintedBeads={[
          { rod: 0, bead: { kind: 'heaven' }, tint: 'latest' },
          { rod: 0, bead: { kind: 'earth', index: 0 }, tint: 'group' },
        ]}
      />,
    )
    expect(stopsOf(screen.getByTestId('bead-heaven-latest'))).toEqual([
      colors.beadLatestHighlight,
      colors.accent,
      colors.accentShadow,
    ])
    expect(stopsOf(screen.getByTestId('bead-earth-group'))).toEqual([
      colors.beadGroupHighlight,
      colors.beadGroup,
      colors.beadGroupShade,
    ])
    expect(stopsOf(screen.getAllByTestId('bead-earth')[0] as Node)).toEqual([
      colors.beadHighlight,
      colors.bead,
      colors.beadShade,
    ])
  })

  it('gives each tint its own gradient id', () => {
    // No two different gradients on screen share a name (see Bead).
    render(
      <Abacus
        soroban={emptySoroban(1)}
        fade={0}
        tintedBeads={[
          { rod: 0, bead: { kind: 'heaven' }, tint: 'latest' },
          { rod: 0, bead: { kind: 'earth', index: 0 }, tint: 'group' },
        ]}
      />,
    )
    const fills = ['bead-heaven-latest', 'bead-earth-group'].map(
      (testID) =>
        screen.getByTestId(testID).findAll((node) => typeof node.type === 'string' && node.props.fill !== undefined)[0]
          ?.props.fill,
    )
    const wood = screen
      .getAllByTestId('bead-earth')[0]
      ?.findAll((node) => typeof node.type === 'string' && node.props.fill !== undefined)[0]?.props.fill
    expect(new Set([...fills, wood]).size).toBe(3)
  })

  it('tints nothing without the prop', () => {
    render(<Abacus soroban={setValue(emptySoroban(2), 47)} fade={0} />)
    expect(beadsOn(0)).toEqual(['bead-heaven', 'bead-earth', 'bead-earth', 'bead-earth', 'bead-earth'])
    expect(beadsOn(1)).toEqual(['bead-heaven', 'bead-earth', 'bead-earth', 'bead-earth', 'bead-earth'])
  })

  it('turns a step colouring into tints, the latest step’s over the operation’s', () => {
    const heaven = { rod: 0, bead: { kind: 'heaven' } } as const
    const earth = { rod: 1, bead: { kind: 'earth', index: 2 } } as const
    expect(tintsFor({ group: [heaven, earth], latest: [earth] })).toEqual([
      { ...heaven, tint: 'group' },
      { ...earth, tint: 'group' },
      { ...earth, tint: 'latest' },
    ])
  })
})

describe('interactive Abacus', () => {
  it('reports the bead under a tap', () => {
    const onTapBead = jest.fn()
    const { getByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(2), 7)} fade={0} onTapBead={onTapBead} onAdjustRod={jest.fn()} />,
    )
    fireEvent.press(getByTestId('rod-1'), { nativeEvent: { locationY: 5 } })
    expect(onTapBead).toHaveBeenCalledWith(1, { kind: 'heaven' })

    const top = beadTops(rodFor(0)).earth[0] ?? 0
    fireEvent.press(getByTestId('rod-0'), { nativeEvent: { locationY: top + 3 } })
    expect(onTapBead).toHaveBeenLastCalledWith(0, { kind: 'earth', index: 0 })
  })

  it('makes each rod an adjustable value for VoiceOver', () => {
    const onAdjustRod = jest.fn()
    const { getByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(2), 7)} fade={0} onTapBead={jest.fn()} onAdjustRod={onAdjustRod} />,
    )
    const ones = getByTestId('rod-1')
    expect(ones.props.accessibilityRole).toBe('adjustable')
    expect(ones.props.accessibilityLabel).toBe('一の位')
    expect(getByTestId('rod-0').props.accessibilityLabel).toBe('十の位')

    fireEvent(ones, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(onAdjustRod).toHaveBeenCalledWith(1, 1)
    fireEvent(getByTestId('rod-1'), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
    expect(onAdjustRod).toHaveBeenLastCalledWith(1, -1)
  })

  it('makes VoiceOver activation a no-op on an adjustable rod', () => {
    // With no activation handling, iOS VoiceOver's double-tap falls back, at
    // the native layer, to a synthetic tap at the rod's centre and moves an
    // earth bead by accident. RNTL/react-test-renderer has no way to
    // reproduce that native fallback (firing the synthetic 'accessibilityTap'
    // event only calls a handler that is already present; it never exercises
    // the no-handler fallback), so this test guards the contract instead:
    // the adjustable rod wires an onAccessibilityTap handler and that
    // handler does nothing, rather than falling through to onPress.
    const onTapBead = jest.fn()
    const { getByTestId } = render(
      <Abacus soroban={setValue(emptySoroban(2), 7)} fade={0} onTapBead={onTapBead} onAdjustRod={jest.fn()} />,
    )
    const rod = getByTestId('rod-1')
    expect(typeof rod.props.onAccessibilityTap).toBe('function')
    rod.props.onAccessibilityTap()
    expect(onTapBead).not.toHaveBeenCalled()
  })

  it('has no adjustable rods without handlers', () => {
    const { getByTestId } = render(<Abacus soroban={emptySoroban(2)} fade={0} />)
    expect(getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
  })

  it('draws bead-mode beads larger', () => {
    const { getAllByTestId } = render(
      <Abacus soroban={emptySoroban(1)} fade={0} scale={BEAD_MODE_SCALE} />,
    )
    const style = StyleSheet.flatten(getAllByTestId('bead-earth')[0]?.props.style)
    expect(style.width).toBeCloseTo(69)
  })
})
