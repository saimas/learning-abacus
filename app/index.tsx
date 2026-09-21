import { Link, Redirect } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ATOMS } from '@/domain/atoms'
import { dayKey } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { PlanBar } from '@/ui/home/PlanBar'
import { Button } from '@/ui/kit/Button'
import { Card } from '@/ui/kit/Card'
import { IconButton } from '@/ui/kit/IconButton'
import { Screen } from '@/ui/kit/Screen'
import { Seal, type SealState } from '@/ui/kit/Seal'
import { AtomGrid, atomStates, mentalCount } from '@/ui/progress/AtomGrid'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

export default function Home() {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()
  // Captured once at mount, not read fresh from Date.now() during render:
  // react-hooks/purity forbids calling an impure function while rendering.
  const [today] = useState(() => dayKey(Date.now()))

  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating" style={styles.muted}>
          {strings.loadingProgress}
        </Text>
      </Screen>
    )
  }

  if (!progress.tutorialDone) {
    return <Redirect href="/tutorial" />
  }

  // The same rule markDayPracticed uses, so nothing new is stored.
  const practisedToday = progress.lastSessionDay === today
  const seal: SealState =
    progress.daysPracticed === 0 ? 'empty' : practisedToday ? 'stamped' : 'outline'
  const mental = mentalCount(atomStates(progress))

  return (
    <Screen>
      <View style={styles.header}>
        <Link href="/progress" asChild testID="link-progress">
          <IconButton icon="grid" label={strings.navProgress} />
        </Link>
        <Link href="/settings" asChild testID="link-settings">
          <IconButton icon="gear" label={strings.navSettings} />
        </Link>
      </View>

      <Text style={styles.title}>{strings.homeTitle}</Text>

      <View style={styles.streak}>
        <Seal
          testID={`seal-${seal}`}
          state={seal}
          text={seal === 'empty' ? '' : strings.sealDays(progress.daysPracticed)}
        />
        <View style={styles.streakText}>
          <Text testID="days-practiced" style={styles.days}>
            {strings.daysPracticed(progress.daysPracticed)}
          </Text>
          <Text testID="today-status" style={styles.muted}>
            {practisedToday ? strings.practisedToday : strings.notYetToday}
          </Text>
          {practisedToday ? <Text style={styles.muted}>{strings.seeYouTomorrow}</Text> : null}
        </View>
      </View>

      <PlanBar />

      <Link href="/progress" asChild testID="link-map">
        <Pressable accessibilityRole="button" style={styles.mapLink}>
          <Card>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>{strings.mapPreviewTitle}</Text>
              <Text style={styles.mapCount}>{`${mental} / ${ATOMS.length}`}</Text>
            </View>
            <AtomGrid progress={progress} compact />
          </Card>
        </Pressable>
      </Link>

      <View style={styles.spacer} />

      {/* Practising again is offered, never pushed: after today's session the
          main button steps down to an outline. */}
      <Link href="/session" asChild testID="start">
        {practisedToday ? (
          <Button variant="outline" label={strings.practiseAgain} />
        ) : (
          <Button label={strings.start} detail={strings.startMinutes} />
        )}
      </Link>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  streakText: { flex: 1, gap: 2 },
  days: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  muted: { fontSize: fontSizes.small, color: colors.muted },
  mapLink: { marginTop: space.xl },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  mapTitle: { fontSize: fontSizes.small, color: colors.muted },
  mapCount: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  spacer: { flex: 1 },
})
