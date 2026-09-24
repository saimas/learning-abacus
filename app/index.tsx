import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
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

  // A grid cell or a やりかた link pushes straight to router.push, with no
  // sheet to guard the second tap the way choose() does. /round and a
  // walkthrough opened for a round disable the swipe-back gesture
  // (app/_layout.tsx), so a double tap that slips through lands the child in
  // a second round or walkthrough on top of the first, only reachable by
  // leaving it. A ref (not state) is enough: nothing needs to re-render
  // while it is set, only read at the next press. It clears when Home
  // regains focus, alongside refreshToday, since by then any push it was
  // guarding has resolved.
  const leaving = useRef(false)

  const refreshToday = useCallback(() => {
    setToday(dayKey(Date.now()))
    leaving.current = false
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
  // The grid cell and the やりかた links sit on Home itself, not inside the
  // sheet, so there is no fade-out to guard against — only the sheet being
  // open at all, since its backdrop should otherwise catch the tap, and
  // `leaving`, since a second push before the first has navigated away
  // would otherwise stack a second round or walkthrough on top of the first.
  const startRound = (kind: PracticeKind) => {
    if (chooser?.open || leaving.current) return
    leaving.current = true
    router.push({ pathname: '/round', params: { kind: practiceId(kind) } })
  }
  const openHowTo = (pathname: '/multiply-intro' | '/divide-intro') => {
    if (chooser?.open || leaving.current) return
    leaving.current = true
    router.push(pathname)
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
        {/* Spec (division) §3: each walkthrough can be replayed from here,
            in the grid's order, × then ÷. */}
        <View style={styles.howTos}>
          <Pressable
            testID="home-howto"
            accessibilityRole="link"
            onPress={() => openHowTo('/multiply-intro')}
            hitSlop={HOW_TO_SLOP}
            style={styles.howTo}
          >
            <Text style={styles.howToText}>{strings.homeHowTo}</Text>
          </Pressable>
          <Pressable
            testID="home-howto-div"
            accessibilityRole="link"
            onPress={() => openHowTo('/divide-intro')}
            hitSlop={HOW_TO_SLOP}
            style={styles.howTo}
          >
            <Text style={styles.howToText}>{strings.homeHowToDivide}</Text>
          </Pressable>
        </View>
        <Pressable
          testID="home-basics"
          accessibilityRole="button"
          accessibilityLabel={`${strings.basicsTitle}、${strings.basicsDetail}`}
          onPress={openChooser}
          style={({ pressed }) => [styles.basics, pressed && styles.basicsPressed]}
        >
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

// How far past its text each やりかた link still takes a tap.
const HOW_TO_SLOP = 12

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
  // The caption text stays small, but padding plus hitSlop give each link a
  // tap target close to the platforms' ~44pt minimum. marginTop has to be at
  // least the top hitSlop, or that hitSlop reaches up past the grid's own
  // bottom edge and steals taps meant for its last row. The gap between the
  // links is twice the hitSlop, so the two slops meet rather than overlap
  // and a tap between them goes to the nearer link. At the largest text
  // sizes the two may not fit one line, so the second wraps under the first
  // rather than running off the screen.
  howTos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 2 * HOW_TO_SLOP,
    marginTop: space.md,
  },
  howTo: { paddingVertical: space.sm },
  howToText: { fontSize: fontSizes.caption, color: colors.accent, textDecorationLine: 'underline' },
  basics: { marginTop: space.xl },
  // Same pressed feedback as the chooser's own rows (PartChooser's Row).
  basicsPressed: { opacity: 0.85 },
  basicsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
  },
  basicsTitle: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  basicsDetail: { fontSize: fontSizes.caption, color: colors.muted },
})
