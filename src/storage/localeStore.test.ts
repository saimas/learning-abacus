import AsyncStorage from '@react-native-async-storage/async-storage'
import { LOCALE_STORAGE_KEY, loadLocale, saveLocale } from './localeStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('loadLocale', () => {
  it('defaults to Japanese when nothing is stored', async () => {
    mockGetItem.mockResolvedValue(null)
    expect(await loadLocale()).toBe('ja')
    expect(mockGetItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY)
  })

  it('returns a stored locale', async () => {
    mockGetItem.mockResolvedValue('en')
    expect(await loadLocale()).toBe('en')
  })

  it('defaults to Japanese on a value outside the union', async () => {
    mockGetItem.mockResolvedValue('fr')
    expect(await loadLocale()).toBe('ja')
  })

  it('defaults to Japanese when the read throws', async () => {
    mockGetItem.mockRejectedValue(new Error('storage unavailable'))
    expect(await loadLocale()).toBe('ja')
  })

  it('reads a key of its own, not the progress key', async () => {
    mockGetItem.mockResolvedValue(null)
    await loadLocale()
    expect(mockGetItem).toHaveBeenCalledWith('learning-abacus/locale/v1')
  })
})

describe('saveLocale', () => {
  it('writes the locale under its own key', async () => {
    mockSetItem.mockResolvedValue()
    await saveLocale('en')
    expect(mockSetItem).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en')
  })

  it('does not throw when the write fails', async () => {
    mockSetItem.mockRejectedValue(new Error('disk full'))
    await expect(saveLocale('en')).resolves.toBeUndefined()
  })
})
