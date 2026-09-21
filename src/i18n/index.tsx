import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadLocale, saveLocale } from '@/storage/localeStore'
import { en } from './en'
import { ja, type Strings } from './ja'
import { DEFAULT_LOCALE, type Locale } from './locale'

export const CATALOGS: Record<Locale, Strings> = { ja, en }

export type LocaleApi = { locale: Locale; setLocale: (next: Locale) => void }

// The default context value is the shipped catalog, not a thrown error: a
// component rendered outside the provider — which is every component unit
// test — renders the Japanese default rather than needing a wrapper.
const StringsContext = createContext<Strings>(CATALOGS[DEFAULT_LOCALE])

// `setLocale` does throw outside a provider. Only the Settings toggle calls
// it, and a silent no-op there would look exactly like a broken toggle.
const LocaleContext = createContext<LocaleApi>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {
    throw new Error('setLocale must be used inside a LocaleProvider')
  },
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  // null means "not yet read from storage", which is a different state from
  // any real locale and is what gates the first render.
  const [locale, setLocaleState] = useState<Locale | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadLocale().then((stored) => {
      if (!cancelled) setLocaleState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    void saveLocale(next)
  }, [])

  const api = useMemo(() => ({ locale: locale ?? DEFAULT_LOCALE, setLocale }), [locale, setLocale])

  // Spec §3: one blank frame, rather than a frame of the wrong language.
  // That frame matters most to the learner who deliberately chose English and
  // would otherwise see Japanese flash on every launch.
  if (locale === null) return null

  return (
    <LocaleContext.Provider value={api}>
      <StringsContext.Provider value={CATALOGS[locale]}>{children}</StringsContext.Provider>
    </LocaleContext.Provider>
  )
}

export function useStrings(): Strings {
  return useContext(StringsContext)
}

export function useLocale(): LocaleApi {
  return useContext(LocaleContext)
}
