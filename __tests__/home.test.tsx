import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Home from '../app/index'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// Real <Link>/<Redirect> need a navigation tree. These stand-ins keep the
// children visible (so labels can be asserted) and expose the target href
// through nativeID, a string prop every View accepts. useFocusEffect stands
// in for expo-router's version: it just runs the (memoized) callback in an
// effect, which is enough to exercise Home's on-focus refresh under Jest.
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
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
  // and the map preview are gone.
  it('shows the practice grid, with no start button and no map preview', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(getByTestId('practice-cell-add:2')).toBeTruthy()
    expect(queryByTestId('start')).toBeNull()
    expect(queryByTestId('atom-preview')).toBeNull()
  })

  it('starts a round by pressing its cell in the grid', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    fireEvent.press(getByTestId('practice-cell-add:2'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'add:2' } })
  })

  it('opens the multiplication walkthrough from the home やりかた link', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-howto')).toBeTruthy())
    fireEvent.press(getByTestId('home-howto'))
    expect(mockPush).toHaveBeenCalledWith('/multiply-intro')
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

// Spec (choosing what to practise) §4: the start button asks what to practise.
describe('Home choosing what to practise', () => {
  async function openChooser() {
    mockLoad.mockResolvedValue(learner({}))
    const utils = renderHome()
    await waitFor(() => expect(utils.getByTestId('home-basics')).toBeTruthy())
    fireEvent.press(utils.getByTestId('home-basics'))
    return utils
  }

  it('asks before starting anything', async () => {
    const { getByTestId } = await openChooser()
    expect(getByTestId('part-chooser')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('starts the full session from ぜんぶ', async () => {
    const { getByTestId, queryByTestId } = await openChooser()
    fireEvent.press(getByTestId('choose-all'))
    expect(mockPush).toHaveBeenCalledWith('/session')
    expect(queryByTestId('part-chooser')).toBeNull()
  })

  it('starts just the chosen part', async () => {
    const { getByTestId } = await openChooser()
    fireEvent.press(getByTestId('choose-focus'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/session', params: { part: 'focus' } })
  })

  // startRound and openHowTo guard against the sheet being open, since its
  // backdrop should otherwise catch the tap first.
  it('ignores the grid and the やりかた link while the sheet is open', async () => {
    const { getByTestId } = await openChooser()
    fireEvent.press(getByTestId('practice-cell-add:2'))
    fireEvent.press(getByTestId('home-howto'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('offers 準備 only when something is due', async () => {
    // A learner who has answered nothing has nothing due.
    const { getByTestId } = await openChooser()
    expect(getByTestId('choose-warmup').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('closes without starting anything', async () => {
    const { getByTestId, queryByTestId } = await openChooser()
    fireEvent.press(getByTestId('chooser-backdrop'))
    expect(queryByTestId('part-chooser')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
