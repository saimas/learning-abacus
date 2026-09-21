import AsyncStorage from '@react-native-async-storage/async-storage'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale'

// Deliberately not the progress key. The locale is a device preference, not
// learning history, and must survive the reset on the Settings screen.
export const LOCALE_STORAGE_KEY = 'learning-abacus/locale/v1'

export async function loadLocale(): Promise<Locale> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(raw) ? raw : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export async function saveLocale(locale: Locale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // A failed write costs the learner one re-toggle; never crash over it.
  }
}
