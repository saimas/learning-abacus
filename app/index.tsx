import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { practiceId, type PairOperation, type PracticeKind } from '@/domain/problem'
import { dayKey } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { Button } from '@/ui/kit/Button'
import { IconButton } from '@/ui/kit/IconButton'
import { Screen } from '@/ui/kit/Screen'
import { Seal, type SealState } from '@/ui/kit/Seal'
import { PracticeTable } from '@/ui/progress/PracticeTable'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (core rounds) §6: Home is built around けたの練習 — the grid below is
// the practice table itself, tap a cell to start that round — with the
// walkthrough buttons under it and the days-practised seal above. Spec (roll)
// §2: the single-move session (基礎の練習) and its card are gone.
export default function Home() {
  const { progress, hydrated } = useProgress()
  // From a large text size up, the walkthrough buttons' labels no longer fit
  // half the width, so the buttons stack instead of wrapping them.
  const stackHowTos = useWindowDimensions().fontScale >= HOW_TO_STACK_SCALE
  const strings = useStrings()
  // Never read fresh from Date.now() during render: react-hooks/purity
  // forbids calling an impure function while rendering. Home stays mounted
  // underneath /round, /progress and /settings, and iOS keeps a suspended
  // app alive overnight, so a value captured only once at mount would still
  // say yesterday the next morning. Instead it is refreshed from effects: on
  // focus, and whenever the app comes back to the foreground.
  const [today, setToday] = useState(() => dayKey(Date.now()))

  // A grid cell or a やりかた button pushes straight to router.push. /round and a
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
      if (status === 'active') refreshToday()
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

  // `leaving` guards both: a second push before the first has navigated away
  // would otherwise stack a second round or walkthrough on top of the first.
  const startRound = (kind: PracticeKind) => {
    if (leaving.current) return
    leaving.current = true
    router.push({ pathname: '/round', params: { kind: practiceId(kind) } })
  }
  const openHowTo = (op: PairOperation) => {
    if (leaving.current) return
    leaving.current = true
    router.push({ pathname: '/howto/[op]', params: { op } })
  }

  const howToRows: PairOperation[][] = stackHowTos
    ? HOW_TO_OPS.map((op) => [op])
    : [HOW_TO_OPS.slice(0, 2), HOW_TO_OPS.slice(2)]

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
        {/* Spec (howto tutorial) §3: each operation's lessons, from its own
            button. The owner (2026-09-29) found the small links hard to see
            and to tap, so they are full-size buttons under a heading of
            their own: two rows of two, or one per row at a large text size,
            where half the width no longer fits their labels. */}
        <Text style={styles.sectionTitle}>{strings.homeHowToSection}</Text>
        <View style={styles.howTos}>
          {howToRows.map((row) => (
            <View key={row.join()} testID="home-howto-row" style={styles.howToRow}>
              {row.map((op) => (
                <View key={op} style={styles.howTo}>
                  <Button
                    testID={`home-howto-${op}`}
                    variant="outline"
                    label={strings.howToButton(op)}
                    accessibilityLabel={strings.howToTitle(op)}
                    onPress={() => openHowTo(op)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

// The text size from which Home's lesson buttons stack: "− Subtract" fills
// half a 375 pt phone's width at about 1.25×.
const HOW_TO_STACK_SCALE = 1.2

const HOW_TO_OPS: readonly PairOperation[] = ['add', 'sub', 'mul', 'div']

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
  // small phone scroll down to the walkthrough buttons instead of the grid
  // pushing them off the bottom of the screen.
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  // The same heading as the grid's (PracticeTable).
  sectionTitle: {
    marginTop: space.xl,
    marginBottom: space.sm,
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.ink,
  },
  // Rows of buttons, each button an equal share of its row.
  howTos: { gap: space.md },
  howToRow: { flexDirection: 'row', gap: space.md },
  howTo: { flex: 1 },
})
