import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { AppState, StyleSheet, type AppStateStatus } from 'react-native'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Home from '../app/index'
import { BUTTON_HEIGHT } from '@/ui/kit/Button'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// Real <Link>/<Redirect> need a navigation tree. These stand-ins keep the
// children visible (so labels can be asserted) and expose the target href
// through nativeID, a string prop every View accepts. useFocusEffect stands
// in for expo-router's version: it just runs the (memoized) callback in an
// effect, which is enough to exercise Home's on-focus refresh under Jest.
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { useEffect } = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as above
  const { Text, View } = require('react-native')
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect-to">{href}</Text>,
    Link: ({
      href,
      testID,
      children,
    }: {
      href: string
      testID?: string
      children?: import('react').ReactNode
    }) => (
      <View testID={testID} nativeID={href}>
        {children}
      </View>
    ),
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect])
    },
    router: { push: (href: unknown) => mockPush(href) },
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

// 2026-09-21 09:00, local time, the same clock dayKey reads.
const NOW = new Date(2026, 8, 21, 9, 0).getTime()
// The next morning, still local time.
const NEXT_DAY = new Date(2026, 8, 22, 9, 0).getTime()

function learner(overrides: Partial<Progress>): Progress {
  return { ...emptyProgress(), tutorialDone: true, ...overrides }
}

function renderHome() {
  return render(
    <ProgressProvider>
      <Home />
    </ProgressProvider>,
  )
}

// Home and ProgressProvider each register their own AppState 'change'
// listener. Capturing every one lets a test replay a foregrounding without a
// simulator and without caring which component subscribed in which order.
let appStateHandlers: ((status: AppStateStatus) => void)[] = []

function fireAppStateChange(status: AppStateStatus) {
  appStateHandlers.forEach((handler) => handler(status))
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
  mockSave.mockResolvedValue()
  appStateHandlers = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    handler: (status: AppStateStatus) => void,
  ) => {
    appStateHandlers.push(handler)
    return { remove: jest.fn() }
  }) as unknown as typeof AppState.addEventListener)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Home', () => {
  it('shows a loading state before hydration', () => {
    mockLoad.mockResolvedValue(learner({}))
    const { queryByTestId } = renderHome()
    expect(queryByTestId('hydrating')).not.toBeNull()
  })

  it('sends a learner who has not read the soroban yet to the tutorial', async () => {
    mockLoad.mockResolvedValue(emptyProgress())
    const { getByTestId, queryByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('redirect-to').props.children).toBe('/tutorial'))
    expect(queryByTestId('practice-table')).toBeNull()
  })

  // Spec (core rounds) §6: Home is built around the けたの練習 grid; はじめる
  // is gone.
  it('shows the practice grid, with no start button', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(getByTestId('practice-cell-add:2')).toBeTruthy()
    expect(queryByTestId('start')).toBeNull()
  })

  // Spec (roll) §2: 基礎の練習 is gone; Home is the grid and its links.
  it('has no 基礎の練習 card', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(queryByTestId('home-basics')).toBeNull()
  })

  it('starts a round by pressing its cell in the grid', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    fireEvent.press(getByTestId('practice-cell-add:2'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'add:2' } })
  })

  it('starts a 見取算 round from its cell', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    fireEvent.press(getByTestId('practice-cell-mitori:2'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'mitori:2' } })
  })

  // Spec (howto tutorial) §3: four buttons under やりかた, each opening its
  // operation's page.
  it('offers the four operations’ lessons as full-size buttons under a やりかた heading', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, getByText } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto-add')).toBeTruthy())
    expect(getByText('やりかた')).toBeTruthy()
    const buttons = { add: ['＋ たし算', 'たし算のやりかた'], sub: ['− ひき算', 'ひき算のやりかた'], mul: ['× かけ算', 'かけ算のやりかた'], div: ['÷ わり算', 'わり算のやりかた'] }
    for (const [op, [label, spoken]] of Object.entries(buttons)) {
      expect(getByTestId(`home-howto-${op}`)).toHaveTextContent(label ?? '')
      expect(getByTestId(`home-howto-${op}`).props.accessibilityLabel).toBe(spoken)
      expect(StyleSheet.flatten(getByTestId(`home-howto-${op}`).props.style).minHeight).toBe(BUTTON_HEIGHT)
    }
  })

  it.each(['add', 'sub', 'mul', 'div'])('opens the %s page from its button', async (op) => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId(`home-howto-${op}`)).toBeTruthy())
    fireEvent.press(getByTestId(`home-howto-${op}`))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/howto/[op]', params: { op } })
  })

  it.each([
    ['in two rows of two at the usual text size', 1, 2],
    ['one per row at a large text size', 1.35, 4],
  ])('lays the four buttons out %s', async (_size, fontScale, rows) => {
    // As in RoundRunner.test.tsx: `require` reaches the module object the
    // screen's own imports read from.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
    const reactNative = require('react-native')
    const spy = jest.spyOn(reactNative, 'useWindowDimensions').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale })
    try {
      mockLoad.mockResolvedValue(learner({}))
      const { getByTestId, getAllByTestId } = renderHome()
      await waitFor(() => expect(getByTestId('home-howto-add')).toBeTruthy())
      expect(getAllByTestId('home-howto-row')).toHaveLength(rows)
    } finally {
      spy.mockRestore()
    }
  })

  // /round has no swipe-back (app/_layout.tsx), so a double tap that pushed
  // twice would leave the child stacked on a second round once it finishes
  // the first. `leaving` guards a second push before Home regains focus.
  it('pushes only once when a grid cell is tapped twice quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    fireEvent.press(getByTestId('practice-cell-add:2'))
    fireEvent.press(getByTestId('practice-cell-add:2'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('pushes only once when the かけ算 button is tapped twice quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto-mul')).toBeTruthy())
    fireEvent.press(getByTestId('home-howto-mul'))
    fireEvent.press(getByTestId('home-howto-mul'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('pushes only once when the わり算 button is tapped twice quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto-div')).toBeTruthy())
    fireEvent.press(getByTestId('home-howto-div'))
    fireEvent.press(getByTestId('home-howto-div'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  // The two buttons sit side by side, so a quick second tap can land on the
  // other one; that must not stack a second walkthrough either.
  it('pushes only once when both やりかた buttons are tapped quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto-div')).toBeTruthy())
    fireEvent.press(getByTestId('home-howto-mul'))
    fireEvent.press(getByTestId('home-howto-div'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/howto/[op]', params: { op: 'mul' } })
  })

  it('offers today’s session to a learner who has not practised today', async () => {
    mockLoad.mockResolvedValue(learner({ daysPracticed: 12, lastSessionDay: '2026-09-20' }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('seal-outline')).toBeTruthy())
    expect(getByTestId('today-status').props.children).toBe('今日の練習はまだです')
    expect(getByTestId('days-practiced').props.children).toContain('12日')
  })

  it('stamps the seal once today is done', async () => {
    mockLoad.mockResolvedValue(learner({ daysPracticed: 12, lastSessionDay: '2026-09-21' }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('seal-stamped')).toBeTruthy())
    expect(getByTestId('today-status').props.children).toBe('今日は練習しました')
  })

  it('leaves the seal empty before the first practised day', async () => {
    mockLoad.mockResolvedValue(learner({ daysPracticed: 0 }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('seal-empty')).toBeTruthy())
  })

  it('links to progress and settings', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('link-progress')).toBeTruthy())
    expect(getByTestId('link-progress').props.nativeID).toBe('/progress')
    expect(getByTestId('link-settings').props.nativeID).toBe('/settings')
  })

  it('refreshes a stale today when the app returns to the foreground overnight', async () => {
    // Home stays mounted under /session, /progress and /settings, and iOS
    // keeps a suspended app alive overnight. A `today` captured only once at
    // mount would still say yesterday the next morning, even though
    // lastSessionDay (and so practisedToday) has moved on.
    mockLoad.mockResolvedValue(learner({ daysPracticed: 12, lastSessionDay: '2026-09-21' }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('seal-stamped')).toBeTruthy())
    expect(getByTestId('today-status').props.children).toBe('今日は練習しました')

    ;(Date.now as jest.Mock).mockReturnValue(NEXT_DAY)
    await act(async () => {
      fireAppStateChange('active')
    })

    await waitFor(() => expect(getByTestId('seal-outline')).toBeTruthy())
    expect(getByTestId('today-status').props.children).toBe('今日の練習はまだです')
  })
})
