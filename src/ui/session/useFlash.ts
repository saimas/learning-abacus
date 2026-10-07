import { useEffect, useEffectEvent, useState } from 'react'

// Spec (flash) §1, §4: the flash's pace, about one number a second and the
// same at every level: the fading beads are what makes it harder. They only
// ever drive timers, never an Animated.timing: the swipe tests find the card
// swipe by its 300 ms (ROLL_SWIPE_MS), which FLASH_GAP_MS equals.
export const FLASH_LEAD_MS = 600
export const FLASH_SHOW_MS = 700
export const FLASH_GAP_MS = 300

// What the flash shows at a moment: the number on show, by its index in the
// terms, or null before the first and between numbers; and the running
// total the beads show (spec (flash) §2).
export type FlashFrame = { shown: number | null; total: number }

type TimedFrame = { frame: FlashFrame; ms: number }

// Spec (flash) §2: the flash frame by frame, each with how long it lasts.
// The first number appears 0.6 s after the card is uncovered; each shows for
// 0.7 s, and after each but the last the beads take the total with it and
// 0.3 s pass before the next. The last flashes alone, the beads staying on
// the total before it: that step is the learner's.
export function flashFrames(terms: readonly number[]): TimedFrame[] {
  const frames: TimedFrame[] = [{ frame: { shown: null, total: 0 }, ms: FLASH_LEAD_MS }]
  let total = 0
  terms.forEach((term, index) => {
    frames.push({ frame: { shown: index, total }, ms: FLASH_SHOW_MS })
    if (index === terms.length - 1) return
    total += term
    frames.push({ frame: { shown: null, total }, ms: FLASH_GAP_MS })
  })
  return frames
}

// Spec (flash) §4: plays a フラッシュ暗算 problem's flash from its first
// frame while `revealed`: its card uncovered, not lying underneath the card
// swiping off nor on its way off itself. `terms` undefined is no flash.
// `frame` is what is on show, or null once the flash is over, run to its
// end (onEnd) or ended at once by stop() (手順を見る). Each frame's timer
// starts as the frame is shown, so none is cut short; covered again, the
// flash holds its frame; a timer left when the question goes (戻る, ✕,
// leaving) is cleared with it and fires nothing. `onShow` hears each number
// as it appears, by its index in `terms`. replay() plays it again from its
// first frame, lead and all (the owner, 2026-10-08: もう一度見る), and onEnd
// hears its end again.
export function useFlash({
  terms,
  revealed,
  onShow,
  onEnd,
}: {
  terms: readonly number[] | undefined
  revealed: boolean
  onShow: (index: number) => void
  onEnd: () => void
}): { frame: FlashFrame | null; stop: () => void; replay: () => void } {
  // The question is keyed by problem, so its terms never change under it.
  const [frames] = useState<TimedFrame[]>(() => (terms === undefined ? [] : flashFrames(terms)))
  // The frame on show, an index into frames; frames.length once over.
  const [at, setAt] = useState(0)
  const reached = useEffectEvent((next: number) => {
    setAt(next)
    const shown = frames[next]?.frame.shown
    if (shown !== undefined && shown !== null) onShow(shown)
    if (next === frames.length) onEnd()
  })
  useEffect(() => {
    const ms = frames[at]?.ms
    if (!revealed || ms === undefined) return
    const timer = setTimeout(() => reached(at + 1), ms)
    return () => clearTimeout(timer)
  }, [revealed, at, frames])
  return { frame: frames[at]?.frame ?? null, stop: () => setAt(frames.length), replay: () => setAt(0) }
}
