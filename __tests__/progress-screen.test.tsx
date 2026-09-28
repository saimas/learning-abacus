import { render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import ProgressScreen from '../app/progress'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// `<Link>` calls useRouter() internally, which throws outside a real
// navigation tree. The progress screen only uses `Link` from expo-router, so
// a minimal stand-in lets the target href be asserted without mounting real
// navigation.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above the imports
  const { Text } = require('react-native')
  return {
    Link: ({ href, testID }: { href: string; testID?: string }) => (
      <Text testID={testID}>{href}</Text>
    ),
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue(emptyProgress())
  mockSave.mockResolvedValue()
})

describe('ProgressScreen', () => {
  it('links back to today', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <ProgressScreen />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('link-today')).toBeTruthy())
    expect(getByTestId('link-today').props.children).toBe('/')
  })

  // Spec (roll) §2: the 180-move map went with 基礎の練習.
  it('shows the practice table and no 180-move map', async () => {
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider>
        <ProgressScreen />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
    expect(queryByTestId('atom-map-add')).toBeNull()
  })

  it('shows practice-table', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <ProgressScreen />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('practice-table')).toBeTruthy())
  })
})
