import { useEffect, useRef, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Card } from '@/ui/kit/Card'
import { colors, fontSizes, radius, space } from '@/ui/theme'
import { ActiveLayoutContext } from './useActiveLineLayout'

// Spec (core rounds) §3: one step panel explains a move wherever the app
// explains one, after a miss and before an answer. It comes in two
// parts because they live in different places on the question screen. The
// controls stay pinned in the fixed area just above the bottom buttons,
// where the thumb is, so ◀ ▶ can never scroll off a short phone. In keypad
// mode the lines scroll with the prompt above the soroban. In bead mode
// they fill the space below the controls and scroll there on their own
// (ScrollingStepLines), since above the soroban they only had room for two
// lines while the screen below ◀ ▶ stood empty (the owner, 2026-09-23).

// The explanation lines the caller draws, with the move on show
// highlighted. `accent` is the correction edge, right after a miss; before
// an answer nothing has been got wrong, so the caller turns it off. `fill`
// grows the card to fill the space it is given, top to bottom, rather than
// sitting below the text before it.
export function StepLines({
  children,
  accent = true,
  fill = false,
}: {
  children: ReactNode
  accent?: boolean
  fill?: boolean
}) {
  return (
    <Card accent={accent} testID="step-panel" style={fill ? styles.fillCard : styles.card}>
      {children}
    </Card>
  )
}

// Bead mode's lines, below the controls: the card fills the space it is
// given and scrolls within it, so a 3×3 product's long list still reads to
// the end. Each time the highlight moves, the card's line stepped to reports
// where it sits (useActiveLineLayout), and the lines scroll just far enough
// to show it. They stay still while it is already on show, so stepping never
// jolts what the learner is reading.
export function ScrollingStepLines({ accent, children }: { accent: boolean; children: ReactNode }) {
  const scroll = useRef<ScrollView>(null)
  // The stretch of the lines on show: from `top`, `height` tall. 0 tall
  // until the scroll is laid out, when there is nothing to scroll yet.
  const shown = useRef({ top: 0, height: 0 })
  // Where the card's lines start in the scroll, below its edge and padding.
  // The card itself sits at the very top of the scroll (fillCard has no
  // margin), so this is all that comes before them.
  const linesTop = useRef(0)

  function reveal(y: number, height: number) {
    const view = shown.current
    if (view.height === 0) return
    const top = linesTop.current + y
    const bottom = top + height
    let to: number
    if (top < view.top) {
      to = top
    } else if (bottom > view.top + view.height) {
      // Its bottom at the bottom of the space, unless it is taller than the
      // space: then its start.
      to = Math.min(top, bottom - view.height)
    } else {
      return
    }
    scroll.current?.scrollTo({ y: to, animated: true })
    // Counted as there at once: a second step before the scroll has landed
    // and reported back must be measured from where it is going.
    view.top = to
  }

  return (
    <ScrollView
      testID="step-lines-scroll"
      ref={scroll}
      style={styles.linesScroll}
      contentContainerStyle={styles.linesContent}
      onLayout={(event) => {
        shown.current.height = event.nativeEvent.layout.height
      }}
      onScroll={(event) => {
        shown.current.top = event.nativeEvent.contentOffset.y
      }}
      scrollEventThrottle={16}
    >
      <StepLines accent={accent} fill>
        <View
          testID="step-lines-content"
          onLayout={(event) => {
            linesTop.current = event.nativeEvent.layout.y
          }}
        >
          <ActiveLayoutContext.Provider value={reveal}>{children}</ActiveLayoutContext.Provider>
        </View>
      </StepLines>
    </ScrollView>
  )
}

// The learner steps through the move with these: ▶ plays the next bead move,
// ◀ undoes the last, 最初から goes back to the start. The caller opens them
// at the start, so the first ▶ plays the first move. Nothing plays by
// itself, so the learner sets the pace and can look again at any move.
// とじる is offered only where there is something to go back to, which the
// caller says by passing onClose.
export function StepControls({
  index,
  total,
  onBack,
  onNext,
  onRestart,
  onClose,
}: {
  // The state on show, as useStepper counts it: null when not stepping.
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
      {/* Blank rather than absent when not stepping, and at a fixed
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
// variation selector keeps iOS from drawing them as emoji. Exported with
// StepButton for the division walkthrough, whose ◀ ▶ step the same way.
export const BACK_GLYPH = '◀︎'
export const NEXT_GLYPH = '▶︎'

export function StepButton({
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
  // No margin: ScrollingStepLines counts on the card starting at the top of
  // its scroll.
  fillCard: { flexGrow: 1, paddingVertical: space.sm },
  // Clear of the controls it sits under.
  linesScroll: { flex: 1, marginTop: space.sm },
  // Lets a card shorter than the space still grow to fill it.
  linesContent: { flexGrow: 1 },
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
