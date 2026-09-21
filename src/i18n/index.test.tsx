import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'
import * as localeStore from '@/storage/localeStore'
import { LocaleProvider, useLocale, useStrings } from './index'

jest.mock('@/storage/localeStore')

const mockLoad = localeStore.loadLocale as jest.MockedFunction<typeof localeStore.loadLocale>
const mockSave = localeStore.saveLocale as jest.MockedFunction<typeof localeStore.saveLocale>

beforeEach(() => {
  jest.clearAllMocks()
  mockLoad.mockResolvedValue('ja')
  mockSave.mockResolvedValue()
})

function Probe() {
  const strings = useStrings()
  const { locale, setLocale } = useLocale()
  return (
    <>
      <Text testID="label">{strings.navSettings}</Text>
      <Text testID="locale">{locale}</Text>
      <Pressable testID="to-en" onPress={() => setLocale('en')}>
        <Text>switch</Text>
      </Pressable>
    </>
  )
}

describe('LocaleProvider', () => {
  it('renders nothing until the stored locale resolves', () => {
    // A promise that never settles, so the gate is observed rather than raced
    // against a microtask that may or may not have flushed.
    mockLoad.mockReturnValue(new Promise<never>(() => {}))
    const { queryByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    expect(queryByTestId('label')).toBeNull()
  })

  it('renders the stored locale once resolved', async () => {
    mockLoad.mockResolvedValue('en')
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    await waitFor(() => expect(getByTestId('locale').props.children).toBe('en'))
    expect(getByTestId('label').props.children).toBe('Settings')
  })

  it('switches catalog and persists the choice', async () => {
    const { getByTestId } = render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    )
    await waitFor(() => expect(getByTestId('label').props.children).toBe('設定'))
    await act(async () => {
      fireEvent.press(getByTestId('to-en'))
    })
    expect(getByTestId('label').props.children).toBe('Settings')
    expect(mockSave).toHaveBeenCalledWith('en')
  })
})

describe('useStrings outside a provider', () => {
  it('falls back to the Japanese catalog instead of throwing', () => {
    const { getByTestId } = render(<Probe />)
    expect(getByTestId('label').props.children).toBe('設定')
    expect(getByTestId('locale').props.children).toBe('ja')
  })
})
