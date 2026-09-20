import { render } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import { newRecord } from '@/domain/fluency'
import { AtomGrid, cellState } from './AtomGrid'

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

describe('AtomGrid', () => {
  it('renders a cell for every atom in the alphabet', () => {
    const { getAllByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getAllByTestId(/^atom-cell-/)).toHaveLength(180)
  })

  it('summarises how many are mastered', () => {
    const { getByTestId } = render(<AtomGrid progress={emptyProgress()} />)
    expect(getByTestId('atom-summary').props.children).toContain('180手中 0手')
  })
})
