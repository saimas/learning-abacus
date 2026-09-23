import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { REPLAY_STEP_MS } from '@/ui/session/useMoveReplay'
import { MultiplyIntro } from './MultiplyIntro'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const rod = (i: number) => screen.getByTestId(`rod-${i}`).props.accessibilityValue.text

// Plays a 九九's bead steps to the end. Each step is scheduled by the render
// that shows the one before it, so time passes a step at a time, with a
// render in between, as on a device (see useMoveReplay.test.ts).
function playOut() {
  for (let i = 0; i < 10; i++) {
    act(() => {
      jest.advanceTimersByTime(REPLAY_STEP_MS)
    })
  }
}

describe('MultiplyIntro', () => {
  it('explains the method, then plays 47 × 36 one 九九 at a time, then gives the result', () => {
    const onFinish = jest.fn()
    render(<MultiplyIntro finishLabel="はじめる" onFinish={onFinish} />)
    expect(screen.getByTestId('intro-text').props.children).toContain('両落とし')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toContain('百の位')
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('4×3=12　千の位に1、百の位に2')
    playOut()
    // 1200 on four rods: 千 = 1, 百 = 2.
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '2', '0', '0'])
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
    }
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '6', '9', '2'])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('47×36 = 1692')
    expect(screen.queryByTestId('intro-next')).toBeNull()
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    // A second tap while the screen is on its way out must not finish twice.
    fireEvent.press(screen.getByTestId('intro-finish'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('shows the empty soroban until the first 九九 is played', () => {
    render(<MultiplyIntro finishLabel="はじめる" onFinish={jest.fn()} />)
    expect([0, 1, 2, 3].map(rod)).toEqual(['0', '0', '0', '0'])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([0, 1, 2, 3].map(rod)).toEqual(['0', '0', '0', '0'])
  })

  it('labels its last button as it is told', () => {
    render(<MultiplyIntro finishLabel="おわる" onFinish={jest.fn()} />)
    for (let i = 0; i < 6; i++) fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByText('おわる')).toBeTruthy()
  })
})
