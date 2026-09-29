import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { practiceId, type PairOperation, type PracticeKind } from '@/domain/problem'
import { dayKey } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { IconButton } from '@/ui/kit/IconButton'
import { Screen } from '@/ui/kit/Screen'
import { Seal, type SealState } from '@/ui/kit/Seal'
import { PracticeTable } from '@/ui/progress/PracticeTable'
import { useProgress } from '@/ui/ProgressProvider'
import { cellColors, colors, fonts, fontSizes, space } from '@/ui/theme'

// Spec (core rounds) §6: Home is built around けたの練習 — the grid below is
// the practice table itself, tap a cell to start that round — with the
// walkthrough buttons under it and the days-practised seal above. Spec (roll)
// §2: the single-move session (基礎の練習) and its card are gone.
export default function Home() {
  const { progress, hydrated } = useProgress()
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
            tile. The owner (2026-09-29) found small links hard to see, then
            full-size buttons too big: one row of tiles in the grid cells'
            tan, a symbol over its name, each a quarter of the width and still
            well past the 44 pt tap size. */}
        <Text style={styles.sectionTitle}>{strings.homeHowToSection}</Text>
        <View testID="home-howto-row" style={styles.howTos}>
          {HOW_TO_OPS.map((op) => (
            <Pressable
              key={op}
              testID={`home-howto-${op}`}
              accessibilityRole="button"
              accessibilityLabel={strings.howToTitle(op)}
              onPress={() => openHowTo(op)}
              style={({ pressed }) => [styles.howTo, pressed && styles.pressed]}
            >
              <Text maxFontSizeMultiplier={HOW_TO_TEXT_CAP} style={styles.howToSymbol}>
                {strings.howToSymbol(op)}
              </Text>
              <Text maxFontSizeMultiplier={HOW_TO_TEXT_CAP} style={styles.howToName}>
                {strings.howToName(op)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

// How far the tiles' words grow with the text size: at 1.4× "Subtract",
// the longest name, still fits a quarter of a 375 pt phone's width.
const HOW_TO_TEXT_CAP = 1.4

const HOW_TO_OPS: readonly PairOperation[] = ['add', 'sub', 'mul', 'div']

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
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
  // One row of tiles, each an equal share of it.
  howTos: { flexDirection: 'row', gap: space.sm },
  howTo: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: 8,
    backgroundColor: cellColors.unseen,
  },
  // As the grid's cells.
  pressed: { opacity: 0.85 },
  howToSymbol: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  howToName: { fontSize: fontSizes.small, color: colors.ink },
})
