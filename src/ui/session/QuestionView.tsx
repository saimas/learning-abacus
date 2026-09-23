import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { Exercise } from '@/domain/exercise'
import { answerModeForFade, type Coaching, type FadeLevel } from '@/domain/fade'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus } from '@/ui/abacus/Abacus'
import { beadModeScale } from '@/ui/abacus/geometry'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { Button } from '@/ui/kit/Button'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { Batsu } from './Batsu'
import { Maru } from './Maru'
import { useMoveReplay } from './useMoveReplay'

// latencyMs is null for an untimed attempt (answered with the beads). `t` is
// the moment of the answer, which the runner uses as the next question's
// start and to check its deadline.
export type Submission = { correct: boolean; latencyMs: number | null; t: number }

// A missed question held on screen until つぎへ: only whether its answer card
// is up needs keeping — up at once where coaching still speaks (F0–F1), and
// after こたえを見る at silent levels.
type Review = { cardShown: boolean }

// A tap on つぎへ this soon after a miss is the second half of a double tap
// on こたえる, which sits in the same place. It must not skip a review the
// learner has not seen yet.
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
  renderCorrection,
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
  // The answer card under review. `activeStep` is the step a replay has just
  // played, counted from 0, or undefined before it has played one.
  renderCorrection: (activeStep: number | undefined) => ReactNode
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
  // こたえを見る's step-by-step replay of the move, on the same soroban.
  const replay = useMoveReplay()
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  // When this question was missed, for NEXT_GUARD_MS.
  const missedAt = useRef<number | null>(null)

  const mode = answerModeForFade(fade)
  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn an attempt.
  const moved = readValue(shownBeads) !== exercise.start
  // The screen's gutters are space.xl on each side (Screen).
  const beadScale = beadModeScale(exercise.rods, width - 2 * space.xl)

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
      missedAt.current = t
      AccessibilityInfo.announceForAccessibility(strings.wrong)
      // The number alone teaches nothing. Where coaching still speaks, the
      // card with the substitution comes up with the ✕; at silent levels it
      // waits to be asked for.
      setReview({ cardShown: coaching !== 'silent' })
    }
    onSubmit({ correct, latencyMs, t })
  }

  function showAnswer() {
    AccessibilityInfo.announceForAccessibility(strings.correctionAnswer(exercise.expected))
    setReview({ cardShown: true })
    replay.play(exercise.states)
  }

  function moveOn() {
    const t = now()
    if (missedAt.current !== null && t - missedAt.current < NEXT_GUARD_MS) return
    onMoveOn(t)
  }

  const demonstrationLine =
    demonstration !== null && review === null ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss. Under
      // review the answer card says it instead.
      <Text testID="demonstration" style={styles.demonstration}>
        {demonstration}
      </Text>
    ) : null
  // The step a replay has just played: state k of the exercise's states is
  // the one after step k − 1, and the start (k = 0) has played nothing yet.
  const played = replay.step !== null && replay.step > 0 ? replay.step : null
  const correctionCard =
    review !== null && review.cardShown ? renderCorrection(played === null ? undefined : played - 1) : null
  // The line under the soroban while a miss is reviewed: the replay's step
  // count once a step has played, blank before that. It keeps its height the
  // whole time, so the soroban does not jump as the hint gives way to it or
  // the count appears.
  const replayStep = (
    <Text
      testID={played !== null ? 'replay-step' : undefined}
      accessible={played !== null}
      style={styles.hint}
    >
      {played !== null ? strings.replayStep(played, exercise.states.length - 1) : ' '}
    </Text>
  )
  // A replay takes the soroban over, drawn solid whatever the fade level, so
  // there is something to watch at F3+.
  const replayFade = replay.soroban !== null ? 0 : fade
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
  const reviewButtons = (
    <View style={styles.buttonRow}>
      <View style={styles.reviewSlot}>
        <Button
          testID="review-show"
          variant="outline"
          label={replay.step === null ? strings.showAnswer : strings.watchAgain}
          onPress={showAnswer}
        />
      </View>
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
          {correctionCard}
        </ScrollView>
        <View style={styles.sorobanWrap} testID="soroban-wrap">
          {/* `previous ?? start` relies on `start` staying constant for the
              presented question: the parent keys this view by question, so a
              new question mounts a new view with `beads` back at null. Under
              review the beads stay as the learner left them and take no
              taps: the answer is in. */}
          <Abacus
            soroban={replay.soroban ?? shownBeads}
            fade={replayFade}
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
        {review === null ? <Text style={styles.hint}>{strings.beadHint}</Text> : replayStep}
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
          <Abacus soroban={replay.soroban ?? start} fade={replayFade} />
          {stamp(110)}
        </View>
        {review !== null ? replayStep : null}
        <Text testID="prompt" style={styles.prompt}>
          {prompt}
        </Text>
        {demonstrationLine}
        {correctionCard}
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
          // The answer fits on the soroban: 2 digits for a single move, one
          // more than the operands for a problem.
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
  // こたえを見る and つぎへ share the row equally (mockup).
  reviewSlot: { flex: 1 },
})
