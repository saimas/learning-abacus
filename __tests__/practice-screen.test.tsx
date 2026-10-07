import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { newPracticeRecord } from '@/domain/practice'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import PracticeRoute from '../app/practice/[op]'
import { ProgressProvider } from '@/ui/ProgressProvider'
import { cellColors, colors } from '@/ui/theme'

jest.mock('@/storage/progressStore')

// The route's search parameters, set per test: an operation, or whatever a
// hand-typed URL brings.
const mockParams: { current: Record<string, unknown> } = { current: {} }
const mockPush = jest.fn()
const mockRedirect = jest.fn()
// The page's focus callback, kept so a test can bring the page back into
// focus, as a run ending (router.back) or the lessons closing does.
const mockFocus: { current: (() => void) | null } = { current: null }
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { useEffect } = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- as above
  const { View } = require('react-native')
  return {
    router: { push: (href: unknown) => mockPush(href) },
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void) => {
      useEffect(() => {
        mockFocus.current = effect
        effect()
      }, [effect])
    },
    // BackLink's Link: a View that keeps its testID and shows its href.
    Link: ({ href, testID, children }: { href: string; testID?: string; children?: import('react').ReactNode }) => (
      <View testID={testID} nativeID={href}>
        {children}
      </View>
    ),
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href)
      return null
    },
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockFocus.current = null
})

function at(fade: FadeLevel) {
  return { ...newPracticeRecord(0), fade }
}

// Opens /practice/<op> (no op at all for undefined) once progress has loaded.
async function renderPage(op: unknown, progress: Partial<Progress> = {}) {
  mockParams.current = op === undefined ? {} : { op }
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, ...progress })
  render(
    <ProgressProvider>
      <PracticeRoute />
    </ProgressProvider>,
  )
  await act(async () => {})
}

const cardIds = () => screen.queryAllByTestId(/^practice-card-[a-z]+:\d$/).map((card) => card.props.testID as string)
const background = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor
const ink = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).color

describe('An operation’s page', () => {
  // Spec (home menu) §3.
  it('is titled with the operation’s name, under a link back to Home', async () => {
    await renderPage('add')
    expect(screen.getByText('たし算').props.accessibilityRole).toBe('header')
    expect(screen.getByTestId('link-today').props.nativeID).toBe('/')
  })

  // A cold deep link renders before progress has loaded.
  it('waits for progress before showing its cards', async () => {
    mockParams.current = { op: 'add' }
    mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
    render(
      <ProgressProvider>
        <PracticeRoute />
      </ProgressProvider>,
    )
    expect(screen.getByTestId('hydrating')).toBeTruthy()
    expect(cardIds()).toEqual([])
    await act(async () => {})
    expect(cardIds()).toHaveLength(3)
  })

  it('shows a card per size, each with its stage and level as a grid cell, and its best', async () => {
    await renderPage('add', { practices: { 'add:1': at(2), 'add:3': at(6) }, bestRuns: { 'add:1': 1_240 } })
    expect(cardIds()).toEqual(['practice-card-add:1', 'practice-card-add:2', 'practice-card-add:3'])
    expect(within(screen.getByTestId('practice-card-add:1')).getByText('1けた')).toBeTruthy()
    expect(screen.getByTestId('practice-card-stage-add:1').props.children).toBe('珠で')
    expect(screen.getByTestId('practice-card-level-add:1').props.children).toBe('レベル 2')
    expect(screen.getByTestId('practice-card-best-add:1').props.children).toBe('ベスト 1,240点')
    // Never played: まだ, in the unseen colour, with no level and no best.
    expect(within(screen.getByTestId('practice-card-add:2')).getByText('2けた')).toBeTruthy()
    expect(screen.getByTestId('practice-card-stage-add:2').props.children).toBe('まだ')
    expect(background('practice-card-add:2')).toBe(cellColors.unseen)
    expect(screen.queryByTestId('practice-card-level-add:2')).toBeNull()
    expect(screen.queryByTestId('practice-card-best-add:2')).toBeNull()
    // Played, with no run scored yet: no best.
    expect(screen.getByTestId('practice-card-level-add:3').props.children).toBe('レベル 6')
    expect(screen.queryByTestId('practice-card-best-add:3')).toBeNull()
  })

  // Spec (home menu) §3: as the grid cell reads, plus its best.
  it('reads each card as its grid cell did, plus its best', async () => {
    await renderPage('add', { practices: { 'add:1': at(2), 'add:3': at(6) }, bestRuns: { 'add:1': 1_240 } })
    expect(screen.getByTestId('practice-card-add:1').props.accessibilityLabel).toBe(
      '1けたのたし算、珠で、レベル 2、ベスト 1,240点',
    )
    expect(screen.getByTestId('practice-card-add:2').props.accessibilityLabel).toBe('2けたのたし算、まだ')
    expect(screen.getByTestId('practice-card-add:3').props.accessibilityLabel).toBe('3けたのたし算、暗算、レベル 6')
    expect(screen.getByTestId('practice-card-add:1').props.accessibilityRole).toBe('button')
  })

  it('colours each card by its stage, in the grid’s colours, with light words on the darkest', async () => {
    await renderPage('sub', { practices: { 'sub:1': at(1), 'sub:2': at(4), 'sub:3': at(6) } })
    expect(['sub:1', 'sub:2', 'sub:3'].map((id) => background(`practice-card-${id}`))).toEqual([
      cellColors.learning,
      cellColors.reflex,
      cellColors.mental,
    ])
    expect(ink('practice-card-stage-sub:2')).toBe(colors.ink)
    expect(ink('practice-card-stage-sub:3')).toBe(colors.paper)
    expect(ink('practice-card-level-sub:3')).toBe(colors.paper)
  })

  // Spec (home menu) §3: exactly as a grid cell did.
  it('starts a run of a card’s kind', async () => {
    await renderPage('add')
    fireEvent.press(screen.getByTestId('practice-card-add:2'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'add:2' } })
  })

  // A × or ÷ kind never played opens its lesson first: the round screen
  // sees to that (round-screen.test.tsx), so its card starts it as any other.
  it.each([
    ['mul', 'mul:1'],
    ['flash', 'flash:3'],
  ])('starts a %s run from its card the same way', async (op, kind) => {
    await renderPage(op)
    fireEvent.press(screen.getByTestId(`practice-card-${kind}`))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind } })
  })

  // Review focus: /round has no swipe back (app/_layout.tsx), so a double tap
  // must not stack a second run on the first.
  it('starts one run under a double tap', async () => {
    await renderPage('add')
    fireEvent.press(screen.getByTestId('practice-card-add:2'))
    fireEvent.press(screen.getByTestId('practice-card-add:2'))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('opens one screen when a card and やりかた are tapped together', async () => {
    await renderPage('add')
    fireEvent.press(screen.getByTestId('practice-card-add:1'))
    fireEvent.press(screen.getByTestId('practice-howto'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/round', params: { kind: 'add:1' } })
  })

  // Review focus: a run ends with router.back, onto this page. The guard
  // must let go once the page is in front again, or no card would start
  // another run.
  it('takes taps again once back in front', async () => {
    await renderPage('add')
    fireEvent.press(screen.getByTestId('practice-card-add:1'))
    act(() => mockFocus.current?.())
    fireEvent.press(screen.getByTestId('practice-card-add:3'))
    expect(mockPush).toHaveBeenCalledTimes(2)
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/round', params: { kind: 'add:3' } })
  })

  // Spec (home menu) §3: ＋ − × ÷ open their lessons.
  it.each([
    ['add', 'たし算'],
    ['sub', 'ひき算'],
    ['mul', 'かけ算'],
    ['div', 'わり算'],
  ])('opens the %s lessons from やりかた', async (op, name) => {
    await renderPage(op)
    const button = screen.getByTestId('practice-howto')
    expect(within(button).getByText('やりかた')).toBeTruthy()
    expect(button.props.accessibilityLabel).toBe(`${name}のやりかた`)
    fireEvent.press(button)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/howto/[op]', params: { op } })
  })

  // 見取算 and フラッシュ暗算 have no lessons.
  it.each([
    ['mitori', '見取算'],
    ['flash', 'フラッシュ暗算'],
  ])('offers no やりかた for %s', async (op, name) => {
    await renderPage(op)
    expect(screen.getByText(name)).toBeTruthy()
    expect(cardIds()).toHaveLength(3)
    expect(screen.queryByTestId('practice-howto')).toBeNull()
    expect(screen.queryByText('やりかた')).toBeNull()
  })

  // Review focus: a hand-typed or stale URL.
  it.each([['mod'], [''], [['add', 'sub']], [undefined]])(
    'goes Home for an operation it does not know: %p',
    async (op) => {
      await renderPage(op)
      expect(mockRedirect).toHaveBeenCalledWith('/')
      expect(cardIds()).toEqual([])
      expect(mockPush).not.toHaveBeenCalled()
    },
  )
})
