import { act, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import RootLayout from '../app/_layout'

jest.mock('@/storage/progressStore')

// The options each Stack.Screen is declared with, by route name. The real
// Stack needs a navigation container; this one only records its screens.
const mockScreenOptions: Record<string, unknown> = {}
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children?: ReactNode }) => children
  const Screen = ({ name, options }: { name: string; options?: unknown }) => {
    mockScreenOptions[name] = options
    return null
  }
  Stack.Screen = Screen
  return { Stack }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>

beforeEach(() => {
  mockLoad.mockResolvedValue(emptyProgress())
})

// Whether an edge swipe can leave `name` when it is opened with `params`.
function swipeBack(name: string, params: Record<string, string> | undefined): unknown {
  const options = mockScreenOptions[name]
  const resolved = typeof options === 'function' ? options({ route: { name, params } }) : options
  return (resolved as { gestureEnabled?: boolean } | undefined)?.gestureEnabled ?? true
}

describe('RootLayout', () => {
  // Spec (multiplication) §4, (division) §3: opened with a round's kind, a
  // walkthrough leads into that round, so it is left only through its last
  // button; opened from Home's link, it leads nowhere, so a swipe back is
  // fine.
  it.each([
    ['multiply-intro', 'mul:2'],
    ['divide-intro', 'div:2'],
  ])('lets a swipe leave %s only when it has no round to lead into', async (name, kind) => {
    render(<RootLayout />)
    // The locale and progress load before anything under them renders.
    await act(async () => {})
    expect(swipeBack(name, { kind })).toBe(false)
    expect(swipeBack(name, undefined)).toBe(true)
    expect(swipeBack(name, {})).toBe(true)
  })

  it('never lets a swipe leave a session or a round', async () => {
    render(<RootLayout />)
    await act(async () => {})
    expect(swipeBack('session', undefined)).toBe(false)
    expect(swipeBack('round', { kind: 'div:2' })).toBe(false)
  })
})
