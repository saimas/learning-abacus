import { act, renderHook } from '@testing-library/react-native'
import { useOnePush } from './useOnePush'

// The page's focus callback, kept so a test can bring the page back into
// focus, as a run ending (router.back) does.
const mockFocus: { current: (() => void) | null } = { current: null }
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { useEffect } = require('react')
  return {
    useFocusEffect: (effect: () => void) => {
      useEffect(() => {
        mockFocus.current = effect
        effect()
      }, [effect])
    },
  }
})

describe('useOnePush', () => {
  it('runs a push once until the screen regains focus', () => {
    const { result } = renderHook(() => useOnePush())
    const push = jest.fn()
    result.current(push)
    result.current(push)
    expect(push).toHaveBeenCalledTimes(1)
    act(() => mockFocus.current?.())
    result.current(push)
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('returns the same function on every render', () => {
    const { result, rerender } = renderHook(() => useOnePush())
    const first = result.current
    rerender({})
    expect(result.current).toBe(first)
  })
})
