import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useLocale, useStrings } from '@/i18n'
import { LOCALES, LOCALE_NAMES } from '@/i18n/locale'
import { useProgress } from '@/ui/ProgressProvider'

export default function Settings() {
  const { progress, hydrated, reset } = useProgress()
  const { locale, setLocale } = useLocale()
  const strings = useStrings()
  const [confirming, setConfirming] = useState(false)

  if (!hydrated) return <Text testID="hydrating">{strings.loading}</Text>

  return (
    <View>
      <Text testID="days-practiced">{strings.daysPracticed(progress.daysPracticed)}</Text>

      {/* Above the reset, so the destructive control stays last on screen. */}
      <Text testID="language-label">{strings.languageLabel}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {LOCALES.map((option) => (
          <Pressable
            key={option}
            testID={`locale-${option}`}
            accessibilityRole="button"
            accessibilityState={{ selected: option === locale }}
            onPress={() => setLocale(option)}
          >
            {/* Never translated: the way back for someone who mistapped
                into a language they cannot read. */}
            <Text testID={`locale-${option}-label`}>{LOCALE_NAMES[option]}</Text>
          </Pressable>
        ))}
      </View>

      {confirming ? (
        <Pressable testID="reset-confirm" accessibilityRole="button" onPress={() => void reset()}>
          <Text>{strings.resetConfirm}</Text>
        </Pressable>
      ) : (
        <Pressable testID="reset" accessibilityRole="button" onPress={() => setConfirming(true)}>
          <Text>{strings.resetAll}</Text>
        </Pressable>
      )}
      <Link href="/" testID="link-today">
        {strings.navToday}
      </Link>
    </View>
  )
}
