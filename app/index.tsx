import { Link, Redirect, router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { operationSummary } from '@/domain/practice'
import { OPERATION_SYMBOL, OPERATIONS, type Operation } from '@/domain/problem'
import { dayKey } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { IconButton } from '@/ui/kit/IconButton'
import { Screen } from '@/ui/kit/Screen'
import { Seal, type SealState } from '@/ui/kit/Seal'
import { STAGE_COLOR, stageInk } from '@/ui/progress/stageColor'
import { RankBadge } from '@/ui/rank/RankBadge'
import { useOnePush } from '@/ui/useOnePush'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

// Spec (home menu) §2: Home is a menu. The days-practised seal and the rank
// stay on top; under 「練習」 each operation has a button, two to a row,
// opening its page (app/practice/[op].tsx), where its sizes' runs start and
// its lessons open. The grid and the やりかた row moved there, so Home fits
// on one screen however many kinds are added (the owner, 2026-10-07: "It is
// hard to see the menu as the contents grows"). Spec (roll) §2: the
// single-move session (基礎の練習) and its card are gone.
export default function Home() {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()
  // Never read fresh from Date.now() during render: react-hooks/purity
  // forbids calling an impure function while rendering. Home stays mounted
  // underneath the operation pages, /progress and /settings, and iOS keeps a
  // suspended app alive overnight, so a value captured only once at mount
  // would still say yesterday the next morning. Instead it is refreshed from
  // effects: on focus, and whenever the app comes back to the foreground.
  const [today, setToday] = useState(() => dayKey(Date.now()))

  const onePush = useOnePush()

  const refreshToday = useCallback(() => {
    setToday(dayKey(Date.now()))
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

  // useOnePush guards every button: two quick taps, on one button or on two,
  // open one page.
  const openOperation = (op: Operation) =>
    onePush(() => router.push({ pathname: '/practice/[op]', params: { op } }))

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
        <RankBadge points={progress.points} />

        {/* Spec (home menu) §2: each button shows how far the learner has
            got with its operation (the highest level among its sizes, or
            まだ) and is tinted by the most advanced stage among them, in the
            progress table's colours. */}
        <Text style={styles.sectionTitle}>{strings.practiceMenu}</Text>
        <View testID="home-ops" style={styles.menu}>
          {MENU_ROWS.map((row, index) => (
            <View key={index} testID={`home-ops-row-${index}`} style={styles.menuRow}>
              {row.map((op) => {
                const { level, stage } = operationSummary(progress.practices, op)
                const ink = { color: stageInk(stage) }
                return (
                  <Pressable
                    key={op}
                    testID={`home-op-${op}`}
                    accessibilityRole="button"
                    accessibilityLabel={strings.menuLabel(op, level)}
                    onPress={() => openOperation(op)}
                    style={({ pressed }) => [
                      styles.op,
                      { backgroundColor: STAGE_COLOR[stage] },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text maxFontSizeMultiplier={MENU_TEXT_CAP} style={[styles.opSymbol, ink]}>
                      {OPERATION_SYMBOL[op]}
                    </Text>
                    <Text maxFontSizeMultiplier={MENU_TEXT_CAP} style={[styles.opName, ink]}>
                      {strings.menuName(op)}
                    </Text>
                    <Text
                      testID={`home-op-level-${op}`}
                      maxFontSizeMultiplier={MENU_TEXT_CAP}
                      style={[styles.opLevel, ink]}
                    >
                      {level === undefined ? strings.practiceStageName('unseen') : strings.levelName(level)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}

// Spec (home menu) §2: two buttons to a row, in OPERATIONS order.
const MENU_ROWS: readonly (readonly Operation[])[] = Array.from(
  { length: Math.ceil(OPERATIONS.length / 2) },
  (_, row) => OPERATIONS.slice(row * 2, row * 2 + 2),
)

// How far the buttons' words grow with the text size. At 1.4× 「フラッシュ暗算」,
// the longest name, still fits half a 375 pt phone's width on one line, and
// up to the largest standard text size the three rows, the seal and the
// rank fit its 667 pt height. At the accessibility sizes the seal's and the
// rank's words keep growing, and Home scrolls.
const MENU_TEXT_CAP = 1.4

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.md },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  streakText: { flex: 1, gap: 2 },
  days: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink },
  muted: { fontSize: fontSizes.small, color: colors.muted },
  // flex: 1 on the ScrollView itself (not just its content): past the text
  // sizes Home is laid out for, it scrolls rather than cutting a row off.
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  // The same heading as the progress table's (PracticeTable).
  sectionTitle: {
    marginTop: space.lg,
    marginBottom: space.sm,
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    color: colors.ink,
  },
  menu: { gap: space.sm },
  // Two buttons to a row, each an equal share of it.
  menuRow: { flexDirection: 'row', gap: space.sm },
  // A symbol over its name over its level, well past the 44 pt tap size.
  // The narrow side padding leaves the name its half of the width.
  op: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.panel,
  },
  // As the progress table's cells and an operation's cards.
  pressed: { opacity: 0.85 },
  opSymbol: { fontFamily: fonts.display, fontSize: 22 },
  opName: { fontSize: fontSizes.body, fontWeight: '600' },
  opLevel: { fontSize: fontSizes.small },
})
