import { fireEvent, render, screen, within } from '@testing-library/react-native'
import type { SessionItem, SessionPlan } from '@/domain/session'
import { PartChooser } from './PartChooser'

const item = (atomId: string): SessionItem => ({ atomId, fade: 0, coaching: 'demo' })

// Day two: three moves are due, today's two new moves are in focus, and
// nothing is fluent enough to fade yet.
const today: SessionPlan = {
  blocks: [
    { kind: 'warmup', seconds: 45, items: [item('0+1'), item('0+2'), item('1+1')] },
    { kind: 'focus', seconds: 120, items: [item('0+3'), item('0+4')] },
    { kind: 'faderep', seconds: 90, items: [] },
    { kind: 'close', seconds: 30, items: [] },
  ],
  totalSeconds: 285,
}

function renderChooser(plan: SessionPlan | null = today) {
  const onChoose = jest.fn()
  const onClose = jest.fn()
  render(<PartChooser plan={plan} onChoose={onChoose} onClose={onClose} />)
  return { onChoose, onClose }
}

describe('PartChooser', () => {
  it('is not shown without a plan', () => {
    renderChooser(null)
    expect(screen.queryByTestId('part-chooser')).toBeNull()
  })

  it('asks what to practise', () => {
    renderChooser()
    expect(within(screen.getByTestId('part-chooser')).getByText('なにを練習しますか')).toBeTruthy()
  })

  it('offers the full session and each part, with what each holds', () => {
    renderChooser()
    const row = (testID: string) => within(screen.getByTestId(testID))
    expect(row('choose-all').getByText('ぜんぶ')).toBeTruthy()
    expect(row('choose-all').getByText('準備 → 集中 → 暗算・5分')).toBeTruthy()
    expect(row('choose-warmup').getByText('準備だけ')).toBeTruthy()
    expect(row('choose-warmup').getByText('おさらい・3つの動き')).toBeTruthy()
    expect(row('choose-focus').getByText('集中だけ')).toBeTruthy()
    expect(row('choose-focus').getByText('新しい動きと苦手な動き')).toBeTruthy()
    expect(row('choose-faderep').getByText('暗算だけ')).toBeTruthy()
    expect(row('choose-faderep').getByText('今はありません')).toBeTruthy()
  })

  it('cannot choose a part with nothing in it', () => {
    const { onChoose } = renderChooser()
    expect(screen.getByTestId('choose-faderep').props.accessibilityState).toMatchObject({ disabled: true })
    expect(screen.getByTestId('choose-warmup').props.accessibilityState).toMatchObject({ disabled: false })
    fireEvent.press(screen.getByTestId('choose-faderep'))
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('reports the choice', () => {
    const { onChoose } = renderChooser()
    fireEvent.press(screen.getByTestId('choose-all'))
    expect(onChoose).toHaveBeenLastCalledWith('all')
    fireEvent.press(screen.getByTestId('choose-focus'))
    expect(onChoose).toHaveBeenLastCalledWith('focus')
    fireEvent.press(screen.getByTestId('choose-warmup'))
    expect(onChoose).toHaveBeenLastCalledWith('warmup')
  })

  it('closes, starting nothing, when the dimmed area is tapped', () => {
    const { onChoose, onClose } = renderChooser()
    fireEvent.press(screen.getByTestId('chooser-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onChoose).not.toHaveBeenCalled()
  })
})
