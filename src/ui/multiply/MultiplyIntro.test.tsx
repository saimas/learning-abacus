import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { tintedBeads } from '@/ui/session/testing'
import { REPLAY_STEP_MS } from '@/ui/session/useMoveReplay'
import { MultiplyIntro } from './MultiplyIntro'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The product soroban's rods: the operand board under it has rods of its own.
const rod = (i: number) =>
  within(screen.getByTestId('intro-soroban')).getByTestId(`rod-${i}`).props.accessibilityValue.text
const lit = (name: 'a' | 'b') =>
  [0, 1].filter((i) => within(screen.getByTestId(`operand-${name}`)).queryByTestId(`rod-highlight-${i}`) !== null)

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

  // The owner's request (2026-09-23): the two numbers show on beads under the
  // soroban, and each 九九's page points at its two digits for the whole page.
  it('shows 47 and 36 under the soroban, pointing at the digits of each 九九', () => {
    render(<MultiplyIntro finishLabel="はじめる" onFinish={jest.fn()} />)
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('47 × 36')
    expect([lit('a'), lit('b')]).toEqual([[], []])
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[], []])

    // 4 × 3: the tens of each, while its beads play and after.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    playOut()
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    // 4 × 6, 7 × 3, 7 × 6.
    const rest = [
      [[0], [1]],
      [[1], [0]],
      [[1], [1]],
    ]
    for (const expected of rest) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
      expect([lit('a'), lit('b')]).toEqual(expected)
    }
    // The result page points at nothing.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect([lit('a'), lit('b')]).toEqual([[], []])
  })

  // The owner's request (2026-09-23): the beads a 九九 moves are red while
  // its page is open, the latest step's the deepest, as when stepping.
  it('colours the beads of the 九九 on show, and only while its page is open', () => {
    const tinted = () => tintedBeads(screen.getByTestId('intro-soroban'), 4)
    render(<MultiplyIntro finishLabel="はじめる" onFinish={jest.fn()} />)
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])

    // 4×3 = 12: nothing has moved as the page opens, then 1 on the 千 rod,
    // then 2 on the 百 rod.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])
    act(() => {
      jest.advanceTimersByTime(REPLAY_STEP_MS)
    })
    expect(tinted()).toEqual(['0 earth0 latest'])
    playOut()
    // Played out, the whole 九九 stays coloured until the next page.
    expect([0, 1, 2, 3].map(rod)).toEqual(['1', '2', '0', '0'])
    expect(tinted()).toEqual(['0 earth0 group', '1 earth0 latest', '1 earth1 latest'])

    // 4×6 = 24 starts from the 4×3's beads, back in wood.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(tinted()).toEqual([])
    playOut()
    // +2 on the 百 rod, then +4 on the 十 rod.
    expect(tinted()).toEqual([
      '1 earth2 group',
      '1 earth3 group',
      '2 earth0 latest',
      '2 earth1 latest',
      '2 earth2 latest',
      '2 earth3 latest',
    ])

    for (let i = 0; i < 2; i++) {
      fireEvent.press(screen.getByTestId('intro-next'))
      playOut()
    }
    // The result page colours nothing.
    fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByTestId('intro-text').props.children).toBe('47×36 = 1692')
    expect(tinted()).toEqual([])
  })

  it('labels its last button as it is told', () => {
    render(<MultiplyIntro finishLabel="おわる" onFinish={jest.fn()} />)
    for (let i = 0; i < 6; i++) fireEvent.press(screen.getByTestId('intro-next'))
    expect(screen.getByText('おわる')).toBeTruthy()
  })
})
