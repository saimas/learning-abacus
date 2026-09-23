import { act, renderHook } from '@testing-library/react-native'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStepper } from './useStepper'

const states = [0, 5, 3, 13].map((n) => setValue(emptySoroban(2), n))

describe('useStepper', () => {
  it('starts not stepping, shows the start first, then walks the moves one at a time', () => {
    const { result } = renderHook(() => useStepper(states))
    expect(result.current.index).toBeNull()
    expect(result.current.soroban).toBeNull()
    expect(result.current.total).toBe(3)
    act(() => result.current.next())
    expect(result.current.index).toBe(0)
    expect(result.current.soroban).toEqual(states[0])
    act(() => result.current.next())
    expect(result.current.index).toBe(1)
    expect(result.current.soroban).toEqual(states[1])
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.index).toBe(3)
  })

  it('steps back to the start and no further', () => {
    const { result } = renderHook(() => useStepper(states))
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.back())
    expect(result.current.index).toBe(0)
    act(() => result.current.back())
    expect(result.current.index).toBe(0)
    expect(result.current.soroban).toEqual(states[0])
  })

  it('restarts at the start and clears to not stepping', () => {
    const { result } = renderHook(() => useStepper(states))
    act(() => result.current.next())
    act(() => result.current.next())
    act(() => result.current.restart())
    expect(result.current.index).toBe(0)
    act(() => result.current.clear())
    expect(result.current.index).toBeNull()
  })
})
