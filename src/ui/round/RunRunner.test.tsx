import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, Animated, Dimensions, ScrollView, StyleSheet } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { problemSteps, type MitoriProblem, type Problem } from '@/domain/problem'
import { answerPoints } from '@/domain/score'
import { BEAD_EASE_MS } from '@/ui/abacus/Rod'
import { beadModeScale, FRAME_PADDING, SHORT_WINDOW_BEAD_SCALE } from '@/ui/abacus/geometry'
import { OPERAND_MAX_SCALE, OPERAND_SHORT_WINDOW_SCALE } from '@/ui/multiply/OperandBoard'
import { NEXT_GUARD_MS } from '@/ui/session/QuestionView'
import { setBeads, tintedBeads } from '@/ui/session/testing'
import { colors } from '@/ui/theme'
import { ROLL_HOLD_MS, ROLL_SWIPE_MS, RunRunner } from './RunRunner'

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

const problems: Problem[] = [
  { op: 'add', digits: 2, a: 23, b: 58 },
  { op: 'add', digits: 2, a: 46, b: 54 },
  { op: 'add', digits: 2, a: 10, b: 11 },
]

// Draws `list` in order, then its last again: a run never runs dry.
function drawFrom(list: readonly Problem[]) {
  return (shown: readonly Problem[]): Problem => {
    const problem = list[Math.min(shown.length, list.length - 1)]
    if (problem === undefined) throw new Error('nothing to draw')
    return problem
  }
}

type RunOverrides = Partial<Parameters<typeof RunRunner>[0]> & { problems?: Problem[] }

// `relevel` re-renders with the record's level moved, as the provider does
// once an answer is recorded.
function renderRun(overrides: RunOverrides = {}) {
  const { problems: list = problems, ...props } = overrides
  const onAttempt = jest.fn()
  const onPoints = jest.fn()
  const onEnd = jest.fn()
  const onAgain = jest.fn()
  const onLeave = jest.fn()
  // Confirms at once, as pressing やめる does.
  const askQuit = jest.fn((confirmed: () => void) => confirmed())
  let clock = 0
  const now = () => (clock += 1_000)
  const element = (level: FadeLevel) => (
    <RunRunner
      kind={{ op: 'add', digits: 2 }}
      calibrationMs={900}
      draw={drawFrom(list)}
      pointsBefore={0}
      best={undefined}
      onAttempt={onAttempt}
      onPoints={onPoints}
      onEnd={onEnd}
      onAgain={onAgain}
      onLeave={onLeave}
      askQuit={askQuit}
      now={now}
      {...props}
      level={level}
    />
  )
  render(element(props.level ?? 0))
  return {
    onAttempt,
    onPoints,
    onEnd,
    onAgain,
    onLeave,
    askQuit: props.askQuit ?? askQuit,
    relevel: (level: FadeLevel) => screen.rerender(element(level)),
  }
}

function answerBeads(value: number) {
  setBeads(screen.getByTestId, value, 3)
  fireEvent.press(screen.getByTestId('submit'))
}

// Lets `ms` pass a frame at a time, rendering after each as a phone does:
// the swipe starts from an effect, once the next problem is underneath.
function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// Spec (roll) §3: after a right answer the problem is held under its 〇,
// then its card is swiped off over the next.
function finishRightAnswerRoll() {
  passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50)
}
// After a miss's つぎへ there is no hold, only the swipe.
function finishRoll() {
  passTime(ROLL_SWIPE_MS + 50)
}

// A miss's review, then つぎへ, then the swipe to the next card.
function moveOnFromMiss() {
  act(() => jest.advanceTimersByTime(500))
  fireEvent.press(screen.getByTestId('review-next'))
  finishRoll()
}

// Frames until the answered card is on its way off, over the next (at most
// a second of them).
function passUntilSwiping() {
  for (let frame = 0; frame < 60 && screen.queryByTestId('card-leaving') === null; frame++) passTime(16)
}

// A card's own style: how faded it is, and how far it has moved.
function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as {
    opacity?: number
    transform?: Record<string, number>[]
  }
}
function movedBy(testID: string) {
  return styleOf(testID).transform?.find((t) => 'translateX' in t)?.translateX ?? 0
}

// The beads' opacity on the card on show.
function beadOpacities() {
  return within(screen.getByTestId('card'))
    .getAllByTestId('fade-layer')
    .map((layer) => StyleSheet.flatten(layer.props.style).opacity)
}

// The level banner is hidden from VoiceOver, which the queries skip unless
// asked.
const hidden = { includeHiddenElements: true }

describe('RunRunner', () => {
  // The owner (2026-09-30): the bar shows the level the problem is played at.
  it.each([[0, 'レベル 0/6'], [3, 'レベル 3/6']] as const)('shows level %p in its bar', (level, label) => {
    renderRun({ level })
    expect(screen.getByTestId('run-level').props.children).toBe(label)
  })

  it('starts with three lives and nothing scored', () => {
    renderRun()
    expect(screen.getAllByTestId('life')).toHaveLength(3)
    expect(screen.getByTestId('run-score').props.children).toBe('0点')
    expect(screen.queryByTestId('run-combo')).toBeNull()
  })

  it('draws each problem as the last goes, given those shown so far', () => {
    const draw = jest.fn(drawFrom(problems))
    renderRun({ draw })
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    answerBeads(81)
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(draw).toHaveBeenLastCalledWith([problems[0]])
  })

  // Spec (runs) §3: the record still gets no pace, so levels move on
  // accuracy alone.
  it.each([0, 4] as const)('records each answer against the kind at its level, %p, with no pace', (level) => {
    const { onAttempt } = renderRun({ level })
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'add:2', correct: true, pace: null, assisted: false, fade: level })
  })

  // 23 + 58's base is 36; answered within its target at F0, early in a
  // combo: 36 × 1.5. The owner (2026-10-06): just the 〇, no numbers in it,
  // so the points go to the bar alone (spec (runs) §5).
  it('scores a right answer and adds it to the bar, with only the 〇 over it', () => {
    const { onPoints } = renderRun()
    answerBeads(81)
    expect(onPoints).toHaveBeenCalledWith(54)
    expect(screen.getByTestId('run-score').props.children).toBe('54点')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.queryByTestId('points-float', hidden)).toBeNull()
    passTime(ROLL_HOLD_MS)
    expect(screen.queryByTestId('points-float', hidden)).toBeNull()
  })

  it('builds a combo from two right answers in a row, and a miss ends it', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    expect(screen.queryByTestId('run-combo')).toBeNull()
    answerBeads(100)
    finishRightAnswerRoll()
    expect(screen.getByTestId('run-combo').props.children).toBe('2れんぞく ×1')
    answerBeads(20)
    expect(screen.queryByTestId('run-combo')).toBeNull()
  })

  it('takes a life for a miss and says how many are left', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { onPoints } = renderRun()
      announce.mockClear()
      answerBeads(80)
      expect(screen.getAllByTestId('life')).toHaveLength(2)
      expect(screen.getAllByTestId('life-lost')).toHaveLength(1)
      expect(onPoints).not.toHaveBeenCalled()
      expect(announce).toHaveBeenCalledWith('ちがいます のこりライフ 2 こたえは 81')
    } finally {
      announce.mockRestore()
    }
  })

  // Spec (core rounds) §4–§5: 手順を見る opens the steps without the answer,
  // and an answer after it is with help: recorded so, scoring nothing.
  it('records an answer after 手順を見る as with help, scoring nothing, for that problem only', () => {
    const { onAttempt, onPoints } = renderRun()
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.getByTestId('correction-column-1')).toBeTruthy()
    expect(screen.queryByTestId('correction-answer')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    answerBeads(81)
    expect(onAttempt).toHaveBeenLastCalledWith({ id: 'add:2', correct: true, pace: null, assisted: true, fade: 0 })
    expect(onPoints).not.toHaveBeenCalled()
    expect(screen.getAllByTestId('life')).toHaveLength(3)

    // The next problem starts afresh.
    finishRightAnswerRoll()
    answerBeads(100)
    expect(onAttempt).toHaveBeenLastCalledWith({ id: 'add:2', correct: true, pace: null, assisted: false, fade: 0 })
    expect(onPoints).toHaveBeenCalledTimes(1)
  })

  it('reviews a miss, then moves on without repeating it', () => {
    renderRun()
    answerBeads(80)
    expect(screen.getByTestId('correction')).toBeTruthy()
    moveOnFromMiss()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Spec (core rounds) §3: each ▶ plays one bead move, and the line of the
  // column that move belongs to lights up (groupOfStep).
  it('steps through a missed problem, lighting the column each move belongs to', () => {
    renderRun()
    answerBeads(80)
    const count = () => screen.getByTestId('step-count').props.children
    const lit = () =>
      [1, 0].filter(
        (place) =>
          StyleSheet.flatten(screen.getByTestId(`correction-column-${place}`).props.style)?.color === colors.accent,
      )
    expect(count()).toBe('0 / 3')
    expect(lit()).toEqual([])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(count()).toBe('1 / 3')
    expect(lit()).toEqual([1])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(lit()).toEqual([0])
  })

  it('taps lightly on a right answer and buzzes on a miss', () => {
    renderRun()
    answerBeads(81)
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light)
    finishRightAnswerRoll()
    answerBeads(99)
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning)
  })
})

// Spec (runs) §2: the run follows the record's level as it moves.
describe('RunRunner following the level', () => {
  it('lays the next problem at the level the record has moved to, with a banner and a pulse', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    try {
      const { relevel, onAttempt } = renderRun({ level: 0 })
      answerBeads(81)
      relevel(1)
      announce.mockClear()
      finishRightAnswerRoll()
      expect(screen.getByTestId('run-level').props.children).toBe('レベル 1/6')
      expect(screen.getByTestId('level-banner', hidden)).toBeTruthy()
      expect(announce).toHaveBeenCalledWith('レベル 1')
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
      answerBeads(100)
      expect(onAttempt).toHaveBeenLastCalledWith(expect.objectContaining({ fade: 1 }))
    } finally {
      announce.mockRestore()
    }
  })

  // Spec (runs) §5: F2 → F3 is the first new look; the beads start at the
  // old one underneath and ease to the new once uncovered.
  it('eases the beads to a new look once the card is uncovered', () => {
    const { relevel } = renderRun({ level: 2 })
    answerBeads(81)
    relevel(3)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    expect(beadOpacities().every((opacity) => opacity === 1)).toBe(true)
    finishRoll()
    passTime(BEAD_EASE_MS + 100)
    expect(beadOpacities().every((opacity) => opacity === 0.35)).toBe(true)
  })

  // Review focus: a demotion shows its banner, and the beads come back at once.
  it('drops a level with a banner and no easing', () => {
    const { relevel } = renderRun({ level: 3 })
    answerBeads(80)
    relevel(2)
    moveOnFromMiss()
    expect(screen.getByTestId('run-level').props.children).toBe('レベル 2/6')
    expect(screen.getByTestId('level-banner', hidden)).toBeTruthy()
    expect(beadOpacities().every((opacity) => opacity === 1)).toBe(true)
    expect(Haptics.notificationAsync).not.toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
  })
})

describe('RunRunner ending', () => {
  // Spec (runs) §5: the rank-up pulse is felt once the results are uncovered,
  // not while the answered card still swipes over them.
  it('pulses a rank crossed only once the results are uncovered', () => {
    renderRun({ pointsBefore: 990 })
    answerBeads(81)
    finishRightAnswerRoll()
    for (const wrong of [1, 2]) {
      answerBeads(wrong)
      moveOnFromMiss()
    }
    answerBeads(3)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    passUntilSwiping()
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    expect(screen.getByTestId('results-score').props.children).not.toBe('0')
    expect(Haptics.notificationAsync).not.toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success)
    finishRoll()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    const successes = (Haptics.notificationAsync as jest.Mock).mock.calls.filter(
      ([type]) => type === Haptics.NotificationFeedbackType.Success,
    )
    expect(successes).toHaveLength(1)
  })

  // Spec (runs) §2: the third miss ends the run; after its review, つぎへ
  // brings the results.
  it('ends after the third miss, with the results', () => {
    const { onEnd } = renderRun()
    for (const wrong of [80, 99, 20]) {
      answerBeads(wrong)
      moveOnFromMiss()
    }
    expect(screen.getByTestId('run-results')).toBeTruthy()
    expect(screen.getByTestId('results-score').props.children).toBe('0')
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(0)
  })

  // Review focus: a second つぎへ on the third miss lays one results card.
  it('ends once however often つぎへ is pressed on the third miss', () => {
    const { onEnd } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    answerBeads(99)
    moveOnFromMiss()
    answerBeads(20)
    moveOnFromMiss()
    answerBeads(20)
    act(() => jest.advanceTimersByTime(500))
    const next = screen.getByTestId('review-next')
    fireEvent.press(next)
    fireEvent.press(next)
    passTime(2_000)
    expect(screen.getByTestId('results-score').props.children).toBe('54')
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(54)
  })

  it('swipes the last card off over the results', () => {
    renderRun()
    for (const wrong of [80, 99]) {
      answerBeads(wrong)
      moveOnFromMiss()
    }
    answerBeads(20)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    passUntilSwiping()
    expect(within(screen.getByTestId('card')).getByTestId('run-results')).toBeTruthy()
    expect(within(screen.getByTestId('card-leaving')).getByTestId('prompt').props.children).toBe('10に11をたす。')
    finishRoll()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
  })

  it('starts again or leaves from the results', () => {
    const { onAgain, onLeave } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    finishRoll()
    fireEvent.press(screen.getByTestId('run-again'))
    fireEvent.press(screen.getByTestId('run-done'))
    expect(onAgain).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  // Review: leaving writes progress and goes home, so a second way out (✕,
  // then おわる while the write is pending) must not go home twice.
  it.each([
    ['✕ then おわる', ['quit', 'run-done']],
    ['おわる twice', ['run-done', 'run-done']],
  ] as const)('leaves the results once, on %s', (_how, presses) => {
    const { onLeave } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    finishRoll()
    for (const testID of presses) fireEvent.press(screen.getByTestId(testID))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})

describe('RunRunner quitting', () => {
  it('asks, then leaves at once with nothing answered', () => {
    const { askQuit, onLeave, onEnd } = renderRun()
    fireEvent.press(screen.getByTestId('quit'))
    expect(askQuit).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('asks, then shows the results with the points so far', () => {
    const { onEnd, onLeave } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    finishRoll()
    expect(screen.getByTestId('results-score').props.children).toBe('54')
    expect(onEnd).toHaveBeenCalledWith(54)
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('stays when the learner keeps going', () => {
    renderRun({ askQuit: jest.fn() })
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    passTime(1_000)
    expect(screen.queryByTestId('run-results')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Review focus: ✕ confirmed while a card moves still ends on the results, once.
  it('goes to the results once when ✕ is confirmed during the 〇’s hold', () => {
    const { onEnd } = renderRun()
    answerBeads(81)
    fireEvent.press(screen.getByTestId('quit'))
    passTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 200)
    expect(screen.getByTestId('run-results')).toBeTruthy()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('goes to the results once when ✕ is confirmed mid-swipe', () => {
    const { onEnd } = renderRun()
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    fireEvent.press(screen.getByTestId('quit'))
    passTime(2 * ROLL_SWIPE_MS + 200)
    expect(screen.getByTestId('run-results')).toBeTruthy()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  // On the results, with nothing left to lose, ✕ just leaves.
  it('leaves from the results without asking', () => {
    const { askQuit, onLeave } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('quit'))
    finishRoll()
    fireEvent.press(screen.getByTestId('quit'))
    expect(askQuit).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})

// Spec (runs) §5, the owner (2026-10-06): "user should be able to go back to
// the previous problem if they wanted". ‹ in the bar shows an answered
// problem as it was left, on a card over the stack, and touches nothing of
// the run.
describe('RunRunner looking back', () => {
  const past = () => within(screen.getByTestId('card-past'))
  // The current card's three rods, highest place first.
  const rods = () => [0, 1, 2].map((i) => screen.getByTestId(`rod-${i}`).props.accessibilityValue.text).join('')

  it('shows the problem before, as it was left, and returns to the current one', () => {
    renderRun()
    expect(screen.queryByTestId('look-back')).toBeNull()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    expect(past().getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(past().getByTestId('maru')).toBeTruthy()
    expect(past().getByTestId('bead-reading').props.children).toBe('81')
    // Nothing on it can be answered or moved.
    for (const testID of ['submit', 'reset-beads', 'review-next', 'review-show']) {
      expect(past().queryByTestId(testID)).toBeNull()
    }
    expect(past().getByTestId('rod-1').props.accessibilityRole).toBeUndefined()
    expect(past().getByTestId('look-back-return')).toHaveTextContent('いまの問題にもどる')

    fireEvent.press(past().getByTestId('look-back-return'))
    expect(screen.queryByTestId('card-past')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.getByTestId('submit')).toBeTruthy()
  })

  it('shows a miss under its ✕, with what the beads read', () => {
    renderRun()
    answerBeads(80)
    moveOnFromMiss()
    fireEvent.press(screen.getByTestId('look-back'))
    expect(past().getByTestId('batsu')).toBeTruthy()
    expect(past().queryByTestId('maru')).toBeNull()
    expect(past().getByTestId('bead-reading').props.children).toBe('80')
    // The ✕ stays: it says which the problem was for as long as it is
    // looked at.
    act(() => jest.advanceTimersByTime(1_000))
    expect(StyleSheet.flatten(past().getByTestId('batsu').props.style).opacity).toBe(1)
  })

  it('goes further back, as far as the first', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    answerBeads(99)
    moveOnFromMiss()
    expect(screen.getByTestId('prompt').props.children).toBe('10に11をたす。')
    fireEvent.press(screen.getByTestId('look-back'))
    expect(past().getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(past().getByTestId('batsu')).toBeTruthy()
    fireEvent.press(screen.getByTestId('look-back'))
    expect(past().getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(past().getByTestId('maru')).toBeTruthy()
    expect(screen.queryByTestId('look-back')).toBeNull()
    fireEvent.press(past().getByTestId('look-back-return'))
    expect(screen.getByTestId('prompt').props.children).toBe('10に11をたす。')
  })

  // As with とじる before an answer (NEXT_GUARD_MS): the way back gives way
  // to もどす and こたえる (or つぎへ, or もう一回 and おわる), and a second
  // tap must not land on them.
  it('takes no tap on what it uncovers in the moment after the way back', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
    fireEvent.press(screen.getByTestId('look-back-return'))
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    passTime(NEXT_GUARD_MS)
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
  })

  it('keeps the current problem’s beads as the learner left them', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    setBeads(screen.getByTestId, 37, 3)
    expect(rods()).toBe('037')
    fireEvent.press(screen.getByTestId('look-back'))
    fireEvent.press(screen.getByTestId('look-back-return'))
    expect(rods()).toBe('037')
  })

  // The time spent looking back is not the current problem's.
  it('pauses the current problem’s clock while looking back', () => {
    let clock = 0
    const { onPoints } = renderRun({ now: () => clock })
    clock = 1_000
    answerBeads(81)
    finishRightAnswerRoll()
    clock = 2_000
    fireEvent.press(screen.getByTestId('look-back'))
    clock = 602_000
    fireEvent.press(screen.getByTestId('look-back-return'))
    clock = 603_000
    answerBeads(100)
    // 46 + 54, two in a row at F0, answered 2 s after it was uncovered
    // less the ten minutes spent looking back.
    const second = { problem: { op: 'add', digits: 2, a: 46, b: 54 }, calibrationMs: 900, level: 0, combo: 2 } as const
    expect(onPoints).toHaveBeenLastCalledWith(answerPoints({ ...second, answerMs: 2_000 }))
    expect(answerPoints({ ...second, answerMs: 2_000 })).toBeGreaterThan(answerPoints({ ...second, answerMs: 602_000 }))
  })

  it('records nothing, and opens the steps with the answer', () => {
    const { onAttempt, onPoints } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    fireEvent.press(past().getByTestId('steps-open'))
    expect(past().getByTestId('correction-answer').props.children).toBe('こたえは 81')
    expect(past().getByTestId('step-count').props.children).toBe('0 / 3')
    fireEvent.press(past().getByTestId('step-next'))
    expect(past().getByTestId('step-count').props.children).toBe('1 / 3')
    fireEvent.press(past().getByTestId('steps-close'))
    expect(past().queryByTestId('correction-answer')).toBeNull()
    expect(past().getByTestId('bead-reading').props.children).toBe('81')
    fireEvent.press(past().getByTestId('look-back-return'))
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onPoints).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('run-score').props.children).toBe('54点')
    expect(screen.getAllByTestId('life')).toHaveLength(3)
  })

  it('names a miss’s beads beside the answer in its steps', () => {
    renderRun()
    answerBeads(80)
    moveOnFromMiss()
    fireEvent.press(screen.getByTestId('look-back'))
    fireEvent.press(past().getByTestId('steps-open'))
    expect(past().getByTestId('correction-answer').props.children).toBe('こたえは 81　あなたの答え 80')
  })

  it('looks back from the results at the last problem answered, skipping one never answered', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    // ✕ on 46 + 54, unanswered, rolls it away to the results.
    fireEvent.press(screen.getByTestId('quit'))
    finishRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    expect(past().getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(past().getByTestId('look-back-return')).toHaveTextContent('結果にもどる')
    expect(screen.queryByTestId('look-back')).toBeNull()
    fireEvent.press(past().getByTestId('look-back-return'))
    expect(screen.queryByTestId('card-past')).toBeNull()
    expect(screen.getByTestId('run-results')).toBeTruthy()
  })

  it('offers nothing to look back at while a card moves', () => {
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    expect(screen.getByTestId('look-back')).toBeTruthy()
    answerBeads(100)
    // Under the 〇's hold.
    expect(screen.queryByTestId('look-back')).toBeNull()
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    expect(screen.queryByTestId('look-back')).toBeNull()
    finishRoll()
    expect(screen.getByTestId('look-back')).toBeTruthy()
  })

  it('ends the run from ✕ while looking back, closing the past card', () => {
    const { askQuit, onEnd } = renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    fireEvent.press(screen.getByTestId('quit'))
    expect(askQuit).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('card-past')).toBeNull()
    finishRoll()
    expect(screen.getByTestId('run-results')).toBeTruthy()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(54)
  })

  it('keeps looking back when the learner keeps going', () => {
    const askQuit = jest.fn()
    renderRun({ askQuit })
    answerBeads(81)
    finishRightAnswerRoll()
    fireEvent.press(screen.getByTestId('look-back'))
    fireEvent.press(screen.getByTestId('quit'))
    expect(askQuit).toHaveBeenCalledTimes(1)
    expect(past().getByTestId('prompt').props.children).toBe('23に58をたす。')
  })
})

// The owner's request (2026-09-23): a × problem shows its two numbers on
// beads under the product soroban, which 両落とし starts empty, and stepping
// through a miss points at the two digits of each 九九 in turn.
describe('RunRunner with ×', () => {
  const multiply: RunOverrides = {
    kind: { op: 'mul', digits: 2 },
    problems: [{ op: 'mul', digits: 2, a: 12, b: 34 }],
  }
  // The product soroban's rods only: the operand board has rods of its own.
  const onProduct: typeof screen.getByTestId = (id, options) =>
    within(screen.getByTestId('soroban-wrap')).getByTestId(id, options)
  const lit = (name: 'a' | 'b') =>
    [0, 1].filter((i) => within(screen.getByTestId(`operand-${name}`)).queryByTestId(`rod-highlight-${i}`) !== null)

  it('shows the two numbers under the soroban', () => {
    renderRun(multiply)
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('12 × 34')
    expect([lit('a'), lit('b')]).toEqual([[], []])
    // The owner's request (2026-09-24): 手順を見る sits where the steps
    // appear, below the board.
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('steps-open')).toBeGreaterThan(drawn.indexOf('operand-board'))
    expect(drawn.indexOf('steps-open')).toBeLessThan(drawn.indexOf('submit'))
  })

  it('shows no operand board for ＋', () => {
    renderRun()
    expect(screen.queryByTestId('operand-board')).toBeNull()
  })

  it('moves the highlight to the digits of each 九九 as a miss is stepped through', () => {
    renderRun(multiply)
    setBeads(onProduct, 407, 4)
    fireEvent.press(screen.getByTestId('submit'))
    // The panel opens at the start, with no 九九 yet.
    expect([lit('a'), lit('b')]).toEqual([[], []])

    // 1 × 3: the tens of each.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [0]])
    // 1 × 4: the tens of 12, the ones of 34.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[0], [1]])
    // 2 × 3 is two bead steps (+10 − 4), and both are its.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [0]])
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [0]])
    // 2 × 4: the ones of each.
    fireEvent.press(screen.getByTestId('step-next'))
    expect([lit('a'), lit('b')]).toEqual([[1], [1]])

    fireEvent.press(screen.getByTestId('step-restart'))
    expect([lit('a'), lit('b')]).toEqual([[], []])
  })

  // The owner's request (2026-09-23): the lines fill the space below ◀ ▶ in
  // bead mode, and the 九九 stepped to is scrolled into view there.
  it('scrolls the line of the 九九 stepped to into view below the controls', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    try {
      renderRun(multiply)
      setBeads(onProduct, 407, 4)
      fireEvent.press(screen.getByTestId('submit'))
      const layout = (testID: string, y: number, height: number) =>
        fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y, width: 300, height } } })
      // Room for the answer and three 九九 of the four.
      layout('step-lines-scroll', 0, 60)
      for (const [index, y] of [20, 38, 56, 74].entries()) layout(`correction-product-${index}`, y, 16)

      // 1 × 3 and 1 × 4 are both on show, as the start the panel opens at
      // was.
      for (let i = 0; i < 2; i++) fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).not.toHaveBeenCalled()
      // 2 × 3 reaches past the bottom, and 2 × 4 further still.
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 12, animated: true })
      fireEvent.press(screen.getByTestId('step-next'))
      fireEvent.press(screen.getByTestId('step-next'))
      expect(scrollTo).toHaveBeenLastCalledWith({ y: 30, animated: true })
      expect(scrollTo).toHaveBeenCalledTimes(2)
    } finally {
      scrollTo.mockRestore()
    }
  })

  // A 375 × 667 phone must still show the prompt above the soroban and
  // 手順を見る below the board, so there both are drawn smaller. On a
  // tall phone neither changes. The window mock is undone after each test,
  // even one that fails, so it cannot leak into the next.
  let restoreWindow = () => {}
  afterEach(() => {
    restoreWindow()
    restoreWindow = () => {}
  })

  it.each([
    ['a short window', 375, 667, SHORT_WINDOW_BEAD_SCALE, OPERAND_SHORT_WINDOW_SCALE],
    ['a tall window', 402, 874, beadModeScale(4, 402 - 40), OPERAND_MAX_SCALE],
  ])('sizes the soroban and the board for %s', (_window, width, height, product, operands) => {
    // As in QuestionView.test.tsx: `require` reaches the module object the
    // components' own imports read from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    restoreWindow = () => spy.mockRestore()
    renderRun(multiply)
    const padding = (container: string) =>
      StyleSheet.flatten(within(screen.getByTestId(container)).getByTestId('abacus-frame').props.style).padding
    expect(padding('soroban-wrap')).toBeCloseTo(FRAME_PADDING * product)
    expect(padding('operand-a')).toBeCloseTo(FRAME_PADDING * operands)
    expect(padding('operand-b')).toBeCloseTo(FRAME_PADDING * operands)
  })
})

// Spec (division) §3: a ÷ problem shows its divisor on a board under the
// soroban, which holds the dividend, and stepping through a miss points at
// the divisor digit of each 九九 taken off.
describe('RunRunner with ÷', () => {
  const divide: RunOverrides = {
    kind: { op: 'div', digits: 2 },
    problems: [{ op: 'div', digits: 2, a: 1692, b: 36 }],
  }
  // The working soroban's rods only: the divisor board has rods of its own.
  const onSoroban: typeof screen.getByTestId = (id, options) =>
    within(screen.getByTestId('soroban-wrap')).getByTestId(id, options)
  const lit = () =>
    [0, 1].filter((i) => within(screen.getByTestId('operand-b')).queryByTestId(`rod-highlight-${i}`) !== null)

  it('shows the divisor under the soroban, which starts at the dividend', () => {
    renderRun(divide)
    expect(screen.getByTestId('prompt').props.children).toBe('1692を36でわる。')
    expect(screen.getByTestId('operand-board').props.accessibilityLabel).toBe('わる数 36')
    expect(screen.queryByTestId('operand-a')).toBeNull()
    expect(lit()).toEqual([])
    expect([0, 1, 2, 3, 4].map((i) => onSoroban(`rod-${i}`).props.accessibilityValue.text).join('')).toBe('01692')
  })

  it('takes the quotient left where 商除法 leaves it, with zeros below it', () => {
    const { onAttempt } = renderRun(divide)
    setBeads(onSoroban, 47000, 5)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith({ id: 'div:2', correct: true, pace: null, assisted: false, fade: 0 })
    finishRightAnswerRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('1692を36でわる。')
  })

  it('moves the highlight to the divisor digit of each 九九 as a miss is stepped through', () => {
    renderRun(divide)
    // 47 on the lowest rods is not where 商除法 leaves the quotient.
    setBeads(onSoroban, 47, 5)
    fireEvent.press(screen.getByTestId('submit'))
    // Read from the quotient's ones rod, the learner's beads are 0.047.
    expect(screen.getByTestId('correction-answer').props.children).toBe('こたえは 47　あなたの答え 0.047')
    expect(lit()).toEqual([])

    const total = Number(String(screen.getByTestId('step-count').props.children).split(' / ')[1])
    // What each step lights, and which line, one entry per group stepped
    // into.
    const seen: string[] = []
    for (let i = 0; i < total; i++) {
      fireEvent.press(screen.getByTestId('step-next'))
      const line = screen
        .getAllByTestId(/^correction-(quotient|subtract)-/)
        .find((node) => StyleSheet.flatten(node.props.style)?.color === colors.accent)
      const entry = `${String(line?.props.testID)} ${JSON.stringify(lit())}`
      if (seen[seen.length - 1] !== entry) seen.push(entry)
    }
    // Placing 4 and 7 lights no divisor digit; each 九九 lights its own.
    expect(seen).toEqual([
      'correction-quotient-0 []',
      'correction-subtract-1 [0]',
      'correction-subtract-2 [1]',
      'correction-quotient-3 []',
      'correction-subtract-4 [0]',
      'correction-subtract-5 [1]',
    ])
    // The last state is where 商除法 leaves the quotient, zeros below it.
    expect([0, 1, 2, 3, 4].map((i) => onSoroban(`rod-${i}`).props.accessibilityValue.text).join('')).toBe('47000')
  })

  // Spec (division) §1: beads at every size, scaled to fit, including
  // 3けた's seven rods, with the board at the × boards' size.
  let restoreWindow = () => {}
  afterEach(() => {
    restoreWindow()
    restoreWindow = () => {}
  })

  it.each([
    ['a short window', 375, 667, OPERAND_SHORT_WINDOW_SCALE],
    ['a tall window', 402, 874, OPERAND_MAX_SCALE],
  ])('fits a 3けた problem’s seven rods and the board to %s', (_window, width, height, board) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in the × test above
    const reactNative = require('react-native')
    const spy = jest
      .spyOn(reactNative, 'useWindowDimensions')
      .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
    restoreWindow = () => spy.mockRestore()
    renderRun({ kind: { op: 'div', digits: 3 }, problems: [{ op: 'div', digits: 3, a: 202032, b: 976 }] })
    const padding = (container: string) =>
      StyleSheet.flatten(within(screen.getByTestId(container)).getByTestId('abacus-frame').props.style).padding
    expect(onSoroban('rod-6')).toBeTruthy()
    expect(padding('soroban-wrap')).toBeCloseTo(FRAME_PADDING * beadModeScale(7, width - 40))
    expect(padding('operand-b')).toBeCloseTo(FRAME_PADDING * board)
  })
})

// Spec (見取算) §2: the problem is a column above the soroban, and stepping
// through a miss highlights the number each move belongs to.
describe('RunRunner with 見取算', () => {
  const column: MitoriProblem = { op: 'mitori', digits: 2, terms: [47, 30, -23, 61, -19] }
  const mitoriRound: RunOverrides = { kind: { op: 'mitori', digits: 2 }, problems: [column] }
  const lit = () =>
    [0, 1, 2, 3, 4].filter((row) => {
      const number = within(screen.getByTestId(`term-${row}`)).getByText(String(Math.abs(column.terms[row] ?? 0)))
      return StyleSheet.flatten(number.props.style).color === colors.accent
    })
  // How many bead steps the moves of number `term` take.
  const stepsOf = (term: number) =>
    problemSteps(column).reduce((n, g) => (g.kind === 'column' && g.term === term ? n + g.steps.length : n), 0)

  it('shows the column, read as one sentence, and the soroban starting at the first number', () => {
    renderRun(mitoriRound)
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、ひく23、たす61、ひく19。')
    expect(screen.getByTestId('rod-1').props.accessibilityValue.text).toBe('4')
    expect(screen.getByTestId('rod-2').props.accessibilityValue.text).toBe('7')
    expect(lit()).toEqual([])
  })

  it('takes the total on the beads', () => {
    const { onAttempt } = renderRun(mitoriRound)
    answerBeads(96)
    expect(onAttempt).toHaveBeenCalledWith({ id: 'mitori:2', correct: true, pace: null, assisted: false, fade: 0 })
  })

  it('highlights the number, and its line, of each move stepped through', () => {
    renderRun(mitoriRound)
    answerBeads(95)
    expect(lit()).toEqual([])
    fireEvent.press(screen.getByTestId('step-next'))
    expect(lit()).toEqual([1])
    expect(StyleSheet.flatten(screen.getByTestId('correction-term-1-1').props.style)?.color).toBe(colors.accent)
    // Past 30's moves, onto 23's.
    for (let i = 1; i < stepsOf(1) + 1; i++) fireEvent.press(screen.getByTestId('step-next'))
    expect(lit()).toEqual([2])
    fireEvent.press(screen.getByTestId('step-restart'))
    expect(lit()).toEqual([])
  })

  // The owner (2026-09-27): it was hard to tell which clicks were −59's and
  // which +39's. A number's beads stay coloured across its rods, and its
  // heading and lines are shaded together, until the next number begins.
  it('keeps a number coloured and shaded as one, across its rods', () => {
    renderRun(mitoriRound)
    answerBeads(95)
    const tinted = () => tintedBeads(screen.getByTestId('soroban-wrap'), 3)
    const shaded = (testID: string) =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style)?.backgroundColor === colors.accentSoft
    // Into −23: its tens move (rod 1), then the first step of its ones (rod 2).
    for (let i = 0; i < stepsOf(1) + 2; i++) fireEvent.press(screen.getByTestId('step-next'))
    expect(tinted().some((bead) => bead.startsWith('1 ') && bead.endsWith(' group'))).toBe(true)
    expect(tinted().some((bead) => bead.startsWith('2 ') && bead.endsWith(' latest'))).toBe(true)
    expect([shaded('correction-heading-0'), shaded('correction-heading-1'), shaded('correction-term-2-1')]).toEqual([
      false,
      true,
      true,
    ])
  })

  // The owner (2026-09-30): every level is answered on the beads, so the
  // column stays above the soroban however faded its beads are.
  it('shows the column above the soroban at a faded level too', () => {
    renderRun({ ...mitoriRound, level: 3 })
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、ひく23、たす61、ひく19。')
    expect(screen.getByTestId('term-4')).toBeTruthy()
    const drawn = screen.root
      .findAll((node) => typeof node.type === 'string' && typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string)
    expect(drawn.indexOf('prompt')).toBeLessThan(drawn.indexOf('abacus-frame'))
  })

  // Review focus: 3けた can total four digits, and the beads must take them.
  it('takes a four-digit 3けた total on the beads', () => {
    const { onAttempt } = renderRun({
      kind: { op: 'mitori', digits: 3 },
      problems: [{ op: 'mitori', digits: 3, terms: [999, 999, 999, -999, 999] }],
      level: 3,
    })
    setBeads(screen.getByTestId, 2997, 4)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onAttempt).toHaveBeenCalledWith(expect.objectContaining({ id: 'mitori:3', correct: true }))
  })

  it('draws a two-number problem’s prompt as text, with no column', () => {
    renderRun()
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.queryByTestId('term-0')).toBeNull()
  })

  describe('on a short window', () => {
    let restoreWindow = () => {}
    afterEach(() => {
      restoreWindow()
      restoreWindow = () => {}
    })

    it.each([
      ['a short window', 375, 667, SHORT_WINDOW_BEAD_SCALE],
      ['a tall window', 402, 874, beadModeScale(3, 402 - 40)],
    ])('sizes the soroban for %s, as with a board', (_window, width, height, scale) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- as in the × test above
      const reactNative = require('react-native')
      const spy = jest
        .spyOn(reactNative, 'useWindowDimensions')
        .mockReturnValue({ width, height, scale: 2, fontScale: 1 })
      restoreWindow = () => spy.mockRestore()
      renderRun(mitoriRound)
      const frame = within(screen.getByTestId('soroban-wrap')).getByTestId('abacus-frame')
      expect(StyleSheet.flatten(frame.props.style).padding).toBeCloseTo(FRAME_PADDING * scale)
    })

  })
})

// Spec (card swipe, 2026-09-29): the next problem is already in its place
// underneath, still, and the answered card is swiped off over it, so there
// is nothing for the eye to chase and no blank between them (the owner:
// sliding "makes human eye to chase it"; fading "is still distracting").
describe('RunRunner swiping from problem to problem', () => {
  it('holds a right answer under its 〇, then swipes it off over the next problem', () => {
    const { onAttempt } = renderRun()
    answerBeads(81)
    // Recorded at once; the answered problem stays, stamped, and cannot be
    // answered again.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(screen.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    // Nothing underneath yet while the 〇 is held.
    passTime(ROLL_HOLD_MS - 50)
    expect(screen.getAllByTestId('prompt')).toHaveLength(1)
    passUntilSwiping()
    // The next problem underneath; the answered card, 〇 and all, on top of it.
    expect(screen.getAllByTestId(/^card/).map((card) => card.props.testID)).toEqual(['card', 'card-leaving'])
    expect(within(screen.getByTestId('card')).getByTestId('prompt').props.children).toBe('46に54をたす。')
    const leaving = within(screen.getByTestId('card-leaving'))
    expect(leaving.getByTestId('prompt').props.children).toBe('23に58をたす。')
    expect(leaving.getByTestId('maru')).toBeTruthy()
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(screen.queryByTestId('maru')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
  })

  it('leaves the next problem still as the answered card swipes fully off to the left', () => {
    const timing = jest.spyOn(Animated, 'timing')
    renderRun()
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    const swipes = timing.mock.calls.map(([, config]) => config).filter((config) => config.duration === ROLL_SWIPE_MS)
    timing.mockRestore()
    // Nothing moves or fades the next problem.
    expect(styleOf('card').transform).toBeUndefined()
    expect(styleOf('card').opacity).toBeUndefined()
    // One motion only: the answered card, to past the screen's left edge, on
    // the native thread.
    expect(swipes).toHaveLength(1)
    expect(swipes[0]?.toValue).toBeLessThanOrEqual(-Dimensions.get('window').width)
    expect(swipes[0]?.useNativeDriver).toBe(true)
  })

  // The swipe must not start before the next problem is there to uncover.
  it('starts the swipe only once the next problem is underneath', () => {
    const timing = Animated.timing
    const underneathAsItStarts: unknown[] = []
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (config.duration === ROLL_SWIPE_MS) {
        underneathAsItStarts.push(within(screen.getByTestId('card')).queryByTestId('prompt')?.props.children)
      }
      return timing(value, config)
    })
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    spy.mockRestore()
    expect(underneathAsItStarts).toEqual(['46に54をたす。'])
  })

  // On a phone the native driver leaves the value where the swipe sent it,
  // off the screen; the next answered card must start back in its place.
  it('starts every swipe with the answered card in its place', () => {
    const timing = Animated.timing
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      const animation = timing(value, config)
      return {
        ...animation,
        start: (callback) =>
          animation.start((result) => {
            if (result.finished && typeof config.toValue === 'number') (value as Animated.Value).setValue(config.toValue)
            callback?.(result)
          }),
      }
    })
    renderRun()
    answerBeads(81)
    finishRightAnswerRoll()
    answerBeads(100)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    spy.mockRestore()
    expect(within(screen.getByTestId('card-leaving')).getByTestId('prompt').props.children).toBe('46に54をたす。')
    expect(movedBy('card-leaving')).toBe(0)
  })

  it('swipes to the next problem after a miss’s つぎへ', () => {
    renderRun()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    fireEvent.press(screen.getByTestId('review-next'))
    expect(screen.getByTestId('roll-blocker')).toBeTruthy()
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Review: on a phone a second tap can land on つぎへ before the blocker is
  // drawn, and reach it after the swipe has started. It must not stop the
  // swipe and leave the answered card over the next for good.
  it('moves on once when つぎへ is pressed again as the swipe starts', () => {
    renderRun()
    answerBeads(80)
    act(() => jest.advanceTimersByTime(500))
    const next = screen.getByTestId('review-next')
    fireEvent.press(next)
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    fireEvent.press(next)
    passTime(2_000)
    expect(screen.queryByTestId('card-leaving')).toBeNull()
    expect(screen.queryByTestId('roll-blocker')).toBeNull()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
  })

  // Review focus: leaving mid-roll keeps the answer and fires nothing later.
  it('keeps the answer and fires nothing once unmounted during the hold', () => {
    const { onAttempt } = renderRun()
    answerBeads(81)
    expect(onAttempt).toHaveBeenCalledTimes(1)
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_HOLD_MS + ROLL_SWIPE_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('fires nothing once unmounted mid-swipe', () => {
    const { onAttempt } = renderRun()
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    expect(screen.getByTestId('card-leaving')).toBeTruthy()
    screen.unmount()
    expect(() => act(() => jest.advanceTimersByTime(ROLL_SWIPE_MS + 50))).not.toThrow()
    expect(onAttempt).toHaveBeenCalledTimes(1)
  })

  it('fades the answered card away in place with Reduce Motion on', async () => {
    // Once only: restoring RN's own jest mock of it would leave it returning
    // undefined for the tests after this one.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValueOnce(true)
    // As on a phone, each value ends where it was sent.
    const timing = Animated.timing
    const swipes: { value: unknown; toValue: unknown }[] = []
    const spy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
      if (config.duration === ROLL_SWIPE_MS) swipes.push({ value, toValue: config.toValue })
      const animation = timing(value, config)
      return {
        ...animation,
        start: (callback) =>
          animation.start((result) => {
            if (result.finished && typeof config.toValue === 'number') (value as Animated.Value).setValue(config.toValue)
            callback?.(result)
          }),
      }
    })
    // The animated opacity the leaving card is drawn with (its host view gets
    // only the number).
    const leavingOpacity = () => StyleSheet.flatten(screen.UNSAFE_getAllByProps({ testID: 'card-leaving' })[0]?.props.style).opacity
    renderRun()
    await act(async () => {})
    answerBeads(81)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    // The next problem underneath, still; the answered card fading to nothing
    // and not moving.
    expect(styleOf('card').opacity).toBeUndefined()
    expect(swipes).toEqual([{ value: leavingOpacity(), toValue: 0 }])
    finishRoll()
    expect(screen.getByTestId('prompt').props.children).toBe('46に54をたす。')
    // The next answered card starts fully there, not where the last fade left
    // the value.
    answerBeads(100)
    passTime(ROLL_HOLD_MS)
    passUntilSwiping()
    spy.mockRestore()
    expect(styleOf('card-leaving').opacity).toBe(1)
    expect(swipes).toHaveLength(2)
  })
})
