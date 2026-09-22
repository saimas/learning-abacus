import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { ATOMS } from '@/domain/atoms'
import { dayKey } from '@/domain/progress'
import { selectSession, type SessionPlan } from '@/domain/session'
import { useStrings } from '@/i18n'
import { PartChooser, type PartChoice } from '@/ui/home/PartChooser'
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
  // Never read fresh from Date.now() during render: react-hooks/purity
  // forbids calling an impure function while rendering. Home stays mounted
  // underneath /session, /progress and /settings, and iOS keeps a suspended
  // app alive overnight, so a value captured only once at mount would still
  // say yesterday the next morning. Instead it is refreshed from effects: on
  // focus, and whenever the app comes back to the foreground.
  const [today, setToday] = useState(() => dayKey(Date.now()))

  // The chooser: the plan it describes, and whether it is open. The plan is
  // kept after closing so the rows do not change while the sheet fades out.
  // Built when the start button is pressed, never during render.
  const [chooser, setChooser] = useState<{ plan: SessionPlan; open: boolean } | null>(null)

  const refreshToday = useCallback(() => {
    setToday(dayKey(Date.now()))
  }, [])

  useFocusEffect(refreshToday)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refreshToday()
        // A sheet left open in the background describes an old plan.
        setChooser((previous) => (previous === null ? null : { ...previous, open: false }))
      }
    })
    return () => subscription.remove()
  }, [refreshToday])

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

  const openChooser = () => setChooser({ plan: selectSession(progress, Date.now()), open: true })
  const closeChooser = () => setChooser((previous) => (previous === null ? null : { ...previous, open: false }))
  const choose = (choice: PartChoice) => {
    // A second tap while the sheet fades out must not start a second session.
    if (chooser === null || !chooser.open) return
    closeChooser()
    router.push(choice === 'all' ? '/session' : { pathname: '/session', params: { part: choice } })
  }

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
          main button steps down to an outline. Either way it first asks what
          to practise. */}
      {practisedToday ? (
        <Button testID="start" variant="outline" label={strings.practiseAgain} onPress={openChooser} />
      ) : (
        <Button testID="start" label={strings.start} detail={strings.startMinutes} onPress={openChooser} />
      )}
      <PartChooser
        plan={chooser?.plan ?? null}
        visible={chooser?.open ?? false}
        onChoose={choose}
        onClose={closeChooser}
      />
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
