import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import * as store from '@/storage/progressStore'
import Today from '../app/index'
import { ProgressProvider } from '@/ui/ProgressProvider'

jest.mock('@/storage/progressStore')

const mockLoad = store.loadProgress as jest.MockedFunction<typeof store.loadProgress>
const mockSave = store.saveProgress as jest.MockedFunction<typeof store.saveProgress>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue(emptyProgress())
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
})
