import { render, screen } from '@testing-library/react-native'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress } from '@/domain/progress'
import { PracticeTable, practiceStage } from './PracticeTable'

describe('practiceStage', () => {
  it('names where a kind stands by its fade level', () => {
    expect(practiceStage(undefined)).toBe('unseen')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 2 })).toBe('beads')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 3 })).toBe('fading')
    expect(practiceStage({ ...newPracticeRecord(0), fade: 6 })).toBe('mental')
  })
})

describe('PracticeTable', () => {
  it('shows a cell per kind, labelled for VoiceOver', () => {
    const progress = { ...emptyProgress(), practices: { 'add:2': { ...newPracticeRecord(0), fade: 4 as const } } }
    render(<PracticeTable progress={progress} />)
    expect(screen.getByTestId('practice-cell-add:2').props.accessibilityLabel).toBe('2けたのたし算、うすい珠')
    expect(screen.getByTestId('practice-cell-sub:3').props.accessibilityLabel).toBe('3けたのひき算、まだ')
  })
})
