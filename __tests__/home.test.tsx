import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { AppState, StyleSheet, type AppStateStatus } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Home from '../app/index'
import { ProgressProvider } from '@/ui/ProgressProvider'
import { cellColors, colors } from '@/ui/theme'

jest.mock('@/storage/progressStore')

// Real <Link>/<Redirect> need a navigation tree. These stand-ins keep the
// children visible (so labels can be asserted) and expose the target href
// through nativeID, a string prop every View accepts. useFocusEffect stands
// in for expo-router's version: it runs the (memoized) callback in an
// effect, which is enough to exercise Home's on-focus refresh under Jest,
// and keeps it, so a test can bring Home back into focus as closing the
// page above it does.
const mockPush = jest.fn()
const mockFocus = new Set<() => void>()
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
    useFocusEffect: (effect: () => void) => {
      useEffect(() => {
        mockFocus.add(effect)
        effect()
        return () => {
          mockFocus.delete(effect)
        }
      }, [effect])
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

// Spec (home menu) §2: OPERATIONS order.
const OPS = ['add', 'sub', 'mul', 'div', 'mitori', 'flash'] as const
// An operation's button, not its level line (home-op-level-…).
const BUTTON = /^home-op-[a-z]+$/

function learner(overrides: Partial<Progress>): Progress {
  return { ...emptyProgress(), tutorialDone: true, ...overrides }
}

function at(fade: FadeLevel) {
  return { ...newPracticeRecord(0), fade }
}

function renderHome() {
  return render(
    <ProgressProvider>
      <Home />
    </ProgressProvider>,
  )
}

const buttonIds = () => screen.getAllByTestId(BUTTON).map((button) => button.props.testID as string)

// Home and ProgressProvider each register their own AppState 'change'
// listener. Capturing every one lets a test replay a foregrounding without a
// simulator and without caring which component subscribed in which order.
let appStateHandlers: ((status: AppStateStatus) => void)[] = []

function fireAppStateChange(status: AppStateStatus) {
  appStateHandlers.forEach((handler) => handler(status))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFocus.clear()
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
    expect(queryByTestId('home-ops')).toBeNull()
  })

  // Spec (home menu) §2: under 「練習」, a button per operation, two to a
  // row, in OPERATIONS order, each its symbol and its name.
  it('offers the six operations as buttons, two to a row, in order', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, getByText } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    expect(getByText('練習')).toBeTruthy()
    expect(buttonIds()).toEqual(OPS.map((op) => `home-op-${op}`))
    const rows = [
      ['add', 'sub'],
      ['mul', 'div'],
      ['mitori', 'flash'],
    ]
    rows.forEach((ops, row) => {
      const inRow = within(getByTestId(`home-ops-row-${row}`))
        .getAllByTestId(BUTTON)
        .map((button) => button.props.testID as string)
      expect(inRow).toEqual(ops.map((op) => `home-op-${op}`))
    })
    const faces = {
      add: ['＋', 'たし算'],
      sub: ['−', 'ひき算'],
      mul: ['×', 'かけ算'],
      div: ['÷', 'わり算'],
      mitori: ['±', '見取算'],
      flash: ['フ', 'フラッシュ暗算'],
    } as const
    for (const op of OPS) {
      const button = getByTestId(`home-op-${op}`)
      expect(within(button).getByText(faces[op][0])).toBeTruthy()
      expect(within(button).getByText(faces[op][1])).toBeTruthy()
      expect(button.props.accessibilityRole).toBe('button')
    }
  })

  // Spec (home menu) §2: 「レベル N」, N the highest among its three sizes, or
  // 「まだ」 if none has been played; VoiceOver reads the name with it.
  it('shows each operation’s highest level among its sizes, or まだ', async () => {
    mockLoad.mockResolvedValue(learner({ practices: { 'add:1': at(2), 'add:3': at(4), 'div:2': at(0) } }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    expect(getByTestId('home-op-level-add').props.children).toBe('レベル 4')
    expect(getByTestId('home-op-level-div').props.children).toBe('レベル 0')
    expect(getByTestId('home-op-level-mitori').props.children).toBe('まだ')
    expect(getByTestId('home-op-add').props.accessibilityLabel).toBe('たし算、レベル 4')
    expect(getByTestId('home-op-div').props.accessibilityLabel).toBe('わり算、レベル 0')
    expect(getByTestId('home-op-mitori').props.accessibilityLabel).toBe('見取算、まだ')
  })

  // Spec (home menu) §2: tinted by the most advanced stage among its sizes,
  // in the grid's colours, with light words on the darkest.
  it('tints each button by the most advanced stage among its sizes', async () => {
    mockLoad.mockResolvedValue(
      learner({ practices: { 'add:1': at(1), 'add:3': at(4), 'sub:2': at(2), 'mul:2': at(6) } }),
    )
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    const background = (op: string) => StyleSheet.flatten(getByTestId(`home-op-${op}`).props.style).backgroundColor
    expect(['add', 'sub', 'mul', 'div'].map(background)).toEqual([
      cellColors.reflex,
      cellColors.learning,
      cellColors.mental,
      cellColors.unseen,
    ])
    const ink = (op: string, text: string) =>
      StyleSheet.flatten(within(getByTestId(`home-op-${op}`)).getByText(text).props.style).color
    expect(ink('mul', 'かけ算')).toBe(colors.paper)
    expect(ink('mul', 'レベル 6')).toBe(colors.paper)
    expect(ink('add', 'たし算')).toBe(colors.ink)
  })

  // Spec (home menu) §2: the grid and the やりかた row moved to each
  // operation's page. Spec (core rounds) §6, (roll) §2: no start button and
  // no 基礎の練習 card either.
  it('has no grid, no やりかた row and no start button', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByTestId, queryByText, queryAllByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    expect(queryByTestId('practice-table')).toBeNull()
    expect(queryAllByTestId(/^practice-cell-/)).toEqual([])
    expect(queryByTestId('home-howto-row')).toBeNull()
    expect(queryByText('やりかた')).toBeNull()
    expect(queryByTestId('start')).toBeNull()
    expect(queryByTestId('home-basics')).toBeNull()
  })

  // Spec (home menu) §2: a button opens its operation's page.
  it.each([...OPS])('opens the %s page from its button', async (op) => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId(`home-op-${op}`)).toBeTruthy())
    fireEvent.press(getByTestId(`home-op-${op}`))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/practice/[op]', params: { op } })
  })

  // Spec (home menu) §2: 「練習」 heads the menu, as the operation page's
  // title heads its page.
  it('marks the 練習 heading as a header', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByRole } = renderHome()
    await waitFor(() => expect(getByRole('header', { name: '練習' })).toBeTruthy())
  })

  // Review focus: a double tap that slipped through would stack a second
  // page on the first. useOnePush guards a second push before Home regains
  // focus.
  it('pushes only once when a button is tapped twice quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-op-add')).toBeTruthy())
    fireEvent.press(getByTestId('home-op-add'))
    fireEvent.press(getByTestId('home-op-add'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  // The buttons sit side by side, so a quick second tap can land on the
  // other one; that must not stack a second page either.
  it('pushes only once when two buttons are tapped quickly', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-op-mul')).toBeTruthy())
    fireEvent.press(getByTestId('home-op-mul'))
    fireEvent.press(getByTestId('home-op-div'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/practice/[op]', params: { op: 'mul' } })
  })

  // Review focus: closing the page brings Home back into focus, which lets
  // the guard go, or Home's buttons would never open anything again.
  it('takes a tap again once Home is back in front', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-op-add')).toBeTruthy())
    fireEvent.press(getByTestId('home-op-add'))
    act(() => [...mockFocus].forEach((effect) => effect()))
    fireEvent.press(getByTestId('home-op-flash'))
    expect(mockPush).toHaveBeenCalledTimes(2)
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/practice/[op]', params: { op: 'flash' } })
  })

  // Review focus: Home fits a 375 × 667 phone at a larger text size. The
  // buttons' words grow only so far (the simulator check measures the
  // whole), and each button stays a full tap target.
  it('caps how far the buttons’ words grow with the text size', async () => {
    mockLoad.mockResolvedValue(learner({ practices: { 'flash:1': at(3) } }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    for (const op of OPS) {
      const button = getByTestId(`home-op-${op}`)
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44)
      const words = within(button).getAllByText(/./)
      expect(words).toHaveLength(3)
      for (const word of words) expect(word.props.maxFontSizeMultiplier).toBe(1.4)
    }
  })

  // The owner (2026-09-29): the 今日の五分 title said nothing the page needs.
  it('has no title above the seal', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId, queryByText } = renderHome()
    await waitFor(() => expect(getByTestId('home-ops')).toBeTruthy())
    expect(queryByText('今日の五分')).toBeNull()
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
    // Home stays mounted under the operation pages, /progress and /settings,
    // and iOS keeps a suspended app alive overnight. A `today` captured only
    // once at mount would still say yesterday the next morning, even though
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

  // Spec (runs) §5: the rank and the bar to the next rank, under the seal.
  it('shows the learner’s rank and the points to the next', async () => {
    mockLoad.mockResolvedValue(learner({ points: 2_500 }))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('rank-name').props.children).toBe('練習8級'))
    expect(getByTestId('rank-next').props.children).toBe('次まで あと1,900点')
  })

  it('starts every learner at 練習10級', async () => {
    mockLoad.mockResolvedValue(learner({}))
    const { getByTestId } = renderHome()
    await waitFor(() => expect(getByTestId('rank-name').props.children).toBe('練習10級'))
    expect(getByTestId('rank-next').props.children).toBe('次まで あと1,000点')
  })
})
