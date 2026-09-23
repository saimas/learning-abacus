import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { FRAME_PADDING } from '@/ui/abacus/geometry'
import { colors } from '@/ui/theme'
import { QuestionView } from './QuestionView'
import { setBeads, textOf } from './testing'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const problem = { op: 'add', digits: 3, a: 472, b: 385 } as const

// The four rods, highest place first, as the soroban reads.
const rods = () => [0, 1, 2, 3].map((index) => screen.getByTestId(`rod-${index}`).props.accessibilityValue.text).join('')

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
      renderSteps={({ activeStep, showAnswer }) => (
        <Text testID="card">{`${String(activeStep)} ${String(showAnswer)}`}</Text>
      )}
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
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: null, t: expect.any(Number), assisted: false })
  })

  it('times a keypad answer from shownAt', () => {
    const { onSubmit } = renderView({ fade: 3, coaching: 'silent' })
    for (const digit of '857') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({ correct: true, latencyMs: 2_000, t: 2_000, assisted: false })
  })

  it('holds a miss for review, with the card up at a coaching level', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
    expect(screen.getByTestId('card')).toBeTruthy()
    expect(screen.getByTestId('review-next')).toBeTruthy()
  })

  it('steps through every move of the problem', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    // At F0 the panel is open at once, so there is no こたえを見る to press,
    // and the soroban still shows the learner's answer until the first ▶.
    expect(screen.queryByTestId('review-show')).toBeNull()
    expect(screen.getByTestId('step-count').props.children).toBe(' ')
    expect(rods()).toBe('0800')
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')

    // The first ▶ shows where the move begins, with nothing highlighted.
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')

    // 472 + 385 is 5 steps: +5 − 2, +10 − 2, +5.
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('1 / 5')
    expect(rods()).toBe('0972')
    expect(textOf(screen.getByTestId('card'))).toBe('0 true')

    fireEvent.press(screen.getByTestId('step-back'))
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')
  })

  // The lines scroll with the prompt, but ◀ ▶ stay in the fixed area above
  // つぎへ, so they cannot scroll off a short phone.
  it.each([
    ['bead', 0, 'demo'],
    ['keypad', 3, 'silent'],
  ] as const)('pins the step controls outside the scrolling text in %s mode', (_mode, fade, coaching) => {
    renderView({ fade, coaching })
    if (fade === 0) {
      setBeads(screen.getByTestId, 800, 4)
    } else {
      for (const digit of '800') fireEvent.press(screen.getByTestId(`key-${digit}`))
    }
    fireEvent.press(screen.getByTestId('submit'))
    if (coaching === 'silent') fireEvent.press(screen.getByTestId('review-show'))
    const scroll = screen.getByTestId('question-scroll')
    expect(within(scroll).getByTestId('step-panel')).toBeTruthy()
    expect(within(scroll).queryByTestId('step-next')).toBeNull()
    expect(screen.getByTestId('step-next')).toBeTruthy()
  })

  it('opens the panel from こたえを見る at a silent level', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('step-panel')).toBeNull()
    expect(textOf(screen.getByTestId('review-show'))).toBe('こたえを見る')

    fireEvent.press(screen.getByTestId('review-show'))
    expect(screen.getByTestId('step-panel')).toBeTruthy()
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')
    // Once the panel is open, つぎへ is all that is left to press.
    expect(screen.queryByTestId('review-show')).toBeNull()
    expect(screen.getByTestId('review-next')).toBeTruthy()
  })

  it('ignores つぎへ in the moment after こたえを見る, since つぎへ widens into its place', () => {
    let clock = 0
    const { onMoveOn } = renderView({ fade: 2, coaching: 'silent', now: () => clock })
    setBeads(screen.getByTestId, 800, 4)
    clock = 1_000
    fireEvent.press(screen.getByTestId('submit'))
    clock = 2_000
    fireEvent.press(screen.getByTestId('review-show'))
    clock = 2_200
    fireEvent.press(screen.getByTestId('review-next'))
    expect(onMoveOn).not.toHaveBeenCalled()
    clock = 2_500
    fireEvent.press(screen.getByTestId('review-next'))
    expect(onMoveOn).toHaveBeenCalledWith(2_500)
  })
})

// Spec (core rounds) §4: 手順を見る opens the same step panel before an
// answer, without the answer, and とじる gives the question back as the
// learner left it. §5: an answer given after it counts "with help".
describe('QuestionView before an answer, with 手順を見る', () => {
  const opacity = () => screen.getByTestId('fade-layer').props.style.opacity as number
  const edge = () => StyleSheet.flatten(screen.getByTestId('step-panel').props.style).borderLeftColor

  it('opens the steps before answering, without the answer', () => {
    renderView()
    const scroll = screen.getByTestId('question-scroll')
    expect(within(scroll).getByTestId('steps-open')).toBeTruthy()

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(within(scroll).getByTestId('step-panel')).toBeTruthy()
    expect(textOf(screen.getByTestId('card'))).toBe('undefined false')
    // Nothing has been got wrong, so the lines carry no correction edge.
    expect(edge()).not.toBe(colors.accent)
    expect(screen.queryByTestId('steps-open')).toBeNull()
    // The answer waits until とじる, and the soroban shows the steps rather
    // than taking taps.
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(screen.queryByTestId('reset-beads')).toBeNull()
    expect(screen.getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    // The controls are pinned outside the scrolling text, with とじる.
    expect(within(scroll).queryByTestId('step-next')).toBeNull()
    expect(screen.getByTestId('steps-close')).toBeTruthy()

    // The first ▶ shows the start, the next the first move: 472 + 385 begins
    // with +5 on the hundreds rod.
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('1 / 5')
    expect(rods()).toBe('0972')
    expect(textOf(screen.getByTestId('card'))).toBe('0 false')
  })

  it('puts the keypad away while the steps are open, and draws them solid', () => {
    renderView({ fade: 3, coaching: 'silent' })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('key-1')).toBeNull()
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(within(screen.getByTestId('question-scroll')).queryByTestId('step-next')).toBeNull()
    expect(screen.getByTestId('steps-close')).toBeTruthy()
    expect(opacity()).toBe(0.35)

    fireEvent.press(screen.getByTestId('step-next'))
    expect(opacity()).toBe(1)
    fireEvent.press(screen.getByTestId('step-next'))
    expect(rods()).toBe('0972')
  })

  it("closes the steps and gives back the learner's beads", () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('steps-open'))
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-next'))
    expect(rods()).toBe('0972')

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.queryByTestId('step-panel')).toBeNull()
    expect(screen.queryByTestId('steps-close')).toBeNull()
    expect(rods()).toBe('0800')
    expect(screen.getByTestId('rod-1').props.accessibilityRole).toBe('adjustable')
    expect(screen.getByTestId('submit').props.accessibilityState).toMatchObject({ disabled: false })
    expect(screen.getByTestId('reset-beads')).toBeTruthy()
    expect(screen.getByTestId('steps-open')).toBeTruthy()
  })

  it('closes the steps and gives back the typed answer', () => {
    renderView({ fade: 3, coaching: 'silent' })
    for (const digit of '85') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('steps-open'))
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.getByTestId('answer-readout').props.children).toBe('85')
    expect(screen.getByTestId('key-1')).toBeTruthy()
    // Closing leaves the stepping behind: the soroban is the question's again.
    expect(opacity()).toBe(0.35)
  })

  it('marks an answer after 手順を見る as with help', () => {
    const helped = renderView()
    fireEvent.press(screen.getByTestId('steps-open'))
    fireEvent.press(screen.getByTestId('steps-close'))
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(helped.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: true }))

    screen.unmount()
    const unhelped = renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(unhelped.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: false }))
  })

  // とじる sits at the bottom right in keypad mode, and closing brings the
  // pad back with こたえる right under it.
  it('ignores こたえる in the moment after とじる, so a double tap cannot hand in the answer', () => {
    let clock = 0
    const { onSubmit } = renderView({ fade: 3, coaching: 'silent', now: () => clock })
    for (const digit of '857') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('steps-open'))
    clock = 1_000
    fireEvent.press(screen.getByTestId('steps-close'))
    clock = 1_200
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).not.toHaveBeenCalled()
    clock = 1_500
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: true }))
  })

  it("starts the review of a miss after 手順を見る from the learner's beads", () => {
    const { onSubmit } = renderView()
    fireEvent.press(screen.getByTestId('steps-open'))
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('step-next'))
    fireEvent.press(screen.getByTestId('steps-close'))
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false, assisted: true }))

    // The review's panel: the answer, the correction edge, no とじる, and
    // nothing stepped yet.
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')
    expect(edge()).toBe(colors.accent)
    expect(screen.queryByTestId('steps-close')).toBeNull()
    expect(screen.queryByTestId('steps-open')).toBeNull()
    expect(screen.getByTestId('step-count').props.children).toBe(' ')
    expect(rods()).toBe('0800')
  })

  it('offers 手順を見る under the demonstration at F0, which the open panel stands in for', () => {
    renderView({ demonstration: '385は…' })
    expect(screen.getByTestId('demonstration')).toBeTruthy()
    expect(screen.getByTestId('steps-open')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('demonstration')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.getByTestId('demonstration')).toBeTruthy()
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
        renderSteps={() => null}
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
