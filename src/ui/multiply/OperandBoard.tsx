import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { OPERATION_SYMBOL, type Digits, type Problem, type StepGroup } from '@/domain/problem'
import { emptySoroban, setValue } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { geometryFor, scaleToFit, SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { colors, fontSizes, space } from '@/ui/theme'

// The two numbers of a × problem, set on beads beneath the product soroban.
// The owner asked for it (2026-09-23): a 3×3 problem opened on an empty
// soroban, and they expected to see the numbers being multiplied. 両落とし
// builds only the product, so the product soroban starts empty on purpose,
// and the traditional placement, with the multiplicand set on the same
// soroban as the product, needs about twelve rods, which do not fit a
// phone. So the numbers get a smaller soroban each, on a row of their own.
// They are the problem, not the picture the fade ladder takes away, so they
// are always drawn solid, and nothing on them moves. While the learner steps
// through the answer, the rods of the 九九 on show are highlighted.
//
// A ÷ problem (商除法) sets the dividend on the soroban itself, so its board
// shows only the divisor (spec (division) §3), at the same sizes as the ×
// boards, and points at the divisor digit of the 九九 being taken off.

// Small enough to stay clearly second to the product soroban above.
export const OPERAND_MAX_SCALE = 0.65
// Smaller still on a short window (SHORT_WINDOW_HEIGHT), so a 375 × 667
// phone keeps the prompt above the soroban and 手順を見る below the board
// with the board present.
export const OPERAND_SHORT_WINDOW_SCALE = 0.5
// The × between the boards, with its gap on either side. It is text, so it
// does not scale with the boards.
export const TIMES_WIDTH = 32

function maxScale(windowHeight: number): number {
  return windowHeight < SHORT_WINDOW_HEIGHT ? OPERAND_SHORT_WINDOW_SCALE : OPERAND_MAX_SCALE
}

// The largest scale, up to OPERAND_MAX_SCALE (OPERAND_SHORT_WINDOW_SCALE on
// a window under SHORT_WINDOW_HEIGHT tall), at which both boards and the ×
// between them fit `room`: each board gets half of what the × leaves.
export function operandScale(digits: Digits, room: number, windowHeight: number): number {
  return scaleToFit(digits, (room - TIMES_WIDTH) / 2, maxScale(windowHeight))
}

// The ÷ board's scale: the × boards' limits, so the board under the soroban
// is the same size whichever the operation, but its one board has all of
// `room` to fit in, with no × or second board beside it.
export function divisorScale(digits: Digits, room: number, windowHeight: number): number {
  return scaleToFit(digits, room, maxScale(windowHeight))
}

// `activeGroup` is the group of the move the learner has just stepped to, if
// any. A 九九 names the places of its digits, and the rods count from the
// highest place, so place p is rod digits − 1 − p.
export function OperandBoard({ problem, activeGroup }: { problem: Problem; activeGroup?: StepGroup }) {
  const strings = useStrings()
  const { width, height } = useWindowDimensions()
  // The screen's gutters are space.xl on each side (Screen).
  const room = width - 2 * space.xl
  const last = problem.digits - 1

  if (problem.op === 'div') {
    // Only a 九九 taken off multiplies a divisor digit; placing a quotient
    // digit points at nothing.
    const subtract = activeGroup?.kind === 'subtract' ? activeGroup : undefined
    return (
      <View
        testID="operand-board"
        accessible
        accessibilityLabel={strings.divisorBoardLabel(problem.b)}
        style={styles.board}
      >
        <Operand
          testID="operand-b"
          value={problem.b}
          digits={problem.digits}
          scale={divisorScale(problem.digits, room, height)}
          active={subtract === undefined ? undefined : last - subtract.yPlace}
        />
      </View>
    )
  }

  const scale = operandScale(problem.digits, room, height)
  const g = geometryFor(scale)
  const product = activeGroup?.kind === 'product' ? activeGroup : undefined

  return (
    <View
      testID="operand-board"
      accessible
      accessibilityLabel={strings.operandBoardLabel(problem.a, problem.b)}
      style={styles.board}
    >
      <Operand
        testID="operand-a"
        value={problem.a}
        digits={problem.digits}
        scale={scale}
        active={product === undefined ? undefined : last - product.xPlace}
      />
      {/* As tall as the soroban beside it, so the × sits level with the
          beads rather than with the digits over them. */}
      <View style={[styles.times, { height: g.columnHeight + 2 * g.framePadding }]}>
        {/* Capped like the digits, so at the largest text sizes the ×
            still fits its fixed-width box. */}
        <Text maxFontSizeMultiplier={1.3} style={styles.timesLabel}>
          {OPERATION_SYMBOL.mul}
        </Text>
      </View>
      <Operand
        testID="operand-b"
        value={problem.b}
        digits={problem.digits}
        scale={scale}
        active={product === undefined ? undefined : last - product.yPlace}
      />
    </View>
  )
}

// One number: its digits in a row, each over its rod, then the beads.
// `active` is the rod of the digit the 九九 on show multiplies (or, for ÷,
// the divisor digit whose 九九 is being taken off).
function Operand({
  testID,
  value,
  digits,
  scale,
  active,
}: {
  testID: string
  value: number
  digits: Digits
  scale: number
  active: number | undefined
}) {
  const g = geometryFor(scale)
  const shown = String(value).padStart(digits, '0').split('')
  return (
    <View testID={testID}>
      {/* Each digit is as wide as a rod, and the row is indented by the
          frame's and the deck's padding, as the rods are, so each digit
          sits over its own rod. */}
      <View testID={`${testID}-digits`} style={[styles.digits, { paddingHorizontal: g.framePadding + g.deckPadding }]}>
        {shown.map((digit, index) => (
          <Text
            key={index}
            testID={`${testID}-digit-${index}`}
            maxFontSizeMultiplier={1.3}
            style={[styles.digit, { width: g.rodWidth }, index === active && styles.activeDigit]}
          >
            {digit}
          </Text>
        ))}
      </View>
      <Abacus
        soroban={setValue(emptySoroban(digits), value)}
        fade={0}
        scale={scale}
        highlightRods={active === undefined ? undefined : [active]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: space.sm },
  times: { width: TIMES_WIDTH, alignItems: 'center', justifyContent: 'center' },
  timesLabel: { fontSize: fontSizes.title, color: colors.muted },
  digits: { flexDirection: 'row', marginBottom: 2 },
  digit: {
    textAlign: 'center',
    fontSize: fontSizes.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  activeDigit: { color: colors.accent, fontWeight: '700' },
})
