// React-free on purpose: src/storage/localeStore.ts imports this file, and pulling React in here would drag it into the storage layer.
export type Locale = 'ja' | 'en'

// Japanese first: it is the default, and the toggle renders in this order.
export const LOCALES: readonly Locale[] = ['ja', 'en']

export const DEFAULT_LOCALE: Locale = 'ja'

// Endonyms, deliberately never translated. A learner who mistaps into a
// language they cannot read has to be able to find the way back, and cannot
// if the buttons themselves flip.
export const LOCALE_NAMES: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
}

// Narrows whatever came back out of storage. A stored 'fr' — or a null, or a
// number — resolves to the default rather than being trusted into the union.
export function isLocale(value: unknown): value is Locale {
  return value === 'ja' || value === 'en'
}
