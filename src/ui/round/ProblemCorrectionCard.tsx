import { StyleSheet, Text, View } from 'react-native'
import { divisorFirstDigit, problemSections, problemSteps, type Problem, type StepGroup } from '@/domain/problem'
import { useStrings } from '@/i18n'
import type { Strings } from '@/i18n/ja'
import { useActiveLineLayout } from '@/ui/session/useActiveLineLayout'
import { colors, fonts } from '@/ui/theme'

// The explanation of a problem, as the step panel shows it: the answer, then
// how each group is worked, highest place first, in the same words as a
// single move's card. A column group (＋ −, 見取算) reads as its rod and
// move; a product group (×) reads as the 九九 and where its digits land. A
// ÷ problem alternates a quotient group, read as how its digit is guessed by
// 九九 (lowered when too big to take away) and where it is placed (割れる /
// 割れない), and a subtract group per divisor digit, read as the 九九 and
// the rods its digits come off.
// Spec (core rounds) §11 (the owner, 2026-09-27: "it is hard to tell upto
// which click was for −59 and +39"): the lines sit under a heading per
// section (problemSections) — a number added or taken off, a multiplicand
// digit, a quotient digit — with what the soroban reads before and after it,
// and the section stepped into is shaded, heading and lines together. The
// headings are the lines' siblings, never wrappers, so every line keeps the
// card's origin for useActiveLineLayout.
// `activeGroup` indexes problemSteps(problem): the group the learner has
// stepped into. The panel draws the card around these lines. `showAnswer`
// is false before an answer, where the lines explain the problem without
// giving the answer away.
export function ProblemCorrectionCard({
  problem,
  expected,
  activeGroup,
  showAnswer = true,
  given,
}: {
  problem: Problem
  expected: number
  activeGroup?: number
  showAnswer?: boolean
  // What the learner's beads read, set only for a miss on the beads once the
  // steps have taken those beads over: named beside the answer so the two
  // can still be compared.
  given?: number
}) {
  const strings = useStrings()
  // Where the lines scroll on their own (bead mode), the active group's line
  // tells the scroll where it sits, so it can be scrolled into view. The
  // lines are numbered as problemSteps numbers the groups.
  const lineLayout = useActiveLineLayout(activeGroup)
  const groups = problemSteps(problem)
  const sections = problemSections(problem)
  // The section the learner has stepped into, or -1 when not stepping.
  const activeSection = activeGroup === undefined ? -1 : sections.findIndex((section) => section.groups.includes(activeGroup))
  const answer = strings.correctionAnswer(expected)

  return (
    <View testID="correction">
      {showAnswer ? (
        <Text testID="correction-answer" style={styles.answer}>
          {given === undefined ? answer : strings.correctionWithGiven(answer, given)}
        </Text>
      ) : null}
      {sections.flatMap((section, sectionIndex) => {
        const shaded = sectionIndex === activeSection
        return [
          <Text
            key={`heading-${sectionIndex}`}
            testID={`correction-heading-${sectionIndex}`}
            style={[styles.heading, shaded && styles.shaded, shaded && styles.activeHeading]}
          >
            {strings.sectionHeading(section)}
          </Text>,
          ...section.groups.flatMap((index) => {
            const group = groups[index]
            const line = group === undefined ? null : groupLine(strings, problem, group)
            if (group === undefined || line === null) return []
            return [
              <Text
                key={index}
                testID={lineTestID(group, index)}
                onLayout={lineLayout(index)}
                style={[styles.line, styles.sectionLine, shaded && styles.shaded, index === activeGroup && styles.activeLine]}
              >
                {line}
              </Text>,
            ]
          }),
        ]
      })}
    </View>
  )
}

// A group's line, or null for a group with nothing to say. Every 九九 gets a
// line, even one whose product is 0 (recalling it is still a step), and so
// does a 0 quotient digit (deciding it is too). Shared with the walkthrough
// (MethodIntro), whose pages read each group in the card's own words.
export function groupLine(strings: Strings, problem: Problem, group: StepGroup): string | null {
  switch (group.kind) {
    case 'column':
      // A column that adds 0 moves nothing.
      return group.atom === null ? null : strings.columnLine(group.place, group.atom, group.cascades)
    case 'product':
      return strings.productLine(group.x, group.y, group.place, group.cascades)
    case 'quotient':
      // Only a ÷ problem has quotient groups.
      if (problem.op !== 'div') return null
      return strings.quotientLine(
        group.q,
        group.partial,
        divisorFirstDigit(problem),
        group.guess,
        group.split,
        group.remainderZero,
      )
    case 'subtract':
      return strings.subtractLine(group.q, group.y, group.place, group.cascades)
  }
}

// A ＋ − column is named by its rod, which is unique; a 見取算 column by its
// number and its rod, since each number has a column on each rod; the other
// kinds by their index, since a place repeats across 九九.
function lineTestID(group: StepGroup, index: number): string {
  if (group.kind !== 'column') return `correction-${group.kind}-${index}`
  return group.term === undefined ? `correction-column-${group.place}` : `correction-term-${group.term}-${group.place}`
}

const styles = StyleSheet.create({
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
  // A section's heading, and its lines indented under it. Padding rather
  // than margins inside a section, so its shading runs unbroken from the
  // heading to its last line.
  heading: { marginTop: 6, paddingTop: 2, fontSize: 12, fontWeight: '700', color: colors.ink },
  sectionLine: { marginTop: 0, paddingTop: 2, paddingLeft: 12 },
  shaded: { backgroundColor: colors.accentSoft },
  activeHeading: { color: colors.accent },
})
