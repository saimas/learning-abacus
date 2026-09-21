import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useLocale, useStrings } from '@/i18n'
import { LOCALES, LOCALE_NAMES } from '@/i18n/locale'
import { BackLink } from '@/ui/kit/BackLink'
import { Button } from '@/ui/kit/Button'
import { Card } from '@/ui/kit/Card'
import { Screen } from '@/ui/kit/Screen'
import { SegmentedControl } from '@/ui/kit/SegmentedControl'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

export default function Settings() {
  const { progress, hydrated, reset } = useProgress()
  const { locale, setLocale } = useLocale()
  const strings = useStrings()
  const [confirming, setConfirming] = useState(false)

  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loading}</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <BackLink />
      <Text style={styles.title}>{strings.navSettings}</Text>

      <Card style={styles.group}>
        <View style={styles.item}>
          <Text testID="days-practiced" style={styles.itemText}>
            {strings.daysPracticed(progress.daysPracticed)}
          </Text>
        </View>
        <View style={[styles.item, styles.divider]}>
          <Text testID="language-label" style={styles.itemText}>
            {strings.languageLabel}
          </Text>
          {/* Never translated: the way back for someone who mistapped into a
              language they cannot read. */}
          <SegmentedControl
            options={LOCALES}
            value={locale}
            onChange={setLocale}
            labelFor={(option) => LOCALE_NAMES[option]}
            testIDFor={(option) => `locale-${option}`}
          />
        </View>
      </Card>

      <View style={styles.spacer} />

      {/* Last on screen, and two presses: the first only arms it. */}
      {confirming ? (
        <Button testID="reset-confirm" label={strings.resetConfirm} onPress={() => void reset()} />
      ) : (
        <Button
          testID="reset"
          variant="outline"
          label={strings.resetAll}
          onPress={() => setConfirming(true)}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  group: { marginTop: space.xl, paddingVertical: 0, paddingHorizontal: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: 14,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.track },
  itemText: { fontSize: fontSizes.body, color: colors.ink },
  spacer: { flex: 1 },
})
