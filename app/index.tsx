import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { practiceId, type PracticeKind } from '@/domain/problem'
import { dayKey } from '@/domain/progress'
import { selectSession, type SessionPlan } from '@/domain/session'
import { useStrings } from '@/i18n'
import { PartChooser, type PartChoice } from '@/ui/home/PartChooser'
import { PlanBar } from '@/ui/home/PlanBar'
import { Card } from '@/ui/kit/Card'
import { IconButton } from '@/ui/kit/IconButton'
import { Screen } from '@/ui/kit/Screen'
import { Seal, type SealState } from '@/ui/kit/Seal'
import { PracticeTable } from '@/ui/progress/PracticeTable'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (core rounds) §6: Home is built around けたの練習 — the grid below is
// the practice table itself, tap a cell to start that round. The single-move
// daily session (基礎の練習) moves behind a smaller card under the grid; a
// tap opens the same chooser sheet as before, now built from today's plan
// only when the card is pressed.
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
  // Built when the basics card is pressed, never during render.
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

  const openChooser = () => setChooser({ plan: selectSession(progress, Date.now()), open: true })
  const closeChooser = () => setChooser((previous) => (previous === null ? null : { ...previous, open: false }))
  const choose = (choice: PartChoice) => {
    // A second tap while the sheet fades out must not start a second session.
    if (chooser === null || !chooser.open) return
    closeChooser()
    router.push(choice === 'all' ? '/session' : { pathname: '/session', params: { part: choice } })
  }
  // The grid cell and the やりかた link sit on Home itself, not inside the
  // sheet, so there is no fade-out to guard against — only the sheet being
  // open at all, since its backdrop should otherwise catch the tap.
  const startRound = (kind: PracticeKind) => {
    if (chooser?.open) return
    router.push({ pathname: '/round', params: { kind: practiceId(kind) } })
  }
  const openHowTo = () => {
    if (chooser?.open) return
    router.push('/multiply-intro')
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <PracticeTable progress={progress} onChoose={startRound} />
        <Pressable testID="home-howto" accessibilityRole="link" onPress={openHowTo} hitSlop={12} style={styles.howTo}>
          <Text style={styles.howToText}>{strings.homeHowTo}</Text>
        </Pressable>
        <Pressable testID="home-basics" accessibilityRole="button" onPress={openChooser} style={styles.basics}>
          <Card>
            <View style={styles.basicsHeader}>
              <Text style={styles.basicsTitle}>{strings.basicsTitle}</Text>
              <Text style={styles.basicsDetail}>{strings.basicsDetail}</Text>
            </View>
            <PlanBar />
          </Card>
        </Pressable>
      </ScrollView>
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
  // flex: 1 on the ScrollView itself (not just its content) is what lets a
  // small phone scroll down to the basics card instead of the grid pushing
  // it off the bottom of the screen.
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  // The caption text stays small, but padding plus hitSlop above give the
  // link a tap target close to the platforms' ~44pt minimum.
  howTo: { alignSelf: 'flex-end', marginTop: space.sm, paddingVertical: space.sm },
  howToText: { fontSize: fontSizes.caption, color: colors.accent, textDecorationLine: 'underline' },
  basics: { marginTop: space.xl },
  basicsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  basicsTitle: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  basicsDetail: { fontSize: fontSizes.caption, color: colors.muted },
})
