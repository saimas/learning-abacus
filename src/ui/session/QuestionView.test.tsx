import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { FRAME_PADDING } from '@/ui/abacus/geometry'
import { QuestionView } from './QuestionView'
import { setBeads } from './testing'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problem = { op: 'add', digits: 3, a: 472, b: 385 } as const

function renderView(overrides: Partial<Parameters<typeof QuestionView>[0]> = {}) {
  const onSubmit = jest.fn()
  const onMoveOn = jest.fn()
  let clock = 1_000
  render(
    <QuestionView
      exercise={exerciseForProblem(problem)}
      fade={0}
      coaching="demo"
      prompt="472に385をたす。"
      demonstration={null}
      renderCorrection={(activeStep) => <Text testID="card">{String(activeStep)}</Text>}
      track={null}
      maru={0}
      shownAt={0}
      now={() => (clock += 1_000)}
      onSubmit={onSubmit}
      onMoveOn={onMoveOn}
      {...overrides}
    />,
  )
  return { onSubmit, onMoveOn }
}

describe('QuestionView with a 3-digit problem', () => {
  it('shows four rods, starting at a', () => {
    renderView()
    expect(screen.getByTestId('rod-3')).toBeTruthy()
    expect(screen.queryByTestId('rod-4')).toBeNull()
    expect(screen.getByTestId('rod-1').props.accessibilityValue.text).toBe('4')
  })

  it('scores a bead answer untimed', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: null, t: expect.any(Number) })
  })

  it('times a keypad answer from shownAt', () => {
    const { onSubmit } = renderView({ fade: 3, coaching: 'silent' })
    for (const digit of '857') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: 2_000, t: 2_000 })
  })

  it('holds a miss for review, with the card up at a coaching level', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
    expect(screen.getByTestId('card')).toBeTruthy()
    expect(screen.getByTestId('review-next')).toBeTruthy()
  })

  it('replays every step of the problem', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    fireEvent.press(screen.getByTestId('review-show'))
    // 472 + 385 is 5 steps: +5 − 2, +10 − 2, +5.
    act(() => jest.advanceTimersByTime(900))
    expect(screen.getByTestId('replay-step').props.children).toBe('1 / 5')
  })
})

describe('QuestionView with a 3×3 multiplication', () => {
  it('shrinks a six-rod soroban to fit in keypad mode', () => {
    // Jest's window is 750 pt wide, which fits six rods at scale 1: mock a
    // phone-width window so the shrink actually has to happen. `require`
    // reaches the exact module object QuestionView's own import reads from,
    // which a fresh `import` here would not necessarily share.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 })
    render(
      <QuestionView
        exercise={exerciseForProblem({ op: 'mul', digits: 3, a: 472, b: 385 })}
        fade={3}
        coaching="silent"
        prompt="472に385をかける。"
        demonstration={null}
        renderCorrection={() => null}
        track={null}
        maru={0}
        shownAt={0}
        now={() => 0}
        onSubmit={jest.fn()}
        onMoveOn={jest.fn()}
      />,
    )
    const padding = StyleSheet.flatten(screen.getByTestId('abacus-frame').props.style).padding
    expect(padding).toBeLessThan(FRAME_PADDING)
    spy.mockRestore()
  })
})
