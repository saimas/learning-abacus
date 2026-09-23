import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { Exercise } from '@/domain/exercise'
import { answerModeForFade, type Coaching, type FadeLevel } from '@/domain/fade'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { beadModeScale, scaleToFit } from '@/ui/abacus/geometry'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { Button } from '@/ui/kit/Button'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { Batsu } from './Batsu'
import { Maru } from './Maru'
import { StepPanel } from './StepPanel'
import { useStepper } from './useStepper'

// latencyMs is null for an untimed attempt (answered with the beads). `t` is
// the moment of the answer, which the runner uses as the next question's
// start and to check its deadline.
export type Submission = { correct: boolean; latencyMs: number | null; t: number }

// A missed question held on screen until つぎへ: only whether its step panel
// is open needs keeping — open at once where coaching still speaks (F0–F1),
// and after こたえを見る at silent levels.
type Review = { cardShown: boolean }

// A tap on つぎへ this soon after a miss is the second half of a double tap
// on こたえる, which sits in the same place. It must not skip a review the
// learner has not seen yet. The same goes for こたえを見る: once it opens the
// panel, つぎへ widens into its place.
const NEXT_GUARD_MS = 450

// One question, from the prompt to the answer and, after a miss, its review.
// The parent keys it by question, so a new question starts with a clean
// field, untouched beads and no review. The parent decides what the answer
// means for the session (onSubmit) and when to move on (onMoveOn, after a
// miss's review).
export function QuestionView({
  exercise,
  fade,
  coaching,
  prompt,
  demonstration,
  renderSteps,
  track,
  maru,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
}: {
  exercise: Exercise
  fade: FadeLevel
  coaching: Coaching
  prompt: string
  // Said before the answer at F0 (spec §4). Null where there is nothing to
  // demonstrate, as for a whole problem.
  demonstration: string | null
  // The step panel's explanation lines. `activeStep` is the bead move the
  // learner has just stepped to, counted from 0, or undefined at the start
  // or before the first step. `showAnswer` says whether the lines give the
  // answer, which they do only once the question has been answered.
  renderSteps: (options: { activeStep: number | undefined; showAnswer: boolean }) => ReactNode
  track: ReactNode
  // Counts correct answers, so each one remounts the 〇 and replays its fade.
  // 0 means the last answer was wrong, or there has not been one.
  maru: number
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: (t: number) => void
}) {
  const strings = useStrings()
  const { width } = useWindowDimensions()
  const [answer, setAnswer] = useState('')
  // Non-null while a missed question is held on screen for review.
  const [review, setReview] = useState<Review | null>(null)
  // The step panel's walk through the move, one bead move at a time, on the
  // same soroban.
  const stepper = useStepper(exercise.states)
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  // When the last press that つぎへ can sit under landed (the miss, or
  // こたえを見る), for NEXT_GUARD_MS.
  const guardFrom = useRef<number | null>(null)

  const mode = answerModeForFade(fade)
  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn an attempt.
  const moved = readValue(shownBeads) !== exercise.start
  // The screen's gutters are space.xl on each side (Screen).
  const room = width - 2 * space.xl
  const beadScale = beadModeScale(exercise.rods, room)
  // Keypad mode draws the soroban at scale 1, but a 3×3 product's six rods
  // (416 pt) are wider than a 375 pt phone, so it has to shrink to fit too.
  const keypadScale = scaleToFit(exercise.rods, room, 1)

  // Scores the answer. A right one is the parent's to move on from; a miss
  // holds the question here for review until つぎへ.
  function submit() {
    // A blank or unparseable field is not an answer. Scoring it would mark
    // every n−n atom correct, and scoring it wrong would burn an attempt for
    // a mistap, so nothing happens at all.
    const given = mode === 'beads' ? (moved ? readValue(shownBeads) : null) : parseAnswer(answer)
    if (given === null) return

    const t = now()
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt)
    const correct = given === exercise.expected

    if (correct) {
      AccessibilityInfo.announceForAccessibility(strings.correct)
    } else {
      guardFrom.current = t
      AccessibilityInfo.announceForAccessibility(strings.wrong)
      // The number alone teaches nothing. Where coaching still speaks, the
      // panel with the substitution comes up with the ✕; at silent levels it
      // waits to be asked for.
      setReview({ cardShown: coaching !== 'silent' })
    }
    onSubmit({ correct, latencyMs, t })
  }

  // Opens the step panel. Nothing plays by itself: the learner steps
  // through the move with ▶ at their own pace.
  function showAnswer() {
    guardFrom.current = now()
    AccessibilityInfo.announceForAccessibility(strings.correctionAnswer(exercise.expected))
    setReview({ cardShown: true })
  }

  function moveOn() {
    const t = now()
    if (guardFrom.current !== null && t - guardFrom.current < NEXT_GUARD_MS) return
    onMoveOn(t)
  }

  const demonstrationLine =
    demonstration !== null && review === null ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss. Under
      // review the step panel says it instead.
      <Text testID="demonstration" style={styles.demonstration}>
        {demonstration}
      </Text>
    ) : null
  // The move just played: state k is the soroban after k moves, so after
  // stepping to k the highlighted move is k − 1. At the start or before the
  // first step nothing is highlighted.
  const activeStep = stepper.index !== null && stepper.index > 0 ? stepper.index - 1 : undefined
  const reviewPanel =
    review !== null && review.cardShown ? (
      <StepPanel
        lines={renderSteps({ activeStep, showAnswer: true })}
        index={stepper.index}
        total={stepper.total}
        onBack={stepper.back}
        onNext={stepper.next}
        onRestart={stepper.restart}
      />
    ) : null
  // Stepping takes the soroban over, drawn solid whatever the fade level, so
  // there is something to watch at F3+.
  const shownFade = stepper.soroban !== null ? 0 : fade
  // The 〇 over the next question after a right answer, or the ✕ over a
  // missed one under review. Either is decoration and never takes a tap.
  const stamp = (size: number) => {
    if (review !== null) {
      return (
        <View style={styles.stampOverlay} pointerEvents="none">
          <Batsu size={size} />
        </View>
      )
    }
    if (maru > 0) {
      return (
        <View style={styles.stampOverlay} pointerEvents="none">
          <Maru key={maru} size={size} />
        </View>
      )
    }
    return null
  }
  // こたえを見る only until the panel is open: from then on the panel's own
  // controls show the move again, and つぎへ takes the whole row.
  const reviewButtons = (
    <View style={styles.buttonRow}>
      {review !== null && !review.cardShown ? (
        <View style={styles.reviewSlot}>
          <Button testID="review-show" variant="outline" label={strings.showAnswer} onPress={showAnswer} />
        </View>
      ) : null}
      <View style={styles.reviewSlot}>
        <Button testID="review-next" label={strings.next} onPress={moveOn} />
      </View>
    </View>
  )

  if (mode === 'beads') {
    // Layout A: the soroban takes the keypad's place, enlarged and within
    // thumb reach. Only the text above it scrolls, so the soroban and both
    // buttons stay on screen even on a 375 × 667 phone.
    return (
      <View style={styles.practice}>
        {track}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text testID="prompt" style={styles.prompt}>
            {prompt}
          </Text>
          {demonstrationLine}
          {reviewPanel}
        </ScrollView>
        <View style={styles.sorobanWrap} testID="soroban-wrap">
          {/* `previous ?? start` relies on `start` staying constant for the
              presented question: the parent keys this view by question, so a
              new question mounts a new view with `beads` back at null. Under
              review the beads stay as the learner left them and take no
              taps: the answer is in. Stepping through the move draws each
              step over them instead, until the next question. */}
          <Abacus
            soroban={stepper.soroban ?? shownBeads}
            fade={shownFade}
            scale={beadScale}
            onTapBead={
              review !== null
                ? undefined
                : (rodIndex, bead) => setBeads((previous) => tapSoroban(previous ?? start, rodIndex, bead))
            }
            onAdjustRod={
              review !== null
                ? undefined
                : (rodIndex, delta) => setBeads((previous) => adjustRod(previous ?? start, rodIndex, delta))
            }
          />
          {stamp(140)}
        </View>
        {/* Under review the hint gives way to a blank line of the same
            height, so the soroban does not jump; the step count is in the
            panel. */}
        {review === null ? (
          <Text style={styles.hint}>{strings.beadHint}</Text>
        ) : (
          <Text accessible={false} style={styles.hint}>
            {' '}
          </Text>
        )}
        {/* Layout A puts a flexible gap on both sides of the soroban+hint
            block (mockup: a flex spacer before it, another after). The
            scroll above already absorbs the top gap; this one balances it
            below so spare height on a tall phone doesn't all pile up above
            the soroban. Both share `scroll`'s flexShrink:1, so on a short
            screen this collapses to 0 first and the scroll area is what
            gives way, keeping the soroban, hint and buttons on screen. */}
        <View style={styles.beadSpacer} />
        {review !== null ? (
          reviewButtons
        ) : (
          <View style={styles.buttonRow}>
            <View style={styles.resetSlot}>
              <Button
                testID="reset-beads"
                variant="outline"
                label={strings.resetBeads}
                onPress={() => setBeads(null)}
              />
            </View>
            <View style={styles.submitSlot}>
              <Button testID="submit" label={strings.answer} disabled={!moved} onPress={submit} />
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={styles.practice}>
      {track}
      {/* R9: the keypad below is always fully visible, pinned at the bottom.
          Everything here that can grow scrolls instead of pushing the keypad
          off a short screen. Under review the review buttons take its place. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.soroban}>
          <Abacus soroban={stepper.soroban ?? start} fade={shownFade} scale={keypadScale} />
          {stamp(110)}
        </View>
        <Text testID="prompt" style={styles.prompt}>
          {prompt}
        </Text>
        {demonstrationLine}
        {reviewPanel}
      </ScrollView>
      {review !== null ? (
        reviewButtons
      ) : (
        <AnswerPad
          value={answer}
          onChange={setAnswer}
          onSubmit={submit}
          submitLabel={strings.answer}
          submitTestID="submit"
          // The answer always fits the soroban's rods: 2 for a single move,
          // the operands' digit count + 1 for ＋ −, and that count × 2 for ×.
          maxDigits={exercise.rods}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
  soroban: { marginTop: space.md, position: 'relative' },
  prompt: {
    marginTop: space.lg,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.prompt,
    color: colors.ink,
    letterSpacing: 1,
  },
  demonstration: {
    alignSelf: 'center',
    marginTop: space.sm,
    paddingVertical: 7,
    paddingHorizontal: space.md,
    borderRadius: radius.panel,
    overflow: 'hidden',
    backgroundColor: colors.soft,
    color: colors.muted,
    fontSize: fontSizes.small,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: space.sm },
  sorobanWrap: { alignSelf: 'center', marginTop: space.sm, position: 'relative' },
  // Centred over whichever soroban it is placed inside (bead mode's
  // sorobanWrap, or keypad mode's soroban view) — that view must itself be
  // position:'relative' for this to fill and centre over it.
  stampOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  beadSpacer: { flex: 1 },
  buttonRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
  // こたえを見る and つぎへ share the row equally (mockup); つぎへ alone
  // fills it.
  reviewSlot: { flex: 1 },
})
