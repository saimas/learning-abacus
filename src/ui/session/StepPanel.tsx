import { useEffect, useRef, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fontSizes, radius, space } from '@/ui/theme'

// Spec (core rounds) §3: one step panel explains a move wherever the app
// explains one, after a miss and before an answer. It comes in two
// parts because they live in different places on the question screen. The
// lines scroll with the prompt above the soroban. The controls stay pinned
// in the fixed area just above the bottom buttons, where the thumb is, so
// ◀ ▶ can never scroll off a short phone.

// The explanation lines the caller draws, with the move on show
// highlighted. `accent` is the correction edge, right after a miss; before
// an answer nothing has been got wrong, so the caller turns it off.
export function StepLines({ children, accent = true }: { children: ReactNode; accent?: boolean }) {
  return (
    <Card accent={accent} testID="step-panel" style={styles.card}>
      {children}
    </Card>
  )
}

// The learner steps through the move with these: ▶ plays the next bead move
// (the first ▶ shows the start), ◀ undoes the last, 最初から goes back to
// the start. Nothing plays by itself, so the learner sets the pace and can
// look again at any move. とじる is offered only where there is something to
// go back to, which the caller says by passing onClose.
export function StepControls({
  index,
  total,
  onBack,
  onNext,
  onRestart,
  onClose,
}: {
  // The state on show, as useStepper counts it: null before the first step.
  index: number | null
  total: number
  onBack: () => void
  onNext: () => void
  onRestart: () => void
  onClose?: () => void
}) {
  const strings = useStrings()
  // The beads' slide is silent to VoiceOver, so each change of step is read
  // out as its count. Only a change is: the controls appearing is not a step.
  const announced = useRef(index)
  useEffect(() => {
    if (index === announced.current) return
    announced.current = index
    if (index !== null) AccessibilityInfo.announceForAccessibility(strings.replayStep(index, total))
  }, [index, total, strings])

  return (
    <View style={styles.controls}>
      <StepButton
        testID="step-back"
        glyph={BACK_GLYPH}
        label={strings.stepBack}
        disabled={index === null || index === 0}
        onPress={onBack}
      />
      {/* Blank rather than absent before the first step, and at a fixed
          width, so the ▶ beside it does not move under the learner's thumb
          as the count appears or gains a digit. */}
      <Text testID="step-count" accessible={index !== null} style={styles.count}>
        {index === null ? ' ' : strings.replayStep(index, total)}
      </Text>
      <StepButton
        testID="step-next"
        glyph={NEXT_GLYPH}
        label={strings.stepNext}
        disabled={index === total}
        onPress={onNext}
      />
      <View style={styles.spacer} />
      <TextButton testID="step-restart" label={strings.stepRestart} onPress={onRestart} />
      {onClose !== undefined ? <TextButton testID="steps-close" label={strings.stepsClose} onPress={onClose} /> : null}
    </View>
  )
}

// The icon set has no forward chevron, so the arrows are type. The text
// variation selector keeps iOS from drawing them as emoji.
const BACK_GLYPH = '◀︎'
const NEXT_GLYPH = '▶︎'

function StepButton({
  testID,
  glyph,
  label,
  disabled,
  onPress,
}: {
  testID: string
  glyph: string
  label: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  )
}

function TextButton({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
    >
      <Text maxFontSizeMultiplier={1.3} style={styles.textLabel}>
        {label}
      </Text>
    </Pressable>
  )
}

// Every control is at least 44 pt tall, the platforms' minimum tap target.
const TAP = 44

// The height StepControls' row takes on one line, for a caller that holds its
// place before the controls appear so nothing moves when they do.
export const STEP_CONTROLS_HEIGHT = TAP

const styles = StyleSheet.create({
  card: { marginTop: space.md, paddingVertical: space.sm },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    // A long label in a narrow window wraps to a second line rather than
    // pushing a control off the screen.
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.sm,
  },
  step: {
    width: TAP,
    height: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.key,
  },
  glyph: { fontSize: fontSizes.body, color: colors.accent },
  // Wide enough for "40 / 40" in tabular figures. The longest problem, a 3×3
  // product, runs to about forty bead moves, so the count stays two digits.
  count: {
    minWidth: 60,
    textAlign: 'center',
    fontSize: fontSizes.body,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  spacer: { flex: 1 },
  textButton: { minHeight: TAP, justifyContent: 'center', paddingHorizontal: space.sm },
  textLabel: { fontSize: fontSizes.small, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
})
