import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { stepColouring } from '@/domain/exercise'
import { answerOf, problemStates, problemSteps, type Problem } from '@/domain/problem'
import { emptySoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus, tintsFor } from '@/ui/abacus/Abacus'
import { beadModeScale } from '@/ui/abacus/geometry'
import { Button } from '@/ui/kit/Button'
import { useMoveReplay } from '@/ui/session/useMoveReplay'
import { colors, fonts, fontSizes, space } from '@/ui/theme'
import { OperandBoard } from './OperandBoard'

// Spec (multiplication) §4: one worked 2×2 problem, small enough to follow
// and with every kind of placement in it.
const EXAMPLE: Problem = { op: 'mul', digits: 2, a: 47, b: 36 }

// The pages: the method, where each digit goes, one page per 九九 (its
// bead steps play as the page opens), and the result.
type Page = { kind: 'method' } | { kind: 'placement' } | { kind: 'group'; index: number } | { kind: 'result' }

export function MultiplyIntro({ finishLabel, onFinish }: { finishLabel: string; onFinish: () => void }) {
  const strings = useStrings()
  const { width } = useWindowDimensions()
  const replay = useMoveReplay()
  const [page, setPage] = useState(0)
  // The screen that owns this goes away only once progress is saved, so a
  // second tap in the meantime must not finish it twice.
  const finished = useRef(false)

  const groups = problemSteps(EXAMPLE)
  const states = problemStates(EXAMPLE)
  const pages: Page[] = [
    { kind: 'method' },
    { kind: 'placement' },
    ...groups.map((_, index) => ({ kind: 'group' as const, index })),
    { kind: 'result' },
  ]
  // Where each group's steps start in `states`: state k is the soroban after
  // step k − 1, so a group's states run from its first step's start to its
  // last step's end.
  const starts = groups.reduce<number[]>((acc, group, i) => [...acc, (acc[i] ?? 0) + group.steps.length], [0])

  const current = pages[page] ?? { kind: 'result' }
  const shown = replay.soroban ?? states[current.kind === 'result' ? states.length - 1 : 0] ?? emptySoroban(4)

  // What a 九九's page replays: the soroban before its first step, then after
  // each of its steps.
  function groupStates(index: number): Soroban[] {
    const from = starts[index] ?? 0
    const to = starts[index + 1] ?? from
    return states.slice(from, to + 1)
  }

  function next() {
    const target = pages[page + 1]
    if (target === undefined) return
    if (target.kind === 'group') replay.play(groupStates(target.index))
    setPage(page + 1)
  }

  // The owner's request (2026-09-23), as when stepping a question: the page's
  // 九九 is the operation, so the beads it has moved so far are red, the
  // latest step's the deepest. The replay's step is its index into the
  // page's states, so this follows the replay and, once it has played out,
  // keeps the whole 九九 coloured until the next page. Other pages colour
  // nothing.
  const tintedBeads =
    current.kind === 'group' && replay.step !== null
      ? tintsFor(stepColouring(groupStates(current.index), [0], replay.step))
      : undefined

  const group = current.kind === 'group' ? groups[current.index] : undefined
  const text =
    current.kind === 'method'
      ? strings.introMethod
      : current.kind === 'placement'
        ? strings.introPlacement
        : current.kind === 'result'
          ? strings.introResult(EXAMPLE.a, EXAMPLE.b, answerOf(EXAMPLE))
          : group?.kind === 'product'
            ? strings.productLine(group.x, group.y, group.place, group.cascades)
            : ''

  return (
    <View style={styles.intro}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {strings.introTitle}
        </Text>
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i <= page && styles.dotReached]} />
          ))}
        </View>
      </View>
      {/* As in the reading drill, the button stays pinned at the bottom and
          everything that can grow scrolls instead of pushing it off a short
          screen. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.problem}>{`${EXAMPLE.a} × ${EXAMPLE.b}`}</Text>
        <View testID="intro-soroban" style={styles.soroban}>
          <Abacus
            soroban={shown}
            fade={0}
            scale={beadModeScale(4, width - 2 * space.xl)}
            tintedBeads={tintedBeads}
          />
        </View>
        {/* The two numbers under the soroban, as in a × round. A 九九's page
            points at its two digits for as long as the page is open. */}
        <OperandBoard problem={EXAMPLE} activeGroup={group} />
        <Text testID="intro-text" style={styles.text}>
          {text}
        </Text>
      </ScrollView>
      {current.kind === 'result' ? (
        <Button
          testID="intro-finish"
          label={finishLabel}
          onPress={() => {
            if (finished.current) return
            finished.current = true
            onFinish()
          }}
        />
      ) : (
        <Button testID="intro-next" label={strings.next} onPress={next} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  intro: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  title: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.track },
  dotReached: { backgroundColor: colors.accent },
  problem: {
    marginTop: space.lg,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.prompt,
    color: colors.ink,
  },
  soroban: { marginTop: space.lg },
  text: { marginTop: space.lg, fontSize: fontSizes.body, lineHeight: 24, color: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
})
