import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Settings from '../app/settings'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// `<Link>` calls useRouter() internally, which throws outside a real
// navigation tree. Settings only uses `Link` from expo-router, so a minimal
// stand-in lets the target href be asserted without mounting real navigation.
jest.mock('expo-router', () => {
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
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 12 })
  mockSave.mockResolvedValue()
})

function renderSettings() {
  return render(
    <ProgressProvider>
      <Settings />
    </ProgressProvider>,
  )
}

describe('Settings', () => {
  it('shows days practised', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain('12日'))
  })

  it('links back to today', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('link-today')).toBeTruthy())
    expect(getByTestId('link-today').props.children).toBe('/')
  })

  it('requires confirmation before resetting', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('reset')).toBeTruthy())
    fireEvent.press(getByTestId('reset'))
    expect(mockSave).not.toHaveBeenCalled()
    expect(getByTestId('reset-confirm')).toBeTruthy()
  })

  it('resets on the second press', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('reset')).toBeTruthy())
    fireEvent.press(getByTestId('reset'))
    fireEvent.press(getByTestId('reset-confirm'))
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(emptyProgress()))
  })
})
