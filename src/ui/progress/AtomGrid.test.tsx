import { render, within } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import { newRecord } from '@/domain/fluency'
import { AtomGrid, atomStates, cellState, mentalCount } from './AtomGrid'

const NOW = 1_700_000_000_000

describe('cellState', () => {
  it('is unseen with no record', () => {
    expect(cellState(undefined, 'direct', 900)).toBe('unseen')
  })

  it('is learning for a fresh record', () => {
    expect(cellState(newRecord('1+3', NOW), 'direct', 900)).toBe('learning')
  })

  it('is reflex when fast and well-boxed', () => {
    const record = { ...newRecord('1+3', NOW), box: 5, recentLatencyMs: [300, 300, 300, 300, 300] }
    expect(cellState(record, 'direct', 900)).toBe('reflex')
  })

  it('is mental at full fade', () => {
    const record = {
      ...newRecord('1+3', NOW),
      box: 5,
      fade: 6 as const,
      recentLatencyMs: [300, 300, 300, 300, 300],
    }
    expect(cellState(record, 'direct', 900)).toBe('mental')
  })
})

const MENTAL = {
  ...newRecord('1+3', NOW),
  box: 5,
  fade: 6 as const,
  recentLatencyMs: [300, 300, 300, 300, 300],
}

describe('AtomGrid maps', () => {
  it('places each atom at its rod value (row) and operand (column)', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    const ids = within(getByTestId('atom-row-sub-3'))
      .getAllByTestId(/^atom-cell-/)
      .map((cell) => cell.props.testID)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `atom-cell-3-${n}`))
  })

  it('splits addition and subtraction into two maps of ninety', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    const add = within(getByTestId('atom-map-add')).getAllByTestId(/^atom-cell-/)
    const sub = within(getByTestId('atom-map-sub')).getAllByTestId(/^atom-cell-/)
    expect(add).toHaveLength(90)
    expect(sub).toHaveLength(90)
    expect(add.every((cell) => String(cell.props.testID).includes('+'))).toBe(true)
  })

  it('names the four states in a legend', () => {
    const { getByText } = render(<AtomGrid progress={emptyProgress()} />)
    for (const name of ['未学習', '学習中', '即答', '暗算']) expect(getByText(name)).toBeTruthy()
  })
})

describe('atomStates and mentalCount', () => {
  it('counts the atoms that are fully mental', () => {
    const progress = { ...emptyProgress(), atoms: { '1+3': MENTAL } }
    const states = atomStates(progress)
    expect(Object.keys(states)).toHaveLength(180)
    expect(states['1+3']).toBe('mental')
    expect(mentalCount(states)).toBe(1)
  })
})

describe('AtomGrid', () => {
  it('renders a cell for every atom in the alphabet', () => {
    const { getAllByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getAllByTestId(/^atom-cell-/)).toHaveLength(180)
  })

  it('summarises how many are mastered', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getByTestId('atom-summary').props.children).toContain('180問中 0問')
  })

  it('labels each cell in the active language for screen readers', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getByTestId('atom-cell-1+3').props.accessibilityLabel).toBe('1+3 未学習')
  })
})
