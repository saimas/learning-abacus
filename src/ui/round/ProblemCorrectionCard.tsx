import { StyleSheet, Text, View } from 'react-native'
import type { Atom } from '@/domain/atoms'
import { divisorFirstDigit, problemSteps, type MitoriProblem, type Problem, type StepGroup } from '@/domain/problem'
import { useStrings } from '@/i18n'
import type { Strings } from '@/i18n/ja'
import { useActiveLineLayout } from '@/ui/session/useActiveLineLayout'
import { colors, fonts } from '@/ui/theme'

// The explanation of a problem, as the step panel shows it: the answer, then
// how each group is worked, highest place first, in the same words as a
// single move's card. A column group (＋ −) reads as its rod and move, and
// a 見取算 problem's columns sit under a heading per number; a product group
// (×) reads as the 九九 and where its digits land. A ÷ problem alternates a
// quotient group, read as how its digit is guessed by 九九 (lowered when too
// big to take away) and where it is placed (割れる / 割れない), and a subtract
// group per divisor digit, read as the 九九 and the rods its digits come off.
// `activeGroup` indexes problemSteps(problem): the group the learner has
// stepped into. The panel draws the card around these lines. `showAnswer`
// is false before an answer, where the lines explain the problem without
// giving the answer away.
export function ProblemCorrectionCard({
  problem,
  expected,
  expectedBeads,
  activeGroup,
  showAnswer = true,
}: {
  problem: Problem
  expected: number
  // Set only by a caller drawing this in bead mode, and only for a ÷ problem
  // (Exercise.expectedBeads): the final soroban reading (spec (division) §2's
  // quotient followed by zeros) that the beads themselves were checked
  // against, which is not `expected` (the quotient) once N > 0. Undefined
  // everywhere else, so the answer line reads exactly as it always has.
  expectedBeads?: number
  activeGroup?: number
  showAnswer?: boolean
}) {
  const strings = useStrings()
  // Where the lines scroll on their own (bead mode), the active group's line
  // tells the scroll where it sits, so it can be scrolled into view. The
  // lines are numbered as problemSteps numbers the groups.
  const lineLayout = useActiveLineLayout(activeGroup)
  const groups = problemSteps(problem)

  return (
    <View testID="correction">
      {showAnswer ? (
        <Text testID="correction-answer" style={styles.answer}>
          {expectedBeads === undefined
            ? strings.correctionAnswer(expected)
            : strings.correctionAnswerOnBeads(expected, expectedBeads)}
        </Text>
      ) : null}
      {problem.op === 'mitori'
        ? mitoriRows(problem, groups, activeGroup).map((row) =>
          row.kind === 'heading' ? (
            <Text
              key={`term-${row.term}`}
              testID={`correction-term-${row.term}`}
              style={[styles.heading, row.shaded && styles.shaded, row.shaded && styles.activeHeading]}
            >
              {strings.mitoriHeading(row.value, row.before, row.after)}
            </Text>
          ) : (
            <Text
              key={row.index}
              // A 見取算 line is named by its number and its rod, since each
              // number has a column on each rod.
              testID={`correction-term-${row.term}-${row.group.place}`}
              onLayout={lineLayout(row.index)}
              style={[
                styles.line,
                styles.termLine,
                row.shaded && styles.shaded,
                row.index === activeGroup && styles.activeLine,
              ]}
            >
              {strings.columnLine(row.group.place, row.group.atom, row.group.cascades)}
            </Text>
          ),
        )
        : groups.map((group, index) => {
          const line = groupLine(strings, problem, group)
          if (line === null) return null
          return (
            <Text
              key={index}
              // A column is named by its rod, which is unique; the other
              // kinds by their index, since a place repeats across 九九.
              testID={group.kind === 'column' ? `correction-column-${group.place}` : `correction-${group.kind}-${index}`}
              onLayout={lineLayout(index)}
              style={[styles.line, index === activeGroup && styles.activeLine]}
            >
              {line}
            </Text>
          )
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

type MitoriRow =
  | { kind: 'heading'; term: number; value: number; before: number; after: number; shaded: boolean }
  | { kind: 'line'; term: number; index: number; group: { place: number; atom: Atom; cascades: boolean }; shaded: boolean }

// Spec (見取算) §7, the owner (2026-09-27: it was hard to tell which clicks
// were −59's and which +39's): each number after the first heads its own
// lines, with what the soroban reads before and after it, and the number
// stepped into is shaded, heading and lines together. The rows are the
// card's direct children, never wrapped per number, so every line keeps the
// card's origin for useActiveLineLayout. `index` numbers a line as
// problemSteps numbers its group; a column that moves nothing has no line.
function mitoriRows(problem: MitoriProblem, groups: StepGroup[], activeGroup: number | undefined): MitoriRow[] {
  const active = activeGroup === undefined ? undefined : groups[activeGroup]
  const activeTerm = active?.kind === 'column' ? active.term : undefined
  const rows: MitoriRow[] = []
  let total = problem.terms[0] ?? 0
  problem.terms.forEach((value, term) => {
    if (term === 0) return
    const shaded = term === activeTerm
    rows.push({ kind: 'heading', term, value, before: total, after: total + value, shaded })
    total += value
    groups.forEach((group, index) => {
      if (group.kind !== 'column' || group.term !== term || group.atom === null) return
      rows.push({ kind: 'line', term, index, group: { place: group.place, atom: group.atom, cascades: group.cascades }, shaded })
    })
  })
  return rows
}

const styles = StyleSheet.create({
  answer: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  line: { marginTop: 2, fontSize: 12, color: colors.muted },
  activeLine: { color: colors.accent, fontWeight: '700', backgroundColor: colors.accentSoft },
  // A 見取算 number's heading, and its lines indented under it. Padding
  // rather than margins inside a number, so its shading runs unbroken from
  // the heading to its last line.
  heading: { marginTop: 6, paddingTop: 2, fontSize: 12, fontWeight: '700', color: colors.ink },
  termLine: { marginTop: 0, paddingTop: 2, paddingLeft: 12 },
  shaded: { backgroundColor: colors.accentSoft },
  activeHeading: { color: colors.accent },
})
