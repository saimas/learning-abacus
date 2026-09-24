import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { stepColouring, type Exercise } from '@/domain/exercise'
import { answerModeForFade, type Coaching, type FadeLevel } from '@/domain/fade'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus, tintsFor } from '@/ui/abacus/Abacus'
import { beadModeScale, scaleToFit, SHORT_WINDOW_BEAD_SCALE, SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { AnswerPad } from '@/ui/answer/AnswerPad'
import { BUTTON_HEIGHT, Button } from '@/ui/kit/Button'
import { parseAnswer } from '@/ui/parseAnswer'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { Batsu } from './Batsu'
import { Maru } from './Maru'
import { ScrollingStepLines, STEP_CONTROLS_HEIGHT, StepControls, StepLines } from './StepPanel'
import { useStepper } from './useStepper'

// latencyMs is null for an untimed attempt (answered with the beads). `t` is
// the moment of the answer, which the runner uses as the next question's
// start and to check its deadline. `assisted` says the learner looked at the
// steps with 手順を見る before answering (spec (core rounds) §5).
export type Submission = { correct: boolean; latencyMs: number | null; t: number; assisted: boolean }

// A missed question held on screen until つぎへ: only whether its step panel
// is open needs keeping — open at once where coaching still speaks (F0–F1),
// and after こたえを見る at silent levels.
type Review = { cardShown: boolean }

// A tap on つぎへ this soon after a miss is the second half of a double tap
// on こたえる, which sits in the same place. It must not skip a review the
// learner has not seen yet. The same goes for こたえを見る: once it opens the
// panel, つぎへ widens into its place. And for とじる before an answer: it
// gives way to the answer controls, with こたえる under it, and a second tap
// must not hand in an answer the learner has not chosen to give.
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
  renderBeneath,
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
  // (where the panel opens) or when not stepping. `showAnswer` says whether
  // the lines give the answer, which they do only once the question has
  // been answered. In bead mode the lines scroll on their own, and the
  // card's highlighted line reports where it sits so it can be scrolled into
  // view (see useActiveLineLayout).
  renderSteps: (options: { activeStep: number | undefined; showAnswer: boolean }) => ReactNode
  // A × problem's operand board, which shows the two numbers that 両落とし
  // leaves off the soroban, following the same `activeStep` as the step
  // lines. Bead mode draws it right under the soroban; keypad mode after the
  // prompt. Nothing for any other question.
  renderBeneath?: (activeStep: number | undefined) => ReactNode
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
  const { width, height } = useWindowDimensions()
  const [answer, setAnswer] = useState('')
  // Non-null while a missed question is held on screen for review.
  const [review, setReview] = useState<Review | null>(null)
  // Whether the learner has the step panel open before answering, from
  // 手順を見る.
  const [stepsOpen, setStepsOpen] = useState(false)
  // Spec (core rounds) §5: an answer given after 手順を見る is "with help".
  // It counts in the tally and stamps the day, but it is not evidence the
  // learner can do the move alone, so it must not move the fade ladder. Once
  // opened, the question stays assisted even after とじる: the learner has
  // seen the way. A ref, since only submit() reads it.
  const assisted = useRef(false)
  // The step panel's walk through the move, one bead move at a time, on the
  // same soroban.
  const stepper = useStepper(exercise.states)
  // The soroban as the learner has moved it in bead mode. null means
  // untouched: it shows the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  // When the last press that つぎへ or こたえる can sit under landed (the
  // miss, こたえを見る, or とじる), for NEXT_GUARD_MS.
  const guardFrom = useRef<number | null>(null)

  const mode = answerModeForFade(fade)
  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer, the same rule as a blank keypad:
  // a stray tap on こたえる must not burn an attempt.
  const moved = readValue(shownBeads) !== exercise.start
  // The screen's gutters are space.xl on each side (Screen).
  const room = width - 2 * space.xl
  const fittedBeadScale = beadModeScale(exercise.rods, room)
  // With a board beneath it, a short phone draws the soroban smaller, so the
  // prompt above it and 手順を見る below keep their room (SHORT_WINDOW_HEIGHT).
  const beadScale =
    renderBeneath !== undefined && height < SHORT_WINDOW_HEIGHT
      ? Math.min(fittedBeadScale, SHORT_WINDOW_BEAD_SCALE)
      : fittedBeadScale
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
    if (guarded(t)) return
    // Bead answers are untimed: speed only counts once the work is mental.
    const latencyMs = mode === 'beads' ? null : Math.max(0, t - shownAt)
    const correct = given === exercise.expected

    if (correct) {
      AccessibilityInfo.announceForAccessibility(strings.correct)
    } else {
      guardFrom.current = t
      // The number alone teaches nothing. Where coaching still speaks, the
      // panel with the substitution comes up with the ✕; at silent levels it
      // waits to be asked for.
      const cardShown = coaching !== 'silent'
      // An open panel starts at the start (see openSteps), whatever was
      // stepped through before the answer. One still to be asked for
      // leaves the learner's own beads under the ✕ until then.
      if (cardShown) {
        stepper.restart()
      } else {
        stepper.clear()
      }
      setReview({ cardShown })
      // At F0–F1 the panel opens on its own, so showAnswer() — the only
      // other place that announces the answer — never runs for this miss.
      // Folding it into this same announcement is the only way VoiceOver
      // ever hears it; a second announceForAccessibility call right after
      // this one would just cut the first off before it finishes.
      AccessibilityInfo.announceForAccessibility(
        cardShown ? `${strings.wrong} ${strings.correctionAnswer(exercise.expected)}` : strings.wrong,
      )
    }
    onSubmit({ correct, latencyMs, t, assisted: assisted.current })
  }

  // Spec (core rounds) §4: the same step panel as after a miss, before the
  // answer and without it, for a learner who wants to see the way first.
  // Wherever the panel opens, here, on a miss, and at こたえを見る, it opens
  // at the start, drawn solid, so the first ▶ plays the first move. The
  // owner (2026-09-24) had to press ▶ twice to kick off the first move when
  // it opened on the learner's own beads, and asked for the steps to be
  // ready as soon as they are shown. Set in the same press that opens the
  // panel, so the controls appear at the start and VoiceOver hears no step.
  function openSteps() {
    assisted.current = true
    stepper.restart()
    setStepsOpen(true)
  }

  // Back to the question as the learner left it: the panel never touched
  // their beads or typed answer, only the stepper, which goes back to not
  // stepping. こたえる comes back under とじる, hence the guard.
  function closeSteps() {
    guardFrom.current = now()
    stepper.clear()
    setStepsOpen(false)
  }

  // Opens the step panel, at the start (see openSteps). Nothing plays by
  // itself: the learner steps through the move with ▶ at their own pace.
  function showAnswer() {
    guardFrom.current = now()
    AccessibilityInfo.announceForAccessibility(strings.correctionAnswer(exercise.expected))
    stepper.restart()
    setReview({ cardShown: true })
  }

  function moveOn() {
    const t = now()
    if (guarded(t)) return
    onMoveOn(t)
  }

  function guarded(t: number): boolean {
    return guardFrom.current !== null && t - guardFrom.current < NEXT_GUARD_MS
  }

  const demonstrationLine =
    demonstration !== null && review === null && !stepsOpen ? (
      // Spec §4: F0 is where the app demonstrates the move, so the
      // substitution is shown *before* the answer, not after a miss. Under
      // review, or with the steps open before answering, the step panel says
      // it instead.
      <Text testID="demonstration" style={styles.demonstration}>
        {demonstration}
      </Text>
    ) : null
  // Offered until the question is answered, and hidden while the panel it
  // opens is up. It stands where the step lines appear once opened: below
  // the soroban in bead mode, after the prompt in keypad mode. The owner
  // (2026-09-24): it sat under the prompt while the steps showed at the
  // bottom of the screen, and should be where they are, to keep it
  // consistent.
  const stepsOpenButton =
    review === null && !stepsOpen ? (
      <Pressable
        testID="steps-open"
        accessibilityRole="button"
        accessibilityLabel={strings.stepsOpen}
        onPress={openSteps}
        style={({ pressed }) => [styles.stepsOpen, pressed && styles.pressed]}
      >
        <Text maxFontSizeMultiplier={1.3} style={styles.stepsOpenLabel}>
          {strings.stepsOpen}
        </Text>
      </Pressable>
    ) : null
  // The move just played: state k is the soroban after k moves, so after
  // stepping to k the highlighted move is k − 1. At the start, or when not
  // stepping, nothing is highlighted.
  const activeStep = stepper.index !== null && stepper.index > 0 ? stepper.index - 1 : undefined
  // The panel is open either after a miss, where it gives the answer and
  // stays until つぎへ, or before an answer, where it keeps the answer back
  // and closes with とじる.
  const reviewing = review !== null && review.cardShown
  const beforeAnswer = review === null && stepsOpen
  const panelOpen = reviewing || beforeAnswer
  // The step panel in its two places: the controls sit in the fixed area
  // just above the bottom buttons, where the thumb is, so ◀ ▶ cannot scroll
  // off a short phone, and in keypad mode the lines scroll with the prompt
  // (bead mode puts them below the controls; see beadStepLines). Before an
  // answer nothing has been got wrong, so the lines carry no correction edge.
  const steps = panelOpen ? renderSteps({ activeStep, showAnswer: reviewing }) : null
  const stepLines = panelOpen ? <StepLines accent={reviewing}>{steps}</StepLines> : null
  const stepControls = panelOpen ? (
    <StepControls
      index={stepper.index}
      total={stepper.total}
      onBack={stepper.back}
      onNext={stepper.next}
      onRestart={stepper.restart}
      onClose={beforeAnswer ? closeSteps : undefined}
    />
  ) : null
  // Stepping takes the soroban over, drawn solid whatever the fade level, so
  // there is something to watch at F3+.
  const shownFade = stepper.soroban !== null ? 0 : fade
  // The owner's request (2026-09-23): when one number takes several moves, as
  // with a carry, it was hard to see which moves belong to one operation. So
  // while stepping, the beads the operation on show (a column, a 九九, or a
  // whole single move) has moved so far are red, the latest step's the
  // deepest. The learner's own beads are never coloured.
  const tintedBeads =
    stepper.soroban !== null
      ? tintsFor(stepColouring(exercise.states, exercise.groupStarts, stepper.index))
      : undefined
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
    // thumb reach. Only the prompt above it and the step panel's lines below
    // the controls scroll, so the soroban, the step controls under it and
    // the buttons stay on screen even on a 375 × 667 phone.
    // The beads take no taps while the question is answered (under review)
    // or while they show the steps before an answer.
    const locked = review !== null || beforeAnswer
    // The owner's request (2026-09-23): the lines used to share the small
    // scroll above the soroban with the prompt, two lines on show at a
    // time, while below ◀ ▶ the screen stood empty. So with the panel open
    // they take that empty space instead, filling it to the bottom and
    // scrolling on their own, with the line stepped to scrolled into view.
    // They take the place of the flexible spacer under the controls, with
    // its flex, so the prompt's scroll above keeps its share of the height
    // and the soroban between the two does not move. Before an answer they
    // take the もどす/こたえる row's place too. The height that row frees
    // would otherwise be shared out and move the soroban down by half a
    // row, so the lines start from that height and grow by the spacer's
    // share on top of it: the soroban stays put, and no empty row is left
    // at the bottom. In a miss's review つぎへ keeps its row below them.
    const beadStepLines = panelOpen ? (
      <View testID="step-lines" style={[styles.stepLines, beforeAnswer && styles.stepLinesOverAnswerRow]}>
        <ScrollingStepLines accent={reviewing}>{steps}</ScrollingStepLines>
      </View>
    ) : null
    return (
      <View style={styles.practice}>
        {track}
        <ScrollView testID="question-scroll" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text testID="prompt" style={styles.prompt}>
            {prompt}
          </Text>
          {demonstrationLine}
        </ScrollView>
        <View style={styles.sorobanWrap} testID="soroban-wrap">
          {/* `previous ?? start` relies on `start` staying constant for the
              presented question: the parent keys this view by question, so a
              new question mounts a new view with `beads` back at null. Under
              review the beads stay as the learner left them and take no
              taps: the answer is in. Stepping through the move draws each
              step over them instead, until the next question, or before an
              answer until とじる, which leaves `beads` as it was. */}
          <Abacus
            soroban={stepper.soroban ?? shownBeads}
            fade={shownFade}
            scale={beadScale}
            tintedBeads={tintedBeads}
            onTapBead={
              locked
                ? undefined
                : (rodIndex, bead) => setBeads((previous) => tapSoroban(previous ?? start, rodIndex, bead))
            }
            onAdjustRod={
              locked
                ? undefined
                : (rodIndex, delta) => setBeads((previous) => adjustRod(previous ?? start, rodIndex, delta))
            }
          />
          {stamp(140)}
        </View>
        {/* Fixed, like the soroban, and outside the stamp's wrap, so the 〇
            or ✕ lands on the soroban alone. */}
        {renderBeneath?.(activeStep)}
        {/* With the panel open the hint gives way to the step controls.
            Until こたえを見る opens the panel at a silent level, an empty
            space of the controls' height holds their place, so the soroban
            moves once, as the ✕ lands, and not again when the controls
            appear. */}
        {panelOpen ? (
          stepControls
        ) : review === null ? (
          <Text style={styles.hint}>{strings.beadHint}</Text>
        ) : (
          <View style={styles.controlsPlace} />
        )}
        {/* Layout A puts a flexible gap on both sides of the soroban+hint
            block (mockup: a flex spacer before it, another after). The
            scroll above already absorbs the top gap; this one balances it
            below so spare height on a tall phone doesn't all pile up above
            the soroban. Both share `scroll`'s flexShrink:1, so on a short
            screen this collapses to 0 first and the scroll area is what
            gives way, keeping the soroban, hint (or step controls) and
            buttons on screen. With the panel open the step lines take its
            place (see beadStepLines). Until then 手順を見る sits at its
            top, where the lines will start. Inside the spacer the button
            counts for nothing in the share-out, so the soroban stays where
            it was when the button sat above it, in the scroll. Most phones
            give the spacer more than the button's height, but a phone
            whose spare height leaves it less (the owner's is 375 × 667)
            must not have the button spill over もどす and こたえる, which
            are drawn after it and would take its taps. So the spacer
            scrolls: there a small scroll reaches the button, and elsewhere
            there is nothing to scroll and it looks as a plain spacer
            would. A minimum height would not do instead: Yoga counts it
            before the share-out, like a flex basis, and the soroban would
            move up by half of it on every phone. */}
        {beadStepLines ?? (
          <ScrollView
            testID="bead-spacer"
            style={styles.beadSpacer}
            contentContainerStyle={styles.beadSpacerContent}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={false}
          >
            {stepsOpenButton}
          </ScrollView>
        )}
        {/* Before an answer, the steps' とじる stands in for もどす and
            こたえる: the learner answers once they have closed the steps.
            The step lines take that row's height meanwhile. */}
        {review !== null ? (
          reviewButtons
        ) : beforeAnswer ? null : (
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
          off a short screen. Under review the review buttons take its place,
          with the step controls above them once the panel is open. With the
          steps open before an answer, the step controls take its place
          alone, and the keypad comes back, with what was typed, at とじる. */}
      <ScrollView testID="question-scroll" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.soroban}>
          <Abacus
            soroban={stepper.soroban ?? start}
            fade={shownFade}
            scale={keypadScale}
            tintedBeads={tintedBeads}
          />
          {stamp(110)}
        </View>
        <Text testID="prompt" style={styles.prompt}>
          {prompt}
        </Text>
        {demonstrationLine}
        {/* After the prompt rather than under the soroban, so it can never
            push the prompt off a short phone, but ahead of the step lines
            (and 手順を見る, which stands where they appear), near the
            soroban it explains. */}
        {renderBeneath?.(activeStep)}
        {stepsOpenButton}
        {stepLines}
      </ScrollView>
      {review !== null ? (
        <>
          {stepControls}
          {reviewButtons}
        </>
      ) : beforeAnswer ? (
        stepControls
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
  // A small outline button, centred: an offer, not the main action, so it
  // stays quieter than こたえる, but still a full 44 pt tap target. In bead
  // mode its gap from the hint is the same as the step lines' from the
  // controls, so it sits where their card will start.
  stepsOpen: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.key,
  },
  stepsOpenLabel: { fontSize: fontSizes.small, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.6 },
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  // StepControls' row sits at the same marginTop.
  controlsPlace: { marginTop: space.sm, height: STEP_CONTROLS_HEIGHT },
  beadSpacer: { flex: 1 },
  // Lets the content fill the spacer, with 手順を見る at its top, as a
  // plain spacer would hold it.
  beadSpacerContent: { flexGrow: 1 },
  // In beadSpacer's place, with the same flex and nothing else: a padding or
  // margin here would count before the share-out and move the soroban (a
  // flex basis is never less than the padding). The gap under the controls
  // is inside, on ScrollingStepLines' scroll.
  stepLines: { flex: 1 },
  // Before an answer the lines start from the もどす/こたえる row's height
  // (buttonRow's marginTop and its buttons' height), so the soroban above
  // does not shift when 手順を見る swaps that row for them and back.
  stepLinesOverAnswerRow: { flexBasis: space.md + BUTTON_HEIGHT },
  buttonRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
  // こたえを見る and つぎへ share the row equally (mockup); つぎへ alone
  // fills it.
  reviewSlot: { flex: 1 },
})
