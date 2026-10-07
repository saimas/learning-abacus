import { act, renderHook } from '@testing-library/react-native'
import { FLASH_GAP_MS, FLASH_LEAD_MS, FLASH_SHOW_MS, flashFrames, useFlash } from './useFlash'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// 47, 30, 23, 61, 19: the beads follow 47, 77, 100 and 161.
const TERMS = [47, 30, 23, 61, 19]

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

// Spec (flash) §2: 0.6 s, then each number for 0.7 s; after each but the
// last the beads take the total with it, and 0.3 s pass before the next.
describe('flashFrames', () => {
  it('leads, shows each number, and puts the total so far on the beads between them', () => {
    expect(flashFrames(TERMS)).toEqual([
      { frame: { shown: null, total: 0 }, ms: 600 },
      { frame: { shown: 0, total: 0 }, ms: 700 },
      { frame: { shown: null, total: 47 }, ms: 300 },
      { frame: { shown: 1, total: 47 }, ms: 700 },
      { frame: { shown: null, total: 77 }, ms: 300 },
      { frame: { shown: 2, total: 77 }, ms: 700 },
      { frame: { shown: null, total: 100 }, ms: 300 },
      { frame: { shown: 3, total: 100 }, ms: 700 },
      { frame: { shown: null, total: 161 }, ms: 300 },
      // The fifth flashes alone: the beads stay on the first four's total.
      { frame: { shown: 4, total: 161 }, ms: 700 },
    ])
  })

  it('lasts 5.3 s, about one number a second', () => {
    expect([FLASH_LEAD_MS, FLASH_SHOW_MS, FLASH_GAP_MS]).toEqual([600, 700, 300])
    expect(flashFrames(TERMS).reduce((sum, { ms }) => sum + ms, 0)).toBe(5_300)
  })
})

describe('useFlash', () => {
  function play(revealed = true) {
    const onShow = jest.fn()
    const onEnd = jest.fn()
    const hook = renderHook(
      (props: { revealed: boolean }) => useFlash({ terms: TERMS, revealed: props.revealed, onShow, onEnd }),
      { initialProps: { revealed } },
    )
    return { ...hook, onShow, onEnd }
  }

  it('plays each frame for its time, then ends', () => {
    const { result, onShow, onEnd } = play()
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(FLASH_LEAD_MS - 1)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(1)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
    expect(onShow).toHaveBeenLastCalledWith(0)
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toEqual({ shown: null, total: 47 })
    advance(FLASH_GAP_MS)
    expect(result.current.frame).toEqual({ shown: 1, total: 47 })
    for (let k = 0; k < 3; k++) {
      advance(FLASH_SHOW_MS)
      advance(FLASH_GAP_MS)
    }
    expect(result.current.frame).toEqual({ shown: 4, total: 161 })
    expect(onShow.mock.calls.map(([index]) => index)).toEqual([0, 1, 2, 3, 4])
    expect(onEnd).not.toHaveBeenCalled()
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
    advance(10_000)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  // Spec (flash) §4: not while the card lies underneath the one swiping off.
  it('waits until revealed', () => {
    const { result, rerender, onShow } = play(false)
    advance(5_000)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    expect(onShow).not.toHaveBeenCalled()
    rerender({ revealed: true })
    advance(FLASH_LEAD_MS - 1)
    expect(result.current.frame).toEqual({ shown: null, total: 0 })
    advance(1)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
  })

  // Review focus: a card swiped off mid-flash (✕ confirmed) is covered
  // again; its flash holds where it is and says nothing more.
  it('holds its frame while covered, and goes on from it if uncovered again', () => {
    const { result, rerender, onShow } = play()
    advance(FLASH_LEAD_MS)
    rerender({ revealed: false })
    advance(5_000)
    expect(result.current.frame).toEqual({ shown: 0, total: 0 })
    expect(onShow).toHaveBeenCalledTimes(1)
    rerender({ revealed: true })
    advance(FLASH_SHOW_MS)
    expect(result.current.frame).toEqual({ shown: null, total: 47 })
  })

  // Spec (flash) §4: 手順を見る ends the flash at once.
  it('ends at once when stopped, and fires nothing after', () => {
    const { result, onShow, onEnd } = play()
    advance(FLASH_LEAD_MS + 100)
    act(() => result.current.stop())
    expect(result.current.frame).toBeNull()
    advance(10_000)
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  // Review focus: the question gone mid-flash (戻る, ✕, leaving the screen).
  it('fires nothing once unmounted', () => {
    const { unmount, onShow, onEnd } = play()
    advance(FLASH_LEAD_MS + 100)
    unmount()
    advance(10_000)
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('is over from the start for a question with no flash', () => {
    const { result } = renderHook(() => useFlash({ terms: undefined, revealed: true, onShow: jest.fn(), onEnd: jest.fn() }))
    expect(result.current.frame).toBeNull()
  })
})
