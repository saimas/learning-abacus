import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { emptyProgress, type Progress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import HowToRoute from '../app/howto/[op]'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockParams: { current: Record<string, string> } = { current: {} }
const mockPush = jest.fn()
const mockRedirect = jest.fn()
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { useEffect } = require('react')
  return {
    router: { push: (href: unknown) => mockPush(href) },
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect])
    },
    // BackLink's Link: its child stands in for it.
    Link: ({ children }: { children?: import('react').ReactNode }) => children,
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href)
      return null
    },
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
})

async function renderPage(op: string, progress: Partial<Progress> = {}) {
  mockParams.current = { op }
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true, ...progress })
  render(
    <ProgressProvider>
      <HowToRoute />
    </ProgressProvider>,
  )
  await act(async () => {})
}

const rowIds = () => screen.getAllByTestId(/^lesson-(?!done)/).map((row) => row.props.testID)

describe('An operation’s page', () => {
  // Spec (howto tutorial) §3.
  it('lists the operation’s lessons under their 桁数, in order', async () => {
    await renderPage('add')
    expect(screen.getByText('たし算のやりかた')).toBeTruthy()
    expect(rowIds()).toEqual([
      'lesson-add:direct',
      'lesson-add:five',
      'lesson-add:ten',
      'lesson-add:both',
      'lesson-add:2',
      'lesson-add:3',
    ])
    for (const heading of ['1けた', '2けた', '3けた']) expect(screen.getByText(heading)).toBeTruthy()
    expect(screen.getByText('五の合成　4＋3')).toBeTruthy()
    expect(screen.getByText('47＋38')).toBeTruthy()
  })

  it('has one lesson per 桁数 for × and ÷', async () => {
    await renderPage('div')
    expect(rowIds()).toEqual(['lesson-div:1', 'lesson-div:2', 'lesson-div:3'])
    expect(screen.getByText('56÷7')).toBeTruthy()
  })

  it('marks the lessons done', async () => {
    await renderPage('add', { lessonsSeen: ['add:five', 'add:2'] })
    expect(screen.getByTestId('lesson-done-add:five')).toBeTruthy()
    expect(screen.getByTestId('lesson-done-add:2')).toBeTruthy()
    expect(screen.queryByTestId('lesson-done-add:ten')).toBeNull()
    expect(screen.getByTestId('lesson-add:five').props.accessibilityLabel).toBe('五の合成　4＋3、できた')
    expect(screen.getByTestId('lesson-add:ten').props.accessibilityLabel).toBe('十の繰上　8＋5')
  })

  // Review focus: a double tap must not stack two lessons.
  it('opens a lesson, once under a double tap', async () => {
    await renderPage('sub')
    fireEvent.press(screen.getByTestId('lesson-sub:ten'))
    fireEvent.press(screen.getByTestId('lesson-sub:ten'))
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/lesson/[id]', params: { id: 'sub:ten' } })
  })

  // Review focus: a deep link to an operation that has no page.
  it('goes Home for an operation it does not know', async () => {
    await renderPage('mitori')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })
})
