import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Today from '../app/index'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

// `<Redirect>` calls useRouter()/useFocusEffect() internally, which throw
// outside a real navigation tree. Today only uses `Redirect` from
// expo-router, so a minimal stand-in lets the redirect target be asserted
// without mounting real navigation.
jest.mock('expo-router', () => {
  const { Text } = require('react-native')
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect-to">{href}</Text>,
  }
})

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), tutorialDone: true })
  mockSave.mockResolvedValue()
})

describe('Today', () => {
  it('shows a loading state before hydration', () => {
    const { queryByTestId } = render(
      <ProgressProvider>
        <Today />
      </ProgressProvider>,
    )
    expect(queryByTestId('hydrating')).not.toBeNull()
  })

  it('runs a session once hydrated', async () => {
    const { getByTestId } = render(
      <ProgressProvider>
        <Today />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('prompt')).toBeTruthy())
    fireEvent.changeText(getByTestId('answer-input'), '1')
    fireEvent.press(getByTestId('submit'))
    expect(getByTestId('prompt')).toBeTruthy()
  })

  it('does not run a session when the tutorial is not done', async () => {
    mockLoad.mockResolvedValue(emptyProgress())
    const { getByTestId, queryByTestId } = render(
      <ProgressProvider>
        <Today />
      </ProgressProvider>,
    )
    await waitFor(() => expect(getByTestId('redirect-to').props.children).toBe('/tutorial'))
    expect(queryByTestId('prompt')).toBeNull()
    expect(queryByTestId('days-practiced')).toBeNull()
  })
})
