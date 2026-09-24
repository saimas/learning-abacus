import { useState } from 'react'
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { stepColouring } from '@/domain/exercise'
import { answerOf, OPERATION_SYMBOL, problemStates, problemSteps, rodsFor, type Problem } from '@/domain/problem'
import { emptySoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus, tintsFor } from '@/ui/abacus/Abacus'
import { beadModeScale } from '@/ui/abacus/geometry'
import { Button } from '@/ui/kit/Button'
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { groupLine } from '@/ui/round/ProblemCorrectionCard'
import { useMoveReplay } from '@/ui/session/useMoveReplay'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// What the × walkthrough says around its worked problem: its title, what the
// method does, where each digit goes, and the result. The group pages need
// no text of their own: they read as the answer card's lines.
export type IntroTexts = {
  title: string
  method: string
  placement: string
  result: (a: number, b: number, answer: number) => string
}

// The pages: the method, where each digit goes, one page per step group (its
// bead steps play as the page opens), and the result. A group is a 九九 of
// the × problem this walkthrough works through.
type Page = { kind: 'method' } | { kind: 'placement' } | { kind: 'group'; index: number } | { kind: 'result' }

// Spec (multiplication) §4: the × walkthrough shown before its first round,
// working 47 × 36 through on the soroban (両落とし), with both numbers on
// the board beneath. ÷ used to share this component with its own text
// pages; it now has DivideWalkthrough (spec: division walkthrough §4), so
// this stays generic over the problem it is given but is only ever handed
// a × one.
export function MethodIntro({
  problem,
  intro,
  finishLabel,
  onFinish,
}: {
  problem: Problem
  intro: IntroTexts
  finishLabel: string
  onFinish: () => void
}) {
  const strings = useStrings()
  const { width } = useWindowDimensions()
  const replay = useMoveReplay()
  const [page, setPage] = useState(0)

  const groups = problemSteps(problem)
  const states = problemStates(problem)
  const rods = rodsFor(problem)
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
  // Before the first group plays, the soroban is empty: 両落とし builds
  // only the product.
  const shown = replay.soroban ?? states[current.kind === 'result' ? states.length - 1 : 0] ?? emptySoroban(rods)

  // What a group's page replays: the soroban before its first step, then
  // after each of its steps.
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

  // The owner's request (2026-09-24): a way back through the walkthrough,
  // not just forward. Landing on a group page replays it from its own start,
  // same as opening it going forward; landing on the method or placement
  // page just stops the replay, so `shown` falls back to that page's first
  // state (the empty soroban). Page 0 has no ◀ to press; should that change,
  // it has no page before it, so the same guard as next()'s stops it.
  function back() {
    const target = pages[page - 1]
    if (target === undefined) return
    if (target.kind === 'group') replay.play(groupStates(target.index))
    else replay.stop()
    setPage(page - 1)
  }

  // The owner's request (2026-09-23), as when stepping a question: the page's
  // group is the operation, so the beads it has moved so far are red, the
  // latest step's the deepest. The replay's step is its index into the
  // page's states, so this follows the replay and, once it has played out,
  // keeps the whole group coloured until the next page. Other pages colour
  // nothing.
  const tintedBeads =
    current.kind === 'group' && replay.step !== null
      ? tintsFor(stepColouring(groupStates(current.index), [0], replay.step))
      : undefined

  const group = current.kind === 'group' ? groups[current.index] : undefined
  function pageText(): string {
    switch (current.kind) {
      case 'method':
        return intro.method
      case 'placement':
        return intro.placement
      case 'result':
        return intro.result(problem.a, problem.b, answerOf(problem))
      case 'group':
        return group === undefined ? '' : (groupLine(strings, problem, group) ?? '')
    }
  }
  const text = pageText()

  return (
    <View style={styles.intro}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {intro.title}
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
        <Text style={styles.problem}>{`${problem.a} ${OPERATION_SYMBOL[problem.op]} ${problem.b}`}</Text>
        <View testID="intro-soroban" style={styles.soroban}>
          <Abacus
            soroban={shown}
            fade={0}
            scale={beadModeScale(rods, width - 2 * space.xl)}
            tintedBeads={tintedBeads}
          />
        </View>
        {/* The board under the soroban, as in a round: both numbers, with
            a 九九's page pointing at its digits for as long as it is open. */}
        <OperandBoard problem={problem} activeGroup={group} />
        <Text testID="intro-text" style={styles.text}>
          {text}
        </Text>
      </ScrollView>
      {/* The outline ◀ sits beside the primary button rather than pinned on
          its own, so the pair reads as one control; it takes a fixed width
          and the primary the rest, so はじめる/つぎへ stays the prominent
          one. Page 0 has nowhere to go back to, so it is left out rather
          than shown disabled. */}
      <View style={styles.controls}>
        {page > 0 && (
          <View style={styles.back}>
            <Button testID="intro-back" variant="outline" label={strings.introBack} onPress={back} />
          </View>
        )}
        <View style={styles.primary}>
          {current.kind === 'result' ? (
            <Button testID="intro-finish" label={finishLabel} onPress={onFinish} />
          ) : (
            <Button testID="intro-next" label={strings.next} onPress={next} />
          )}
        </View>
      </View>
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
  controls: { flexDirection: 'row', gap: space.sm },
  back: { width: 110 },
  primary: { flex: 1 },
})
