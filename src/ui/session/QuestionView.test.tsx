import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView, StyleSheet, Text } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { emptySoroban, setValue } from '@/domain/soroban'
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

// Bead mode's space under the soroban, in 手順を見る's place or the step
// lines': it takes the height left over and never less than 手順を見る's
// room, its marginTop and its 44 pt height, so it can be reached at any
// text size (the controller's ruling, 2026-09-24).
const BOTTOM_ROOM = space.sm + 44
const bottomRegion = { flexGrow: 1, flexShrink: 0, flexBasis: BOTTOM_ROOM }

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
      renderSteps={({ activeStep, showAnswer }) => (
        <Text testID="card">{`${String(activeStep)} ${String(showAnswer)}`}</Text>
      )}
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

  // With the beads as answered, which a run keeps to show again when the
  // learner looks back (spec (runs) §5).
  it('scores a bead answer untimed', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith({
      correct: true,
      latencyMs: null,
      t: expect.any(Number),
      assisted: false,
      beads: setValue(emptySoroban(4), 857),
    })
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
  // short phone. The lines scroll in their own place below them (the
  // owner's request, 2026-09-23), at every level.
  it.each([
    ['a coaching level', 0, 'demo'],
    ['a silent, faded level', 3, 'silent'],
  ] as const)('pins the step controls outside the scrolling lines at %s', (_level, fade, coaching) => {
    renderView({ fade, coaching })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    if (coaching === 'silent') fireEvent.press(screen.getByTestId('review-show'))
    const scroll = screen.getByTestId('step-lines-scroll')
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

  // つぎへ takes こたえる's place under a miss, so a double tap on こたえる
  // would land on it and skip the review (NEXT_GUARD_MS). Ported from the
  // removed session's tests (spec (roll) §2): the guard is QuestionView's.
  it('ignores つぎへ in the moment after a miss, so a double tap on こたえる cannot skip the review', () => {
    let clock = 0
    const { onMoveOn } = renderView({ now: () => clock })
    setBeads(screen.getByTestId, 800, 4)
    clock = 1_000
    fireEvent.press(screen.getByTestId('submit'))
    clock = 1_200
    fireEvent.press(screen.getByTestId('review-next'))
    expect(onMoveOn).not.toHaveBeenCalled()
    clock = 1_500
    fireEvent.press(screen.getByTestId('review-next'))
    expect(onMoveOn).toHaveBeenCalledWith(1_500)
  })


  // Spec (runs) §5: a run says how many lives a miss leaves, in the same
  // announcement, since a second one would cut the first off.
  it('names what a miss leaves alongside the ✕', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderView({ missNote: 'のこりライフ 2' })
      setBeads(screen.getByTestId, 800, 4)
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(announce).toHaveBeenCalledWith('ちがいます のこりライフ 2 こたえは 857')
    } finally {
      announce.mockRestore()
    }
  })

  it('names it at a silent level too, where the answer waits to be asked for', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderView({ fade: 2, coaching: 'silent', missNote: 'のこりライフ 1' })
      setBeads(screen.getByTestId, 800, 4)
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(announce).toHaveBeenCalledWith('ちがいます のこりライフ 1')
    } finally {
      announce.mockRestore()
    }
  })
})

// Spec (core rounds) §4: 手順を見る opens the same step panel before an
// answer, without the answer, and とじる gives the question back as the
// learner left it. §5: an answer given after it counts "with help".
describe('QuestionView before an answer, with 手順を見る', () => {
  const opacity = () => screen.getAllByTestId('fade-layer')[0]?.props.style.opacity as number
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
  // open, starting from its height too, so no empty row is left at the
  // bottom. Where there is room they take all the height left anyway (the
  // top scroll fits the prompt); on a screen too short for everything the
  // column asks for the same height open as closed, so the prompt's scroll
  // gives way by the same amount and the soroban does not move there
  // either.
  it('holds the answer row height in bead mode while the steps are open', () => {
    renderView()
    expect(screen.queryByTestId('step-lines')).toBeNull()
    expect(screen.getByTestId('submit')).toBeTruthy()

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(StyleSheet.flatten(screen.getByTestId('step-lines').props.style)).toEqual({
      ...bottomRegion,
      flexBasis: BOTTOM_ROOM + space.md + BUTTON_HEIGHT,
    })
    expect(screen.queryByTestId('answer-row-placeholder')).toBeNull()

    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.queryByTestId('step-lines')).toBeNull()
  })

  it('takes the answer row away while the steps are open, and draws the faded beads solid', () => {
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

  // Closing the steps brings もどす and こたえる back, with こたえる right
  // under とじる.
  it('ignores こたえる in the moment after とじる, so a double tap cannot hand in the answer', () => {
    let clock = 0
    const { onSubmit } = renderView({ fade: 3, coaching: 'silent', now: () => clock })
    setBeads(screen.getByTestId, 857, 4)
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
    renderView({ renderBeneath: beneath })
    const top = within(screen.getByTestId('question-scroll'))
    expect(top.queryByTestId('steps-open')).toBeNull()
    const drawn = order()
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('soroban-wrap'))
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('beneath'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('reset-beads'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('submit'))
  })

  // It sits at the top of the flexible space the step lines take once open.
  // The space keeps the button's room at the least, as the lines keep it,
  // and never shrinks: were it to give way with the prompt's scroll where
  // the lines do not, the soroban would move as the panel opens on a screen
  // too short for everything. No padding or margin, for the same reason.
  it('holds it in the flexible space under the soroban, where the lines go', () => {
    renderView()
    const place = screen.getByTestId('bead-spacer')
    expect(within(place).getByTestId('steps-open')).toBeTruthy()
    expect(StyleSheet.flatten(place.props.style)).toEqual(bottomRegion)

    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('bead-spacer')).toBeNull()
    expect(screen.getByTestId('step-lines')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(within(screen.getByTestId('bead-spacer')).getByTestId('steps-open')).toBeTruthy()
  })

  // Should the button ever outgrow the room the space keeps for it, it must
  // not spill over もどす and こたえる, which are drawn after it and would
  // take its taps. The space scrolls instead, so a small scroll reaches it.
  it('lets the button be scrolled to where the space is shorter than it', () => {
    renderView()
    const place = screen.getByTestId('bead-spacer')
    expect(screen.UNSAFE_getAllByType(ScrollView).map((scroll) => scroll.props.testID)).toContain('bead-spacer')
    expect(StyleSheet.flatten(place.props.style)).toEqual(bottomRegion)
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
    expect(StyleSheet.flatten(screen.getByTestId('bead-spacer').props.style)).toEqual(bottomRegion)
  })

})

// The owner's request (2026-09-23): the step lines sat in the small scroll
// above the soroban, two lines at a time, while the screen below ◀ ▶ was
// empty. They now fill that space, scrolling on their own, and the line
// stepped to is scrolled into view.
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
    // spacer's place, with its flex and its least room.
    expect(StyleSheet.flatten(screen.getByTestId('step-lines').props.style)).toEqual(bottomRegion)
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
    renderView()
    expect(topScroll()).toEqual(fitted)
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(topScroll()).toEqual(fitted)
    const top = within(screen.getByTestId('question-scroll'))
    expect(top.getByTestId('prompt')).toBeTruthy()
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
  // everything below it. So the hint, the controls, and what the beads read
  // once answered share one slot of the controls' height. It is
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

  it('keeps the slot its height in the review of a miss, holding the beads’ reading until こたえを見る', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(within(slot()).getByTestId('bead-reading')).toBeTruthy()
    expect(within(slot()).queryByText(hint)).toBeNull()
    expect(within(slot()).queryByTestId('step-next')).toBeNull()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)

    fireEvent.press(screen.getByTestId('review-show'))
    expect(within(slot()).getByTestId('step-next')).toBeTruthy()
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
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
    ['a coaching level', 0, 'demo'],
    ['a silent, faded level', 3, 'silent'],
  ] as const)('colours the whole number on show at %s, and ◀ steps its colouring back', (_level, fade, coaching) => {
    renderView({ fade, coaching })
    fireEvent.press(screen.getByTestId('steps-open'))
    // The start, where the steps open: nothing has moved yet.
    expect(rods()).toBe('0472')
    expect(tinted()).toEqual([])
    // The hundreds column, 472 + 385's first: +5, then −2.
    step('step-next', 2)
    expect(rods()).toBe('0772')
    expect(tinted()).toEqual(['1 heaven group', '1 earth2 latest', '1 earth3 latest'])

    // Spec (core rounds) §11: 385 is one operation, so the hundreds column's
    // beads stay red as the tens column begins with its carry onto the
    // hundreds rod, which moves earth bead 2 back up.
    step('step-next')
    expect(rods()).toBe('0872')
    expect(tinted()).toEqual(['1 heaven group', '1 earth2 latest', '1 earth3 group'])
    // Its −2 on the tens rod joins them.
    step('step-next')
    expect(rods()).toBe('0852')
    expect(tinted()).toEqual(['1 heaven group', '1 earth2 group', '1 earth3 group', '2 earth0 latest', '2 earth1 latest'])

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

// A × problem's operand board goes right under the product soroban, in the
// fixed area. It follows the steps as the step lines do.
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

// Spec (division) §2: 商除法 leaves the quotient N + 1 rods left of the
// dividend's ones rod, and reads its ones there.
describe('QuestionView with a division', () => {
  // 1692 ÷ 36 = 47, on five rods: the soroban ends at 47000.
  const division = exerciseForProblem({ op: 'div', digits: 2, a: 1692, b: 36 })

  it('takes the quotient left where 商除法 leaves it, with zeros below it', () => {
    const { onSubmit } = renderView({ exercise: division })
    setBeads(screen.getByTestId, 47000, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, latencyMs: null }))
  })

  // The digits on the lowest rods are not where 商除法 leaves the quotient:
  // read from the quotient's ones rod they are 0.047.
  it('misses the quotient set on the lowest rods, and names the quotient', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { onSubmit } = renderView({ exercise: division })
      setBeads(screen.getByTestId, 47, 5)
      announce.mockClear()
      fireEvent.press(screen.getByTestId('submit'))
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
      expect(announce).toHaveBeenCalledWith('ちがいます こたえは 47')
    } finally {
      announce.mockRestore()
    }
  })

  // The owner (2026-10-05): 36 ÷ 9 answered right showed 400.
  it('shows the quotient under a right answer, read from its own ones rod', () => {
    renderView({ exercise: exerciseForProblem({ op: 'div', digits: 1, a: 36, b: 9 }) })
    setBeads(screen.getByTestId, 400, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('bead-reading').props.children).toBe('4')
    expect(screen.getByTestId('bead-reading').props.accessibilityLabel).toBe('あなたの答え 4')
  })

  it('shows a misplaced quotient as what it reads from that rod', () => {
    renderView({ exercise: division, fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 47, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('bead-reading').props.children).toBe('0.047')
  })

})

describe('QuestionView with a 3×3 multiplication', () => {
  it('shrinks a six-rod soroban to fit a phone at a faded level', () => {
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
        renderSteps={() => null}
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

// Spec (roll) §3: a right answer's 〇 is stamped on the answered question,
// which stays as answered, and a second こたえる does nothing.
describe('QuestionView after a right answer', () => {
  it('stamps the 〇 over its own soroban and takes no second answer', () => {
    const { onSubmit } = renderView()
    setBeads(screen.getByTestId, 857, 4)
    expect(screen.queryByTestId('maru')).toBeNull()
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual(expect.objectContaining({ correct: true }))
    expect(screen.getByTestId('maru')).toBeTruthy()
    // The beads stay as answered, and take no taps.
    expect(rods()).toBe('0857')
    fireEvent(screen.getByTestId('rod-3'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(rods()).toBe('0857')
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  // Spec (roll) §3: the 〇 goes out with its problem, so it holds, unfaded,
  // for as long as the round keeps the problem on screen — past the ~0.8 s a
  // stamp otherwise lasts.
  it('keeps the 〇 fully drawn until the question goes', () => {
    renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    act(() => jest.advanceTimersByTime(1_500))
    expect(StyleSheet.flatten(screen.getByTestId('maru').props.style).opacity).toBe(1)
  })

  it('stamps nothing on a wrong answer', () => {
    renderView()
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('maru')).toBeNull()
  })
})

// The owner (2026-09-29): once answered on the beads, the number they read
// is shown, so a right answer's 〇 says which number was right. While the
// learner works they read the beads themselves.
describe('QuestionView showing what the beads read once answered', () => {
  const slot = () => screen.getByTestId('step-controls-slot')
  const slotStyle = { minHeight: space.sm + STEP_CONTROLS_HEIGHT, justifyContent: 'center' }
  const hint = '珠をタップして動かします'
  const givenCard = ({ given }: { given?: number }) => <Text testID="card">{String(given)}</Text>

  it('shows the reading under the soroban with the 〇, in the hint’s place', () => {
    renderView()
    setBeads(screen.getByTestId, 857, 4)
    expect(screen.queryByTestId('bead-reading')).toBeNull()
    expect(within(slot()).getByText(hint)).toBeTruthy()
    fireEvent.press(screen.getByTestId('submit'))
    expect(within(slot()).getByTestId('bead-reading').props.children).toBe('857')
    expect(screen.getByTestId('bead-reading').props.accessibilityLabel).toBe('あなたの答え 857')
    expect(within(slot()).queryByText(hint)).toBeNull()
    // The same slot at the same height, so nothing below it moves.
    expect(StyleSheet.flatten(slot().props.style)).toEqual(slotStyle)
  })

  it('shows it with the ✕ while the learner’s beads are on show, until the steps take over', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(within(slot()).getByTestId('bead-reading').props.children).toBe('800')
    fireEvent.press(screen.getByTestId('review-show'))
    expect(screen.queryByTestId('bead-reading')).toBeNull()
    expect(within(slot()).getByTestId('step-next')).toBeTruthy()
  })

  it('gives the step card the learner’s reading once the steps take over their beads', () => {
    renderView({ renderSteps: givenCard })
    // Before an answer there is nothing to compare.
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.getByTestId('card').props.children).toBe('undefined')
    fireEvent.press(screen.getByTestId('steps-close'))
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('card').props.children).toBe('800')
  })

  it('gives the step card a ÷ reading from the quotient’s ones rod', () => {
    renderView({ exercise: exerciseForProblem({ op: 'div', digits: 2, a: 1692, b: 36 }), renderSteps: givenCard })
    setBeads(screen.getByTestId, 47, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('card').props.children).toBe('0.047')
  })

})

// Spec (howto tutorial) §2: outside a round, an answered question offers
// leaving or another problem in place of its bottom row.
describe('QuestionView after an answer outside a round', () => {
  const afterAnswer = (onLeave = jest.fn()) => ({ leaveLabel: 'おわる', onLeave, againLabel: 'もう一問' })

  it('offers leaving or another problem once a right answer is in', () => {
    const onLeave = jest.fn()
    const { onMoveOn } = renderView({ afterAnswer: afterAnswer(onLeave) })
    expect(screen.queryByTestId('after-again')).toBeNull()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.queryByTestId('submit')).toBeNull()
    expect(screen.getByTestId('after-again')).toHaveTextContent('もう一問')
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    expect(onMoveOn).toHaveBeenCalledTimes(1)
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('offers them in place of つぎへ under a miss', () => {
    const { onMoveOn } = renderView({ afterAnswer: afterAnswer() })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('review-next')).toBeNull()
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('after-again'))
    expect(onMoveOn).toHaveBeenCalledTimes(1)
  })

  // A double tap on こたえる must not skip the 〇 or the review.
  it('ignores both in the moment after an answer', () => {
    let clock = 0
    const onLeave = jest.fn()
    const { onMoveOn } = renderView({ now: () => clock, afterAnswer: afterAnswer(onLeave) })
    setBeads(screen.getByTestId, 857, 4)
    clock = 1_000
    fireEvent.press(screen.getByTestId('submit'))
    clock = 1_200
    fireEvent.press(screen.getByTestId('after-again'))
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onMoveOn).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
    clock = 1_500
    fireEvent.press(screen.getByTestId('after-leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  // The owner's round blocks it under the roll; outside a round nothing
  // does, and a right answer has nothing left to open the steps for.
  it('offers no 手順を見る once a right answer is in', () => {
    renderView({ afterAnswer: afterAnswer() })
    expect(screen.getByTestId('steps-open')).toBeTruthy()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('steps-open')).toBeNull()
  })

})

// Spec (runs) §5, the owner (2026-10-06): a run's earlier problem, looked
// back at as it was left. It shows, and explains, but takes no answer.
describe('QuestionView looking back at an answered question', () => {
  const past = (value: number, correct: boolean, onReturn = jest.fn()) => ({
    beads: setValue(emptySoroban(4), value),
    correct,
    returnLabel: 'いまの問題にもどる',
    onReturn,
  })

  it('shows the learner’s beads under the 〇 and what they read, and takes no answer', () => {
    const { onSubmit, onMoveOn } = renderView({ past: past(857, true) })
    expect(rods()).toBe('0857')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.queryByTestId('batsu')).toBeNull()
    expect(screen.getByTestId('bead-reading').props.children).toBe('857')
    for (const testID of ['submit', 'reset-beads', 'review-next', 'review-show', 'after-again']) {
      expect(screen.queryByTestId(testID)).toBeNull()
    }
    // Locked: a bead moves nothing.
    expect(screen.getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    fireEvent(screen.getByTestId('rod-3'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(rods()).toBe('0857')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onMoveOn).not.toHaveBeenCalled()
  })

  it('shows a miss under a ✕ that stays, drawn at once', () => {
    renderView({ past: past(800, false) })
    expect(screen.queryByTestId('maru')).toBeNull()
    expect(StyleSheet.flatten(screen.getByTestId('batsu').props.style).opacity).toBe(1)
    act(() => jest.advanceTimersByTime(1_000))
    expect(StyleSheet.flatten(screen.getByTestId('batsu').props.style).opacity).toBe(1)
    expect(screen.getByTestId('bead-reading').props.children).toBe('800')
  })

  it('draws the 〇 at once too', () => {
    renderView({ past: past(857, true) })
    expect(StyleSheet.flatten(screen.getByTestId('maru').props.style).opacity).toBe(1)
  })

  // VoiceOver can tell a past problem's 〇 from its ✕; on a question being
  // answered the stamps stay unnamed, as the answer is announced.
  it.each([
    [857, true, 'maru', '正解'],
    [800, false, 'batsu', 'ちがいます'],
  ] as const)('names a past %p’s stamp for VoiceOver', (value, correct, stamp, label) => {
    renderView({ past: past(value, correct) })
    expect(screen.getByTestId(stamp).props.accessible).toBe(true)
    expect(screen.getByTestId(stamp).props.accessibilityLabel).toBe(label)
  })

  it('leaves the stamps of a question being answered unnamed', () => {
    renderView({ fade: 2, coaching: 'silent' })
    setBeads(screen.getByTestId, 800, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('batsu').props.accessibilityLabel).toBeUndefined()
    screen.unmount()
    renderView()
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.getByTestId('maru').props.accessibilityLabel).toBeUndefined()
  })

  // The ruling (2026-10-06): looking back is review, not a test, so the
  // learner's beads are drawn solid, frame and all, at any level.
  it.each([3, 6] as const)('draws the beads solid at level %p', (fade) => {
    renderView({ fade, coaching: 'silent', past: past(857, true) })
    const wrap = within(screen.getByTestId('soroban-wrap'))
    for (const layer of wrap.getAllByTestId('fade-layer')) expect(layer.props.style.opacity).toBe(1)
    expect(wrap.getByTestId('abacus-frame')).toBeTruthy()
    expect(rods()).toBe('0857')
  })

  it('opens the steps at the start, with the answer and the miss’s beads, and closes them', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      renderView({
        past: past(800, false),
        renderSteps: ({ activeStep, showAnswer, given }) => (
          <Text testID="card">{`${String(activeStep)} ${String(showAnswer)} ${String(given)}`}</Text>
        ),
      })
      announce.mockClear()
      fireEvent.press(screen.getByTestId('steps-open'))
      // Opening at the start says nothing, as 手順を見る does before an answer.
      expect(announce).not.toHaveBeenCalled()
      expect(textOf(screen.getByTestId('card'))).toBe('undefined true 800')
      expect(screen.getByTestId('step-count').props.children).toBe('0 / 5')
      expect(rods()).toBe('0472')
      // A miss's correction edge, as its review drew it.
      expect(StyleSheet.flatten(screen.getByTestId('step-panel').props.style).borderLeftColor).toBe(colors.accent)
      // Its way back stays below the lines.
      expect(screen.getByTestId('look-back-return')).toBeTruthy()
      fireEvent.press(screen.getByTestId('step-next'))
      expect(textOf(screen.getByTestId('card'))).toBe('0 true 800')
      expect(rods()).toBe('0972')

      fireEvent.press(screen.getByTestId('steps-close'))
      expect(screen.queryByTestId('step-panel')).toBeNull()
      expect(rods()).toBe('0800')
      expect(screen.getByTestId('bead-reading').props.children).toBe('800')
      expect(screen.getByTestId('steps-open')).toBeTruthy()
      // Only the steps are heard: nothing of 正解 or ちがいます, which were
      // said as the answer was given.
      expect(announce.mock.calls).toEqual([['1 / 5']])
    } finally {
      announce.mockRestore()
    }
  })

  it('gives a right one’s steps the answer alone, with no correction edge', () => {
    renderView({
      past: past(857, true),
      renderSteps: ({ showAnswer, given }) => <Text testID="card">{`${String(showAnswer)} ${String(given)}`}</Text>,
    })
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(textOf(screen.getByTestId('card'))).toBe('true undefined')
    expect(StyleSheet.flatten(screen.getByTestId('step-panel').props.style).borderLeftColor).not.toBe(colors.accent)
  })

  it('goes back through its one button', () => {
    const onReturn = jest.fn()
    renderView({ past: past(857, true, onReturn) })
    expect(screen.getByTestId('look-back-return')).toHaveTextContent('いまの問題にもどる')
    fireEvent.press(screen.getByTestId('look-back-return'))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})

// The owner (2026-09-30): every level is answered on the beads, however
// faded, since the fingers keep moving them; only how much of them shows
// changes: 35% at level 3, 12% at 4, only the frame at 5, nothing at 6.
describe('QuestionView at the faded levels', () => {
  it.each([
    [3, 0.35, 'abacus-frame'],
    [4, 0.12, 'abacus-frame'],
    [5, 0, 'abacus-frame'],
    [6, 0, 'abacus-blank'],
  ] as const)('answers on the beads at level %p, drawn at %p', (fade, opacity, frame) => {
    const { onSubmit } = renderView({ fade, coaching: 'silent' })
    expect(screen.queryByTestId('key-1')).toBeNull()
    const wrap = within(screen.getByTestId('soroban-wrap'))
    for (const layer of wrap.getAllByTestId('fade-layer')) expect(layer.props.style.opacity).toBe(opacity)
    expect(wrap.getByTestId(frame)).toBeTruthy()
    // The beads move where they would be, shown or not.
    setBeads(screen.getByTestId, 857, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, latencyMs: null }))
    expect(screen.getByTestId('bead-reading').props.children).toBe('857')
  })
})
