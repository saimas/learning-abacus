import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import type { FlashProblem } from '@/domain/problem'
import { BEAD_SLIDE_MS } from '@/ui/abacus/Bead'
import { setBeads, textOf } from '@/ui/session/testing'
import { FLASH_GAP_MS, FLASH_LEAD_MS, FLASH_SHOW_MS } from '@/ui/session/useFlash'
import { colors } from '@/ui/theme'
import { ProblemQuestion } from './ProblemQuestion'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The beads follow 47, 77, 100 and 161; the answer is 180. Two digits:
// three rods.
const numbers: FlashProblem = { op: 'flash', digits: 2, terms: [47, 30, 23, 61, 19] }

// The column held under the flash is hidden from VoiceOver.
const hidden = { includeHiddenElements: true }

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

// Lets `ms` pass a frame at a time, as a phone renders.
function passTime(ms: number) {
  for (let t = 0; t < ms; t += 16) act(() => jest.advanceTimersByTime(Math.min(16, ms - t)))
}

// The whole flash, frame by frame: each frame's time starts once it is shown.
function playThrough() {
  advance(FLASH_LEAD_MS)
  for (let k = 0; k < 4; k++) {
    advance(FLASH_SHOW_MS)
    advance(FLASH_GAP_MS)
  }
  advance(FLASH_SHOW_MS)
}

// The three rods, highest place first.
const rods = () => [0, 1, 2].map((i) => screen.getByTestId(`rod-${i}`).props.accessibilityValue.text).join('')
const flashed = () => screen.queryByTestId('flash-number')?.props.children ?? null
const counter = () => screen.queryByTestId('flash-counter')?.props.children ?? null
// A rod takes taps and VoiceOver's adjustments only while the beads are free.
const beadsFree = () => screen.getByTestId('rod-2').props.accessibilityRole === 'adjustable'
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true
const HINT = '珠をタップして動かします'
// Spec (home menu) §4: the line in the prompt's place once the flash is over.
const ADD_LAST = '5つめの数を珠でたして、\nこたえましょう'
const addLast = () => screen.queryByTestId('flash-add-last')?.props.children ?? null

type Options = { fade?: FadeLevel; revealed?: boolean }

function question(options: Options, onSubmit: jest.Mock) {
  return (
    <ProblemQuestion
      problem={numbers}
      fade={options.fade ?? 0}
      revealed={options.revealed ?? true}
      shownAt={0}
      // The fake clock, so a flash's end is the moment its last timer fired.
      now={() => jest.now()}
      onSubmit={onSubmit}
      onMoveOn={jest.fn()}
    />
  )
}

function renderFlash(options: Options = {}) {
  const onSubmit = jest.fn()
  render(question(options, onSubmit))
  return { onSubmit, rerender: (next: Options) => screen.rerender(question(next, onSubmit)) }
}

// Spec (flash) §2: the numbers flash one at a time in the prompt's place and
// the beads follow the running total; the last step is the learner's.
describe('ProblemQuestion with a フラッシュ暗算 problem', () => {
  it('flashes each number in turn, the beads following the running total', () => {
    renderFlash()
    // The card arrives with the soroban at 0 and nothing flashed yet.
    expect([flashed(), counter(), rods()]).toEqual([null, null, '000'])
    advance(FLASH_LEAD_MS)
    expect([flashed(), counter(), rods()]).toEqual(['47', '1/5', '000'])
    advance(FLASH_SHOW_MS)
    expect([flashed(), counter(), rods()]).toEqual([null, null, '047'])
    advance(FLASH_GAP_MS)
    expect([flashed(), counter(), rods()]).toEqual(['30', '2/5', '047'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('077')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter()]).toEqual(['23', '3/5'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('100')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter()]).toEqual(['61', '4/5'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('161')
    advance(FLASH_GAP_MS)
    expect([flashed(), counter(), rods()]).toEqual(['19', '5/5', '161'])
    // The fifth flashes alone: the beads stay on the first four's total.
    advance(FLASH_SHOW_MS)
    expect([flashed(), counter(), rods()]).toEqual([null, null, '161'])
  })

  it('jumps the beads to each total, with no slide', () => {
    renderFlash()
    const heavenTop = () =>
      StyleSheet.flatten(within(screen.getByTestId('rod-2')).getByTestId('bead-heaven').props.style).top
    const before = heavenTop()
    advance(FLASH_LEAD_MS)
    advance(FLASH_SHOW_MS)
    // 47: the ones rod shows 7, its heaven bead down at once.
    const jumped = heavenTop()
    expect(jumped).not.toBe(before)
    passTime(BEAD_SLIDE_MS + 50)
    expect(heavenTop()).toBe(jumped)
  })

  it('takes no taps and no answer while the numbers play, and both once they are over', () => {
    const { onSubmit } = renderFlash()
    expect(beadsFree()).toBe(false)
    expect(disabled('submit')).toBe(true)
    expect(disabled('reset-beads')).toBe(true)
    // The beads take no taps, so no hint says to tap them.
    expect(screen.queryByText(HINT)).toBeNull()
    fireEvent(screen.getByTestId('rod-2'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    fireEvent.press(screen.getByTestId('submit'))
    expect(rods()).toBe('000')
    expect(onSubmit).not.toHaveBeenCalled()
    // 手順を見る stays offered.
    expect(screen.getByTestId('steps-open')).toBeTruthy()

    playThrough()
    expect(beadsFree()).toBe(true)
    expect(disabled('reset-beads')).toBe(false)
    expect(screen.getByText(HINT)).toBeTruthy()
    // こたえる waits for the beads to move off the four's total.
    expect(disabled('submit')).toBe(true)
    setBeads(screen.getByTestId, 180, 3)
    expect(disabled('submit')).toBe(false)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true, assisted: false }))
  })

  // Spec (flash) §4: the flash starts when the card is uncovered, not while
  // it lies underneath the card swiping off.
  it('waits for its card to be uncovered', () => {
    const { rerender } = renderFlash({ revealed: false })
    advance(5_000)
    expect([flashed(), rods()]).toEqual([null, '000'])
    expect(beadsFree()).toBe(false)
    rerender({ revealed: true })
    advance(FLASH_LEAD_MS - 1)
    expect(flashed()).toBeNull()
    advance(1)
    expect(flashed()).toBe('47')
  })

  // The first number and the answer go in VoiceOver's queue: the first so a
  // 「レベル N」 spoken as the card arrives is not cut off, the answer so it
  // waits for the fifth number's reading. Numbers 2 to 5 interrupt, so speech
  // never drifts behind the screen.
  it('says each number as it appears, then asks for the answer', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const queued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
    try {
      renderFlash()
      announce.mockClear()
      queued.mockClear()
      playThrough()
      expect(announce.mock.calls.map(([said]) => said)).toEqual(['30', '23', '61', '19'])
      expect(queued.mock.calls).toEqual([
        ['47', { queue: true }],
        ['こたえてください', { queue: true }],
      ])
      expect(queued.mock.invocationCallOrder[1]).toBeGreaterThan(Math.max(...announce.mock.invocationCallOrder))
    } finally {
      queued.mockRestore()
      announce.mockRestore()
    }
  })

  // Review focus: 手順を見る mid-flash ends it at once, and for good.
  it('ends the flash at once on 手順を見る, with the panel open on the five numbers', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const queued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
    try {
      const { onSubmit } = renderFlash()
      advance(FLASH_LEAD_MS)
      expect(flashed()).toBe('47')
      announce.mockClear()
      queued.mockClear()
      const opened = jest.now()
      fireEvent.press(screen.getByTestId('steps-open'))
      expect([flashed(), counter()]).toEqual([null, null])
      // The steps show every number, as 見取算's column, from the first.
      expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、たす23、たす61、たす19。')
      expect(screen.getByTestId('term-4')).toBeTruthy()
      expect(rods()).toBe('047')
      // Nothing more flashes, and nothing more is said.
      advance(10_000)
      expect(flashed()).toBeNull()
      expect(announce).not.toHaveBeenCalled()
      expect(queued).not.toHaveBeenCalled()
      // Closed: the beads are the learner's, on the four's total.
      fireEvent.press(screen.getByTestId('steps-close'))
      expect(rods()).toBe('161')
      expect(beadsFree()).toBe(true)
      expect(flashed()).toBeNull()
      setBeads(screen.getByTestId, 180, 3)
      // Past the guard after とじる.
      advance(500)
      fireEvent.press(screen.getByTestId('submit'))
      // Spec (flash) §4: the flash ended at the press, and the answer's
      // clock runs from there.
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ correct: true, assisted: true, flashEndedAt: opened }),
      )
    } finally {
      queued.mockRestore()
      announce.mockRestore()
    }
  })

  // Spec (flash) §2: the numbers are not seen again until the steps show them,
  // unless the flash is played again (もう一度見る).
  it('shows none of the numbers once the flash is over, holding the column’s height', () => {
    renderFlash()
    playThrough()
    expect(flashed()).toBeNull()
    expect(screen.queryByText('19')).toBeNull()
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('フラッシュ暗算、5口')
    expect(screen.getByTestId('term-4', hidden)).toBeTruthy()
  })

  // Spec (flash) §2: the review shows the five numbers as a column, and how
  // the total builds number by number.
  it('shows the five numbers as a column under a miss, lit as its steps are stepped through', () => {
    renderFlash()
    playThrough()
    setBeads(screen.getByTestId, 170, 3)
    fireEvent.press(screen.getByTestId('submit'))
    // F0 coaches: the panel opens with the ✕, on the first number.
    expect(screen.getByTestId('prompt').props.accessibilityLabel).toBe('47、たす30、たす23、たす61、たす19。')
    expect(textOf(screen.getByTestId('correction-heading-0'))).toBe('30をたす　47 → 77')
    expect(rods()).toBe('047')
    fireEvent.press(screen.getByTestId('step-next'))
    const thirty = within(screen.getByTestId('term-1')).getByText('30')
    expect(StyleSheet.flatten(thirty.props.style).color).toBe(colors.accent)
  })

  // Review focus, spec (flash) §4: the answer's clock runs from the flash's end.
  it('says when its flash ended, for the answer’s clock', () => {
    const { onSubmit } = renderFlash()
    const uncovered = jest.now()
    playThrough()
    const ended = jest.now()
    expect(ended - uncovered).toBe(5_300)
    advance(2_000)
    setBeads(screen.getByTestId, 180, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, t: ended + 2_000, flashEndedAt: ended }),
    )
  })

  // Spec (flash) §2: from level 3 the beads that follow along fade too.
  it('draws the beads it follows at the level’s fade', () => {
    renderFlash({ fade: 3 })
    advance(FLASH_LEAD_MS)
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('047')
    for (const layer of within(screen.getByTestId('soroban-wrap')).getAllByTestId('fade-layer')) {
      expect(StyleSheet.flatten(layer.props.style).opacity).toBe(0.35)
    }
  })

  // Review focus: the question gone mid-flash (戻る, ✕, leaving) says nothing more.
  it('says nothing more once gone mid-flash', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const queued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
    try {
      renderFlash()
      advance(FLASH_LEAD_MS)
      screen.unmount()
      announce.mockClear()
      queued.mockClear()
      expect(() => advance(10_000)).not.toThrow()
      expect(announce).not.toHaveBeenCalled()
      expect(queued).not.toHaveBeenCalled()
    } finally {
      queued.mockRestore()
      announce.mockRestore()
    }
  })

  // Spec (home menu) §4: once the flash is over, until the answer is in, one
  // line in the prompt's place says what is left to do. The owner
  // (2026-10-07) took こたえる and もどす for broken without it.
  it('says to add the fifth number on the beads once the flash is over, and not while it plays', () => {
    renderFlash()
    expect(addLast()).toBeNull()
    advance(FLASH_LEAD_MS)
    for (let k = 0; k < 4; k++) {
      expect(addLast()).toBeNull()
      advance(FLASH_SHOW_MS)
      expect(addLast()).toBeNull()
      advance(FLASH_GAP_MS)
    }
    // The fifth number, to its last moment.
    advance(FLASH_SHOW_MS - 1)
    expect([flashed(), addLast()]).toEqual(['19', null])
    advance(1)
    expect([flashed(), addLast()]).toEqual([null, ADD_LAST])
    // In the box that holds the column's height, so the soroban stays put,
    // and VoiceOver still reads the box as the problem's name.
    const box = screen.getByTestId('prompt')
    expect(within(box).getByTestId('flash-add-last')).toBeTruthy()
    expect(within(box).getByTestId('flash-column-space', hidden)).toBeTruthy()
    expect(box.props.accessibilityLabel).toBe('フラッシュ暗算、5口')
  })

  // The owner (2026-10-08): "user should be able to retry the フラッシュ暗算
  // on the question". Beside 手順を見る, off while the numbers play.
  it('offers もう一度見る beside 手順を見る, off until the flash is over', () => {
    renderFlash()
    expect(disabled('flash-replay')).toBe(true)
    advance(FLASH_LEAD_MS)
    advance(FLASH_SHOW_MS)
    advance(FLASH_GAP_MS)
    expect(flashed()).toBe('30')
    // Pressed mid-flash, it does nothing: the flash goes on to the third.
    fireEvent.press(screen.getByTestId('flash-replay'))
    advance(FLASH_SHOW_MS)
    advance(FLASH_GAP_MS)
    expect([flashed(), counter()]).toEqual(['23', '3/5'])
    for (let k = 0; k < 2; k++) {
      expect(disabled('flash-replay')).toBe(true)
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
    }
    advance(FLASH_SHOW_MS)
    expect(flashed()).toBeNull()
    expect(disabled('flash-replay')).toBe(false)
    expect(screen.getByTestId('flash-replay')).toHaveTextContent('もう一度見る')
    // In one row with 手順を見る.
    const offers = screen.getByTestId('step-offers')
    expect(within(offers).getByTestId('steps-open')).toBeTruthy()
    expect(within(offers).getByTestId('flash-replay')).toBeTruthy()
  })

  // As the first play: the first number queued, 2 to 5 interrupting, then
  // 「こたえてください」 queued again; nothing more once 手順を見る cuts a
  // replay short.
  it('says each number again as a replay plays, and nothing once 手順を見る ends it', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const queued = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
    try {
      renderFlash()
      playThrough()
      announce.mockClear()
      queued.mockClear()
      fireEvent.press(screen.getByTestId('flash-replay'))
      playThrough()
      expect(announce.mock.calls.map(([said]) => said)).toEqual(['30', '23', '61', '19'])
      expect(queued.mock.calls).toEqual([
        ['47', { queue: true }],
        ['こたえてください', { queue: true }],
      ])
      announce.mockClear()
      queued.mockClear()
      fireEvent.press(screen.getByTestId('flash-replay'))
      advance(FLASH_LEAD_MS)
      fireEvent.press(screen.getByTestId('steps-open'))
      advance(10_000)
      expect(announce).not.toHaveBeenCalled()
      expect(queued.mock.calls).toEqual([['47', { queue: true }]])
    } finally {
      queued.mockRestore()
      announce.mockRestore()
    }
  })

  // A replay is the first play again: the beads follow the running total,
  // take no taps and no answer, and come back to the first four's total.
  it('plays the five numbers again on もう一度見る, the learner’s beads put back after', () => {
    renderFlash()
    playThrough()
    setBeads(screen.getByTestId, 170, 3)
    fireEvent.press(screen.getByTestId('flash-replay'))
    expect([flashed(), rods(), addLast()]).toEqual([null, '000', null])
    expect(beadsFree()).toBe(false)
    expect(disabled('submit')).toBe(true)
    expect(disabled('flash-replay')).toBe(true)
    advance(FLASH_LEAD_MS)
    expect([flashed(), counter()]).toEqual(['47', '1/5'])
    advance(FLASH_SHOW_MS)
    expect(rods()).toBe('047')
    advance(FLASH_GAP_MS)
    for (let k = 0; k < 3; k++) {
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
    }
    expect([flashed(), rods()]).toEqual(['19', '161'])
    advance(FLASH_SHOW_MS)
    expect([flashed(), rods(), addLast()]).toEqual([null, '161', ADD_LAST])
    expect(beadsFree()).toBe(true)
    expect(disabled('flash-replay')).toBe(false)
  })

  // The owner chose a replay to cost time only: the answer's clock keeps
  // running from the first flash's end, and the answer is not "with help".
  it('keeps the answer’s clock from the first flash’s end through a replay', () => {
    const { onSubmit } = renderFlash()
    playThrough()
    const ended = jest.now()
    fireEvent.press(screen.getByTestId('flash-replay'))
    playThrough()
    setBeads(screen.getByTestId, 180, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, assisted: false, flashEndedAt: ended }),
    )
  })

  it('keeps the answer’s clock from the first flash’s end when 手順を見る ends a replay', () => {
    const { onSubmit } = renderFlash()
    playThrough()
    const ended = jest.now()
    fireEvent.press(screen.getByTestId('flash-replay'))
    advance(FLASH_LEAD_MS)
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(flashed()).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    setBeads(screen.getByTestId, 180, 3)
    advance(500)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ assisted: true, flashEndedAt: ended }))
  })

  // Before answering only (the owner, 2026-10-08): a miss's review lists the
  // five numbers in its steps, and the steps' panel takes the button's place.
  it('offers no もう一度見る once answered, nor with the steps open', () => {
    renderFlash()
    playThrough()
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(screen.queryByTestId('flash-replay')).toBeNull()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(screen.getByTestId('flash-replay')).toBeTruthy()
    setBeads(screen.getByTestId, 170, 3)
    advance(500)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('flash-replay')).toBeNull()
  })

  it('offers no もう一度見る once answered right', () => {
    renderFlash()
    playThrough()
    setBeads(screen.getByTestId, 180, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(screen.queryByTestId('flash-replay')).toBeNull()
  })

  // Review focus: a card laid underneath has not flashed yet.
  it('says nothing while its card lies underneath', () => {
    const { rerender } = renderFlash({ revealed: false })
    advance(10_000)
    expect(addLast()).toBeNull()
    rerender({ revealed: true })
    expect(addLast()).toBeNull()
    playThrough()
    expect(addLast()).toBe(ADD_LAST)
  })

  // Review focus, spec (home menu) §4: it gives way to the column whenever
  // the step panel is open, and is back once the panel closes.
  it('gives way to the column while the step panel is open', () => {
    renderFlash()
    advance(FLASH_LEAD_MS)
    // 手順を見る mid-flash ends the flash: the column, not the line.
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(addLast()).toBeNull()
    expect(screen.getByTestId('term-4')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-close'))
    expect(addLast()).toBe(ADD_LAST)
    fireEvent.press(screen.getByTestId('steps-open'))
    expect(addLast()).toBeNull()
  })

  // Review focus: not once the answer is in, 〇 or ✕.
  it('says nothing once the answer is right', () => {
    const { onSubmit } = renderFlash()
    playThrough()
    setBeads(screen.getByTestId, 180, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: true }))
    expect(addLast()).toBeNull()
  })

  // At level 0 a miss opens the panel with its ✕ (the column); at level 2
  // coaching is silent and the panel waits for こたえを見る, so the prompt's
  // place is the flash's own box again, and it must stay quiet.
  it.each([0, 2] as const)('says nothing once the answer is wrong, at level %i', (fade) => {
    const { onSubmit } = renderFlash({ fade })
    playThrough()
    setBeads(screen.getByTestId, 170, 3)
    fireEvent.press(screen.getByTestId('submit'))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ correct: false }))
    expect(addLast()).toBeNull()
  })
})
