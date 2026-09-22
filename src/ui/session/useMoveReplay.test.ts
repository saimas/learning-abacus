import { act, renderHook } from '@testing-library/react-native'
import { emptySoroban, readValue, setValue } from '@/domain/soroban'
import { REPLAY_STEP_MS, useMoveReplay } from './useMoveReplay'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// 7 + 8 on the session soroban: 07, then +10, then − 2.
const states = [7, 17, 15].map((n) => setValue(emptySoroban(2), n))

function render() {
  const hook = renderHook(() => useMoveReplay())
  const shown = () => {
    const soroban = hook.result.current.soroban
    return soroban === null ? null : readValue(soroban)
  }
  return { ...hook, shown }
}

describe('useMoveReplay', () => {
  it('shows nothing until played', () => {
    const { result, shown } = render()
    expect(shown()).toBeNull()
    expect(result.current.step).toBeNull()
  })

  it('starts on the first state and steps every 900 ms to the last', () => {
    const { result, shown } = render()
    expect(REPLAY_STEP_MS).toBe(900)
    act(() => result.current.play(states))
    expect(shown()).toBe(7)
    expect(result.current.step).toBe(0)

    act(() => jest.advanceTimersByTime(899))
    expect(shown()).toBe(7)
    act(() => jest.advanceTimersByTime(1))
    expect(shown()).toBe(17)
    expect(result.current.step).toBe(1)

    act(() => jest.advanceTimersByTime(900))
    expect(shown()).toBe(15)
    expect(result.current.step).toBe(2)
  })

  it('stays on the last state, with nothing left pending', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(10 * 900))
    expect(shown()).toBe(15)
    expect(result.current.step).toBe(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('starts over when played again mid-replay', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(900 + 600))
    expect(shown()).toBe(17)

    act(() => result.current.play(states))
    expect(shown()).toBe(7)
    // The step the first play had pending must not fire.
    act(() => jest.advanceTimersByTime(600))
    expect(shown()).toBe(7)
    act(() => jest.advanceTimersByTime(300))
    expect(shown()).toBe(17)
  })

  it('shows nothing once stopped, and stays stopped', () => {
    const { result, shown } = render()
    act(() => result.current.play(states))
    act(() => jest.advanceTimersByTime(900))
    act(() => result.current.stop())
    expect(shown()).toBeNull()
    expect(result.current.step).toBeNull()
    act(() => jest.advanceTimersByTime(5_000))
    expect(shown()).toBeNull()
  })

  it('leaves no timer behind when unmounted mid-replay', () => {
    const { result, unmount } = render()
    act(() => result.current.play(states))
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
