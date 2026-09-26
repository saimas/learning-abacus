import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { emptyProgress } from '@/domain/progress'
import { LocaleProvider } from '@/i18n'
import * as localeStore from '@/storage/localeStore'
import * as store from '@/storage/progressStore'
import { ProgressProvider } from '@/ui/ProgressProvider'
import Settings from '../app/settings'

jest.mock('@/storage/progressStore')
jest.mock('@/storage/localeStore')

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
const mockLoadLocale = localeStore.loadLocale as jest.MockedFunction<typeof localeStore.loadLocale>
const mockSaveLocale = localeStore.saveLocale as jest.MockedFunction<typeof localeStore.saveLocale>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue({ ...emptyProgress(), daysPracticed: 12 })
  mockSave.mockResolvedValue()
  mockLoadLocale.mockResolvedValue('ja')
  mockSaveLocale.mockResolvedValue()
})

function renderSettings() {
  return render(
    <LocaleProvider>
      <ProgressProvider>
        <Settings />
      </ProgressProvider>
    </LocaleProvider>,
  )
}

describe('Settings language toggle', () => {
  it('starts in Japanese', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('days-practiced').props.children).toContain('12日'))
    expect(getByTestId('language-label').props.children).toBe('言語')
  })

  it('offers both languages by their own names, untranslated', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-ja')).toBeTruthy())
    expect(getByTestId('locale-ja-label').props.children).toBe('日本語')
    expect(getByTestId('locale-en-label').props.children).toBe('English')
  })

  it('marks the active language as selected', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-ja')).toBeTruthy())
    // toMatchObject, not toEqual: Pressable merges its own keys (disabled,
    // busy) into accessibilityState, so an exact match would be brittle.
    expect(getByTestId('locale-ja').props.accessibilityState).toMatchObject({ selected: true })
    expect(getByTestId('locale-en').props.accessibilityState).toMatchObject({ selected: false })
  })

  it('switches the whole screen to English', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(getByTestId('days-practiced').props.children).toContain('12 days practised')
  })

  it('keeps the option labels in their own language after switching', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(getByTestId('locale-ja-label').props.children).toBe('日本語')
    expect(getByTestId('locale-en-label').props.children).toBe('English')
  })

  it('persists the choice', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })
    expect(mockSaveLocale).toHaveBeenCalledWith('en')
  })

  // The whole reason the locale lives under its own storage key.
  it('survives a full progress reset', async () => {
    const { getByTestId } = renderSettings()
    await waitFor(() => expect(getByTestId('locale-en')).toBeTruthy())
    await act(async () => {
      fireEvent.press(getByTestId('locale-en'))
    })

    fireEvent.press(getByTestId('reset'))
    await act(async () => {
      fireEvent.press(getByTestId('reset-confirm'))
    })

    expect(mockSave).toHaveBeenCalledWith(emptyProgress())
    expect(getByTestId('days-practiced').props.children).toContain('0 days practised')
    expect(mockSaveLocale).toHaveBeenCalledTimes(1)
  })
})
