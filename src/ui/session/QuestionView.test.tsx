import { fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView, StyleSheet, Text } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { BEAD_MODE_SCALE, FRAME_PADDING, SHORT_WINDOW_BEAD_SCALE } from '@/ui/abacus/geometry'
import { BUTTON_HEIGHT } from '@/ui/kit/Button'
import { colors, space } from '@/ui/theme'
import { QuestionView } from './QuestionView'
import { STEP_CONTROLS_HEIGHT } from './StepPanel'
import { setBeads, textOf, tintedBeads } from './testing'
import { useActiveLineLayout } from './useActiveLineLayout'

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
    // At F0 the panel is open at once, so there is no こたえを見る to press.
    // It opens where the move begins, with nothing highlighted, so the
    // first ▶ plays the first move (the owner, 2026-09-24).
    expect(screen.queryByTestId('review-show')).toBeNull()
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

  // The panel opening at the start is not a step, so VoiceOver hears no
  // "0 / 5" as it opens: that would cut off the ✕ and the answer, said in
  // one announcement as the miss lands.
  it('tells VoiceOver nothing of the start as the panel opens', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderView()
      setBeads(screen.getByTestId, 800, 4)
      // The jest setup's announceForAccessibility is already a mock, which
      // the spy hands back with the calls earlier tests made.
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
      expect(announce).toHaveBeenCalledTimes(1)
      expect(announce).not.toHaveBeenCalledWith('0 / 5')
      fireEvent.press(screen.getByTestId('step-next'))
      expect(announce).toHaveBeenLastCalledWith('1 / 5')

      screen.unmount()
      announce.mockClear()
      renderView()
      fireEvent.press(screen.getByTestId('steps-open'))
      expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
      expect(announce).not.toHaveBeenCalled()
    } finally {
      announce.mockRestore()
    }
  })

  // ◀ ▶ stay in the fixed area above つぎへ, so they cannot scroll off a
  // short phone. The lines scroll in their own place below them in bead
  // mode (the owner's request, 2026-09-23), and with the prompt in keypad
  // mode.
  it.each([
    ['bead', 0, 'demo', 'step-lines-scroll'],
    ['keypad', 3, 'silent', 'question-scroll'],
  ] as const)('pins the step controls outside the scrolling text in %s mode', (_mode, fade, coaching, linesScroll) => {
    renderView({ fade, coaching })
    if (fade === 0) {
      setBeads(screen.getByTestId, 800, 4)
    } else {
      for (const digit of '800') fireEvent.press(screen.getByTestId(`key-${digit}`))
    }
    fireEvent.press(screen.getByTestId('submit'))
    if (coaching === 'silent') fireEvent.press(screen.getByTestId('review-show'))
    const scroll = screen.getByTestId(linesScroll)
    expect(within(scroll).getByTestId('step-panel')).toBeTruthy()
    expect(within(scroll).queryByTestId('step-next')).toBeNull()
    expect(within(screen.getByTestId('question-scroll')).queryByTestId('step-next')).toBeNull()
    expect(screen.getByTestId('step-next')).toBeTruthy()
  })

  it('opens the panel from こたえを見る at a silent level', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('step-panel')).toBeNull()
    expect(textOf(screen.getByTestId('review-show'))).toBe('こたえを見る')
    // Until then the ✕ sits on the learner's own answer.
    expect(rods()).toBe('0800')

    fireEvent.press(screen.getByTestId('review-show'))
    expect(screen.getByTestId('step-panel')).toBeTruthy()
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')
    // Open at the start, as at F0–F1, so one ▶ plays the first move.
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('1 / 5')
    expect(rods()).toBe('0972')
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
    expect(screen.getByTestId('steps-open')).toBeTruthy()

    fireEvent.press(screen.getByTestId('steps-open'))
    // Bead mode: the lines scroll on their own, below the controls.
    expect(within(screen.getByTestId('step-lines-scroll')).getByTestId('step-panel')).toBeTruthy()
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

    // The owner's request (2026-09-24): the steps are ready as they open,
    // at the start, so the first ▶ plays the first move: 472 + 385 begins
    // with +5 on the hundreds rod.
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
    expect(textOf(screen.getByTestId('card'))).toBe('undefined false')
    fireEvent.press(screen.getByTestId('step-next'))
    expect(screen.getByTestId('step-count').props.children).toBe('1 / 5')
    expect(rods()).toBe('0972')
    expect(textOf(screen.getByTestId('card'))).toBe('0 false')
  })

  // The lines below the controls take the もどす/こたえる row's place while
  // open, starting from its height, so no empty row is left at the bottom.
  // Where there is room they take all the height left anyway (the top
  // scroll fits the prompt); on a screen too short for everything the row's
  // height is the least they keep, and the prompt's scroll gives way by as
  // much as it does for the row itself with the steps closed, so the
  // soroban does not move there either.
  it('holds the answer row height in bead mode while the steps are open', () => {
    renderView()
    expect(screen.queryByTestId('step-lines')).toBeNull()
    expect(screen.getByTestId('submit')).toBeTruthy()

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(StyleSheet.flatten(screen.getByTestId('step-lines').props.style)).toEqual({
      flex: 1,
      flexBasis: space.md + BUTTON_HEIGHT,
    })
    expect(screen.queryByTestId('answer-row-placeholder')).toBeNull()

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.queryByTestId('step-lines')).toBeNull()
  })

  it('puts the keypad away while the steps are open, and draws them solid', () => {
    renderView({ fade: 3, coaching: 'silent' })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('key-1')).toBeNull()
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(within(screen.getByTestId('question-scroll')).queryByTestId('step-next')).toBeNull()
    expect(screen.getByTestId('steps-close')).toBeTruthy()
    // Drawn solid from the moment the steps open, at the start.
    expect(opacity()).toBe(1)
    expect(rods()).toBe('0472')

    fireEvent.press(screen.getByTestId('step-next'))
    expect(rods()).toBe('0972')
  })

  it("closes the steps and gives back the learner's beads", () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('steps-open'))
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

  it('starts the review of a miss after 手順を見る afresh, at the start', () => {
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
    // the start on show, whatever was stepped through before the answer.
    expect(textOf(screen.getByTestId('card'))).toBe('undefined true')
    expect(edge()).toBe(colors.accent)
    expect(screen.queryByTestId('steps-close')).toBeNull()
    expect(screen.queryByTestId('steps-open')).toBeNull()
    expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
    expect(rods()).toBe('0472')
  })

  it('offers 手順を見る with the demonstration at F0, which the open panel stands in for', () => {
    renderView({ demonstration: '385は…' })
    expect(screen.getByTestId('demonstration')).toBeTruthy()
    expect(screen.getByTestId('steps-open')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('demonstration')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.getByTestId('demonstration')).toBeTruthy()
  })
})

// The owner's request (2026-09-24): 手順を見る sat under the prompt, while the
// steps it opens appear below the soroban in bead mode. It now sits where
// they appear, in both modes, so the button and what it opens stay together.
describe('QuestionView offering 手順を見る where the steps appear', () => {
  const beneath = () => <Text testID="beneath">board</Text>
  // Every testID on screen, in the order they are drawn.
  const order = () =>
    screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)

  it('offers it below the soroban and the board in bead mode, above もどす and こたえる', () => {
    renderView({ demonstration: '385は…', renderBeneath: beneath })
    const top = within(screen.getByTestId('question-scroll'))
    expect(top.queryByTestId('steps-open')).toBeNull()
    // The demonstration stays under the prompt.
    expect(top.getByTestId('demonstration')).toBeTruthy()
    const drawn = order()
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('soroban-wrap'))
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('beneath'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('reset-beads'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('submit'))
  })

  // It sits at the top of the flexible space the step lines take once open,
  // which keeps just its flex: no padding, margin or minimum height. Where
  // the column is too short for everything, Yoga counts any of them before
  // the prompt's scroll gives way, which it does not for the lines, so the
  // soroban would move as the panel opens. The button inside the space
  // counts for nothing there.
  it('holds it in the flexible space under the soroban, where the lines go', () => {
    renderView()
    const place = screen.getByTestId('bead-spacer')
    expect(within(place).getByTestId('steps-open')).toBeTruthy()
    expect(StyleSheet.flatten(place.props.style)).toEqual({ flex: 1 })

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('bead-spacer')).toBeNull()
    expect(screen.getByTestId('step-lines')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(within(screen.getByTestId('bead-spacer')).getByTestId('steps-open')).toBeTruthy()
  })

  // Where the spare height leaves the space shorter than the button, the
  // button must not spill over もどす and こたえる, which are drawn after it
  // and would take its taps. The space scrolls instead, so a small scroll
  // reaches it. Its outer style is still the spacer's flex alone, so the
  // soroban does not move for it (see above).
  it('lets the button be scrolled to where the space is shorter than it', () => {
    renderView()
    const place = screen.getByTestId('bead-spacer')
    expect(screen.UNSAFE_getAllByType(ScrollView).map((scroll) => scroll.props.testID)).toContain('bead-spacer')
    expect(StyleSheet.flatten(place.props.style)).toEqual({ flex: 1 })
    expect(StyleSheet.flatten(place.props.contentContainerStyle)).toEqual({ flexGrow: 1 })
    expect(place.props.showsVerticalScrollIndicator).toBe(false)
    // On a screen with room there is nothing to scroll, so nothing bounces.
    expect(place.props.alwaysBounceVertical).toBe(false)

    fireEvent.press(within(place).getByTestId('steps-open'))
    expect(screen.getByTestId('step-lines')).toBeTruthy()
  })

  // Under review there is nothing to offer, and the space goes back to
  // being just a spacer.
  it('leaves the space empty under review in bead mode', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('steps-open')).toBeNull()
    expect(StyleSheet.flatten(screen.getByTestId('bead-spacer').props.style)).toEqual({ flex: 1 })
  })

  it('offers it in the scroll after the prompt and the board in keypad mode, where the lines go', () => {
    renderView({ fade: 3, coaching: 'silent', demonstration: '385は…', renderBeneath: beneath })
    expect(within(screen.getByTestId('question-scroll')).getByTestId('steps-open')).toBeTruthy()
    const drawn = order()
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('prompt'))
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('demonstration'))
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('beneath'))

    fireEvent.press(screen.getByTestId('steps-open'))
    const open = order()
    expect(open.indexOf('step-panel')).toBeGreaterThan(open.indexOf('beneath'))
  })
})

// The owner's request (2026-09-23): the step lines sat in the small scroll
// above the soroban, two lines at a time, while the screen below ◀ ▶ was
// empty. In bead mode they now fill that space, scrolling on their own, and
// the line stepped to is scrolled into view. Keypad mode is unchanged.
describe('QuestionView with the step lines below the controls', () => {
  // Every testID on screen, in the order they are drawn.
  const order = () =>
    screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
  const expectLinesBelowControls = () => {
    const lines = screen.getByTestId('step-lines-scroll')
    expect(within(lines).getByTestId('step-panel')).toBeTruthy()
    expect(within(screen.getByTestId('question-scroll')).queryByTestId('step-panel')).toBeNull()
    const drawn = order()
    expect(drawn.indexOf('step-lines-scroll')).toBeGreaterThan(drawn.indexOf('step-next'))
    expect(drawn.indexOf('step-lines-scroll')).toBeGreaterThan(drawn.indexOf('soroban-wrap'))
  }

  it('draws the lines below ◀ ▶ while the steps are open before an answer, and not once closed', () => {
    renderView()
    expect(screen.queryByTestId('step-lines-scroll')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-open'))
    expectLinesBelowControls()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.queryByTestId('step-lines-scroll')).toBeNull()
  })

  it('draws the lines below ◀ ▶ in the review of a miss, with つぎへ below them', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    // Until こたえを見る, nothing is open.
    expect(screen.queryByTestId('step-lines-scroll')).toBeNull()
    fireEvent.press(screen.getByTestId('review-show'))
    expectLinesBelowControls()
    const drawn = order()
    expect(drawn.indexOf('review-next')).toBeGreaterThan(drawn.indexOf('step-lines-scroll'))
    // つぎへ holds its own row below them, so the lines take just the
    // spacer's place, with its flex.
    expect(StyleSheet.flatten(screen.getByTestId('step-lines').props.style)).toEqual({ flex: 1 })
  })

  // The owner's request (2026-09-24): with the steps open, the top scroll
  // kept its flex share and stood mostly empty under the prompt, while the
  // lines below ◀ ▶ were cut off. So in bead mode the top scroll became only
  // as tall as what it holds while the panel was open. The owner again the
  // same day, on a 375 × 667 phone: closed, the scroll still took its share,
  // so the soroban sat lower and jumped up at 手順を見る and back at とじる,
  // which drew the eye away. So it is fitted open or closed, before an
  // answer and in review: the soroban and the board always sit right under
  // the prompt, and all the spare height goes below them. It still shrinks,
  // and scrolls, on a very short screen. It has no `flex`: Yoga reads a
  // positive flex as a flex basis of 0, which would squash the prompt to
  // nothing.
  const topScroll = () => StyleSheet.flatten(screen.getByTestId('question-scroll').props.style)
  const fitted = { flexGrow: 0, flexShrink: 1 }

  it('fits the top scroll to the prompt before an answer, whether the steps are open or not', () => {
    renderView({ demonstration: '385は…' })
    expect(topScroll()).toEqual(fitted)
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(topScroll()).toEqual(fitted)
    const top = within(screen.getByTestId('question-scroll'))
    expect(top.getByTestId('prompt')).toBeTruthy()
    expect(top.queryByTestId('demonstration')).toBeNull()
    expect(top.queryByTestId('steps-open')).toBeNull()

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(topScroll()).toEqual(fitted)
  })

  it('fits the top scroll as a miss opens the panel by itself', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('step-lines')).toBeTruthy()
    expect(topScroll()).toEqual(fitted)
  })

  it('fits the top scroll in the review of a miss, before and after こたえを見る opens the panel', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('step-lines')).toBeNull()
    expect(topScroll()).toEqual(fitted)
    fireEvent.press(screen.getByTestId('review-show'))
    expect(topScroll()).toEqual(fitted)
  })

  // The owner, the same day: the one-line hint under the soroban (and the
  // board) gave way to the taller ◀ ▶ row as the panel opened, and moved
  // everything below it. So the hint, the controls, and the empty place
  // under a silent level's ✕ share one slot of the controls' height. It is
  // a minimum, so controls that wrap at the largest text sizes still grow
  // it rather than spill over the lines. The hint is centred in it.
  const slot = () => screen.getByTestId('step-controls-slot')
  const slotStyle = { minHeight: space.sm + STEP_CONTROLS_HEIGHT, justifyContent: 'center' }
  const hint = '珠をタップして動かします'

  it('holds the hint and the step controls in one slot of the same height', () => {
    renderView({ renderBeneath: () => <Text testID="beneath">board</Text> })
    expect(within(slot()).getByText(hint)).toBeTruthy()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
    const drawn = order()
    expect(drawn.indexOf('step-controls-slot')).toBeGreaterThan(drawn.indexOf('beneath'))

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(within(slot()).getByTestId('step-next')).toBeTruthy()
    expect(within(slot()).queryByText(hint)).toBeNull()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(within(slot()).getByText(hint)).toBeTruthy()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
  })

  it('keeps the slot its height in the review of a miss, empty until こたえを見る', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(within(slot()).queryByText(hint)).toBeNull()
    expect(within(slot()).queryByTestId('step-next')).toBeNull()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)

    fireEvent.press(screen.getByTestId('review-show'))
    expect(within(slot()).getByTestId('step-next')).toBeTruthy()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
  })

  // At F0 the demonstration line under the prompt gives way to the open
  // panel, which says the same. In the fitted scroll its going would move
  // the soroban up after all, so in bead mode it keeps its place, unseen and
  // unheard, until the panel closes. Queries skip what VoiceOver cannot
  // reach unless asked, so the place is looked for with `unseen`.
  const unseen = { includeHiddenElements: true }

  it('holds the demonstration line’s place in bead mode while the panel says it instead', () => {
    renderView({ demonstration: '385は…' })
    const shown = StyleSheet.flatten(screen.getByTestId('demonstration').props.style)
    expect(screen.queryByTestId('demonstration-place', unseen)).toBeNull()

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('demonstration')).toBeNull()
    const place = within(screen.getByTestId('question-scroll')).getByTestId('demonstration-place', unseen)
    expect(textOf(place)).toBe('385は…')
    expect(StyleSheet.flatten(place.props.style)).toEqual({ ...shown, opacity: 0 })
    expect(place.props.accessibilityElementsHidden).toBe(true)
    expect(place.props.importantForAccessibility).toBe('no-hide-descendants')

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.getByTestId('demonstration')).toBeTruthy()
    expect(screen.queryByTestId('demonstration-place', unseen)).toBeNull()

    // A miss at F0 opens the panel with the ✕, and the place is kept too.
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('demonstration')).toBeNull()
    expect(within(screen.getByTestId('question-scroll')).getByTestId('demonstration-place', unseen)).toBeTruthy()
  })

  // Keypad mode's scroll keeps its share of the height, so nothing moves
  // there when the line goes.
  it('lets the demonstration line go in keypad mode', () => {
    renderView({ fade: 3, coaching: 'silent', demonstration: '385は…' })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('demonstration')).toBeNull()
    expect(screen.queryByTestId('demonstration-place', unseen)).toBeNull()
  })

  // Keypad mode keeps the lines in the top scroll, with the prompt, so the
  // scroll keeps its share of the height whether they are open or not.
  it('keeps the top scroll flexible in keypad mode, open or not', () => {
    renderView({ fade: 3, coaching: 'silent' })
    expect(topScroll()).toEqual({ flex: 1 })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(topScroll()).toEqual({ flex: 1 })
    fireEvent.press(screen.getByTestId('steps-close'))

    for (const digit of '800') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    fireEvent.press(screen.getByTestId('review-show'))
    expect(screen.getByTestId('step-panel')).toBeTruthy()
    expect(topScroll()).toEqual({ flex: 1 })
  })

  it('keeps the lines in the scroll with the prompt in keypad mode', () => {
    renderView({ fade: 3, coaching: 'silent' })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(within(screen.getByTestId('question-scroll')).getByTestId('step-panel')).toBeTruthy()
    expect(screen.queryByTestId('step-lines-scroll')).toBeNull()
  })

  describe('scrolling the line stepped to into view', () => {
    let scrollTo: jest.SpyInstance
    beforeEach(() => {
      scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    })
    afterEach(() => scrollTo.mockRestore())

    // A card with one line, active from the first move on, as a card
    // draws it.
    function Line({ activeStep }: { activeStep: number | undefined }) {
      const lineLayout = useActiveLineLayout(activeStep === undefined ? undefined : 0)
      return <Text testID="line" onLayout={lineLayout(0)}>{String(activeStep)}</Text>
    }
    const layout = (testID: string, y: number, height: number) =>
      fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })

    it('scrolls to the line stepped to when it sits below the part on show', () => {
      renderView({ renderSteps: ({ activeStep }) => <Line activeStep={activeStep} /> })
      fireEvent.press(screen.getByTestId('steps-open'))
      layout('step-lines-scroll', 0, 80)
      layout('line', 200, 16)
      // The panel opens at the start, with nothing stepped to yet.
      expect(scrollTo).not.toHaveBeenCalled()
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 136, animated: true })
    })

    it('leaves the lines where they are when the line stepped to is on show', () => {
      renderView({ renderSteps: ({ activeStep }) => <Line activeStep={activeStep} /> })
      fireEvent.press(screen.getByTestId('steps-open'))
      layout('step-lines-scroll', 0, 80)
      layout('line', 30, 16)
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).not.toHaveBeenCalled()
    })

    it('asks nothing of the lines in keypad mode', () => {
      renderView({ fade: 3, coaching: 'silent', renderSteps: ({ activeStep }) => <Line activeStep={activeStep} /> })
      fireEvent.press(screen.getByTestId('steps-open'))
      expect(screen.getByTestId('line').props.onLayout).toBeUndefined()
    })
  })
})

// The owner's request (2026-09-23): while stepping, the beads the current
// operation (here, a column) has moved so far are red, the latest step's the
// deepest, so a column's several moves read as one.
describe('QuestionView colouring the operation on show', () => {
  const tinted = () => tintedBeads(screen.root, 4)
  const step = (testID: 'step-next' | 'step-back', times = 1) => {
    for (let i = 0; i < times; i++) fireEvent.press(screen.getByTestId(testID))
  }

  it.each([
    ['bead', 0, 'demo'],
    ['keypad', 3, 'silent'],
  ] as const)('colours only the column on show in %s mode, and ◀ brings the last one back', (_mode, fade, coaching) => {
    renderView({ fade, coaching })
    fireEvent.press(screen.getByTestId('steps-open'))
    // The start, where the steps open: nothing has moved yet.
    expect(rods()).toBe('0472')
    expect(tinted()).toEqual([])
    // The hundreds column, 472 + 385's first: +5, then −2.
    step('step-next', 2)
    expect(rods()).toBe('0772')
    expect(tinted()).toEqual(['1 heaven group', '1 earth2 latest', '1 earth3 latest'])

    // The tens column's first move is its carry onto the hundreds rod. The
    // hundreds column's beads go back to wood.
    step('step-next')
    expect(rods()).toBe('0872')
    expect(tinted()).toEqual(['1 earth2 latest'])
    // Its −2 on the tens rod: the carry's bead stays red, lighter now.
    step('step-next')
    expect(rods()).toBe('0852')
    expect(tinted()).toEqual(['1 earth2 group', '2 earth0 latest', '2 earth1 latest'])

    step('step-back', 2)
    expect(rods()).toBe('0772')
    expect(tinted()).toEqual(['1 heaven group', '1 earth2 latest', '1 earth3 latest'])
  })

  it("colours nothing on the learner's own beads, or once the steps are closed", () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    expect(tinted()).toEqual([])
    fireEvent.press(screen.getByTestId('steps-open'))
    step('step-next')
    expect(tinted()).toEqual(['1 heaven latest'])
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(rods()).toBe('0800')
    expect(tinted()).toEqual([])
  })

  it('colours the review of a miss the same way, from its first step', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    // The start, before any ▶.
    expect(tinted()).toEqual([])
    step('step-next')
    expect(tinted()).toEqual(['1 heaven latest'])
  })
})

// A × problem's operand board goes right under the product soroban in bead
// mode, in the fixed area. In keypad mode it goes in the scroll after the
// prompt, so the board never pushes the prompt off a short phone. It follows
// the steps as the step lines do.
describe('QuestionView with something beneath the soroban', () => {
  const beneath = (activeStep: number | undefined) => <Text testID="beneath">{String(activeStep)}</Text>
  // Every testID on screen, in the order they are drawn.
  const order = () =>
    screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)

  it('draws it under the soroban in bead mode, outside the scroll, with the step on show', () => {
    renderView({ renderBeneath: beneath })
    expect(within(screen.getByTestId('question-scroll')).queryByTestId('beneath')).toBeNull()
    const drawn = order()
    expect(drawn.indexOf('beneath')).toBeGreaterThan(drawn.indexOf('rod-3'))
    expect(drawn.indexOf('beneath')).toBeLessThan(drawn.indexOf('submit'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('undefined')

    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('undefined')
    fireEvent.press(screen.getByTestId('step-next'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('0')
    fireEvent.press(screen.getByTestId('step-next'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('1')
    fireEvent.press(screen.getByTestId('step-back'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('0')
  })

  it('draws it in the scroll after the prompt in keypad mode, with the step on show', () => {
    renderView({ fade: 3, coaching: 'silent', demonstration: '385は…', renderBeneath: beneath })
    expect(within(screen.getByTestId('question-scroll')).getByTestId('beneath')).toBeTruthy()
    const drawn = order()
    expect(drawn.indexOf('beneath')).toBeGreaterThan(drawn.indexOf('prompt'))
    expect(drawn.indexOf('beneath')).toBeGreaterThan(drawn.indexOf('demonstration'))
    // Ahead of 手順を見る, which stands where the step lines will appear.
    expect(drawn.indexOf('beneath')).toBeLessThan(drawn.indexOf('steps-open'))

    fireEvent.press(screen.getByTestId('steps-open'))
    // Ahead of the step lines, so it stays near the soroban it explains.
    const open = order()
    expect(open.indexOf('beneath')).toBeLessThan(open.indexOf('step-panel'))
    fireEvent.press(screen.getByTestId('step-next'))
    expect(textOf(screen.getByTestId('beneath'))).toBe('0')
  })
})

// With a board under it, a 375 × 667 phone has too little height left in
// bead mode for the prompt above the soroban and 手順を見る below, so there
// the soroban is drawn smaller. Nowhere else does its size change.
describe('QuestionView on a short window, with something beneath the soroban', () => {
  let restore = () => {}
  function windowOf(width: number, height: number) {
    // As in the 3×3 test below: `require` reaches the module object that
    // QuestionView's own import reads from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    restore = () => spy.mockRestore()
  }
  afterEach(() => restore())

  // 7 × 8's two rods are drawn at the full bead-mode scale on any phone.
  const nineByNine = exerciseForProblem({ op: 'mul', digits: 1, a: 7, b: 8 })
  const padding = () =>
    StyleSheet.flatten(within(screen.getByTestId('soroban-wrap')).getByTestId('abacus-frame').props.style).padding

  it('draws the bead-mode soroban smaller', () => {
    windowOf(375, 667)
    renderView({ exercise: nineByNine, renderBeneath: () => null })
    expect(padding()).toBeCloseTo(FRAME_PADDING * SHORT_WINDOW_BEAD_SCALE)
  })

  it('keeps the soroban its size with nothing beneath it', () => {
    windowOf(375, 667)
    renderView({ exercise: nineByNine })
    expect(padding()).toBeCloseTo(FRAME_PADDING * BEAD_MODE_SCALE)
  })

  it('keeps the soroban its size on a tall window', () => {
    windowOf(402, 874)
    renderView({ exercise: nineByNine, renderBeneath: () => null })
    expect(padding()).toBeCloseTo(FRAME_PADDING * BEAD_MODE_SCALE)
  })
})

// Spec (division) §2: 商除法 leaves the quotient on the soroban followed by
// N + 1 zeros, so on the beads the answer is that final reading. The keypad
// takes the quotient itself.
describe('QuestionView with a division', () => {
  // 1692 ÷ 36 = 47, on five rods: the soroban ends at 47000.
  const division = exerciseForProblem({ op: 'div', digits: 2, a: 1692, b: 36 })

  it('takes the final reading on the beads, the quotient followed by zeros', () => {
    const { onSubmit } = renderView({ exercise: division })
    setBeads(screen.getByTestId, 47000, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, latencyMs: null }))
  })

  // The digits in the wrong place are not what 商除法 leaves, and the miss
  // must say what the beads themselves needed to read (the final soroban
  // reading, spec (division) §2), not just the quotient — "こたえは 47"
  // alone would read wrong against beads that had to reach 47000.
  it('misses the quotient set on the lowest rods, and names the beads’ own reading', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { onSubmit } = renderView({ exercise: division })
      setBeads(screen.getByTestId, 47, 5)
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
      expect(announce).toHaveBeenCalledWith('ちがいます こたえは 47（そろばんは 47000）')
    } finally {
      announce.mockRestore()
    }
  })

  it('takes the quotient itself on the keypad', () => {
    const { onSubmit } = renderView({ exercise: division, fade: 3, coaching: 'silent' })
    for (const digit of '47') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
  })

  it('misses the final reading typed on the keypad, which is not the quotient', () => {
    const { onSubmit } = renderView({ exercise: division, fade: 3, coaching: 'silent' })
    for (const digit of '47000') fireEvent.press(screen.getByTestId(`key-${digit}`))
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
  })

  // A keypad answer is always checked against the quotient itself, so its
  // miss must never grow the beads’ parenthetical — even with the card
  // forced open here (fade 3 is never paired with non-silent coaching in
  // production; coachingForFade only speaks at the bead-mode levels), the
  // mode alone must gate it, not just whether the exercise carries
  // expectedBeads.
  it('never appends the beads’ reading to a keypad miss, whatever the coaching level', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderView({ exercise: division, fade: 3, coaching: 'demo' })
      for (const digit of '48') fireEvent.press(screen.getByTestId(`key-${digit}`))
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(announce).toHaveBeenCalledWith('ちがいます こたえは 47')
    } finally {
      announce.mockRestore()
    }
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
