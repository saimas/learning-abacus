import { useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { answerReading, stepColouring, type Exercise } from '@/domain/exercise'
import type { Coaching, FadeLevel } from '@/domain/fade'
import { adjustRod, emptySoroban, readValue, setValue, tapSoroban, type Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { Abacus, tintsFor } from '@/ui/abacus/Abacus'
import { beadModeScale, SHORT_WINDOW_BEAD_SCALE, SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { BUTTON_HEIGHT, Button } from '@/ui/kit/Button'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'
import { Batsu } from './Batsu'
import { Maru } from './Maru'
import { ScrollingStepLines, STEP_CONTROLS_HEIGHT, StepControls } from './StepPanel'
import { useStepper } from './useStepper'

// latencyMs is null for an untimed attempt (answered with the beads). `t` is
// the moment of the answer, which the runner uses as the next question's
// start and to check its deadline. `assisted` says the learner looked at the
// steps with 手順を見る before answering (spec (core rounds) §5).
export type Submission = { correct: boolean; latencyMs: number | null; t: number; assisted: boolean }

// Outside a round (a lesson's やってみよう, spec (howto tutorial) §2): once
// the question is answered, right or wrong, its bottom row offers leaving,
// or another problem through onMoveOn, in place of もどす/こたえる or つぎへ.
// A round leaves it out: a right answer rolls on by itself, and a miss has
// つぎへ.
export type AfterAnswer = { leaveLabel: string; onLeave: () => void; againLabel: string }

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
  renderSteps,
  renderBeneath,
  renderPrompt,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
  afterAnswer,
  easeFade,
  missNote,
}: {
  exercise: Exercise
  fade: FadeLevel
  coaching: Coaching
  prompt: string
  // The step panel's explanation lines. `activeStep` is the bead move the
  // learner has just stepped to, counted from 0, or undefined at the start
  // (where the panel opens) or when not stepping. `showAnswer` says whether
  // the lines give the answer, which they do only once the question has
  // been answered. The lines scroll on their own, and the card's highlighted
  // line reports where it sits so it can be scrolled into view (see
  // useActiveLineLayout).
  // `given` is what the learner's beads read, for a miss on the beads whose
  // steps have taken those beads over (see `given` below).
  renderSteps: (options: { activeStep: number | undefined; showAnswer: boolean; given?: number }) => ReactNode
  // A × problem's operand board, which shows the two numbers that 両落とし
  // leaves off the soroban, or a ÷ problem's, which shows the divisor,
  // following the same `activeStep` as the step lines, drawn right under
  // the soroban. Nothing for any other question.
  renderBeneath?: (activeStep: number | undefined) => ReactNode
  // Spec (見取算) §4: a problem drawn in place of the text prompt — a 見取算
  // column — following the same `activeStep` as the step lines. `prompt`
  // is not drawn when this is given. Drawn above the soroban, where the text
  // prompt stands for every other question.
  renderPrompt?: (activeStep: number | undefined) => ReactNode
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: (t: number) => void
  afterAnswer?: AfterAnswer
  // Spec (runs) §5: the beads ease to a new level instead of jumping
  // (Abacus), and a run's word on what a miss leaves, said with the ✕.
  easeFade?: boolean
  missNote?: string
}) {
  const strings = useStrings()
  const { width, height } = useWindowDimensions()
  // Non-null while a missed question is held on screen for review.
  const [review, setReview] = useState<Review | null>(null)
  // Spec (roll) §3: a right answer stays on screen under its 〇 until the
  // round rolls on, and takes no second answer meanwhile.
  const [answeredRight, setAnsweredRight] = useState(false)
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
  // The soroban as the learner has moved it. null means untouched: it shows
  // the question's starting value.
  const [beads, setBeads] = useState<Soroban | null>(null)
  // When the last press that つぎへ or こたえる can sit under landed (the
  // miss, こたえを見る, or とじる), for NEXT_GUARD_MS.
  const guardFrom = useRef<number | null>(null)

  const start = setValue(emptySoroban(exercise.rods), exercise.start)
  const shownBeads = beads ?? start
  // An untouched soroban is not an answer: a stray tap on こたえる must not
  // burn an attempt.
  const moved = readValue(shownBeads) !== exercise.start
  // The screen's gutters are space.xl on each side (Screen).
  const room = width - 2 * space.xl
  const fittedBeadScale = beadModeScale(exercise.rods, room)
  // With a board beneath it or a column above it, a short phone draws the
  // soroban smaller, so the prompt above it and 手順を見る below keep their
  // room (SHORT_WINDOW_HEIGHT).
  const beadScale =
    (renderBeneath !== undefined || renderPrompt !== undefined) && height < SHORT_WINDOW_HEIGHT
      ? Math.min(fittedBeadScale, SHORT_WINDOW_BEAD_SCALE)
      : fittedBeadScale
  // What the beads read as an answer, a ÷ from the quotient's ones rod
  // (Exercise.onesPlace).
  const reading = answerReading(exercise, shownBeads)
  const answerLine = strings.correctionAnswer(exercise.expected)

  // Scores the answer. A right one is the parent's to move on from; a miss
  // holds the question here for review until つぎへ.
  function submit() {
    // Untouched beads are not an answer. Scoring them would burn an attempt
    // for a mistap, so nothing happens at all.
    const given = moved ? reading : null
    if (given === null) return
    if (answeredRight) return

    const t = now()
    if (guarded(t)) return
    // Every answer is on the beads (the owner, 2026-09-30), and bead answers
    // are untimed: moving up a level counts accuracy alone.
    const latencyMs = null
    const correct = given === exercise.expected

    // Either way, the moment after an answer takes no つぎへ, もう一問 or
    // おわる: a double tap on こたえる must not skip the 〇 or the review.
    guardFrom.current = t
    if (correct) {
      setAnsweredRight(true)
      AccessibilityInfo.announceForAccessibility(strings.correct)
    } else {
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
      const wrong = missNote === undefined ? strings.wrong : `${strings.wrong} ${missNote}`
      AccessibilityInfo.announceForAccessibility(cardShown ? `${wrong} ${answerLine}` : wrong)
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
  // their beads, only the stepper, which goes back to not
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
    AccessibilityInfo.announceForAccessibility(answerLine)
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

  // Offered until the question is answered, and hidden while the panel it
  // opens is up. It stands where the step lines appear once opened, below
  // the soroban. The owner
  // (2026-09-24): it sat under the prompt while the steps showed at the
  // bottom of the screen, and should be where they are, to keep it
  // consistent.
  const stepsOpenButton =
    review === null && !stepsOpen && !answeredRight ? (
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
  // The owner (2026-09-29): once answered on the beads, the number they read
  // is shown, so a 〇 says which number was right and a ✕ which was not.
  // Under the soroban while the learner's own beads are on show; once the
  // steps take the soroban over, beside the answer in the card instead.
  const answered = review !== null || answeredRight
  const given = reviewing ? reading : undefined
  const afterAnswerRow =
    afterAnswer !== undefined && answered ? (
      <View style={styles.buttonRow}>
        <View style={styles.reviewSlot}>
          <Button
            testID="after-leave"
            variant="outline"
            label={afterAnswer.leaveLabel}
            onPress={() => {
              if (!guarded(now())) afterAnswer.onLeave()
            }}
          />
        </View>
        <View style={styles.reviewSlot}>
          <Button testID="after-again" label={afterAnswer.againLabel} onPress={moveOn} />
        </View>
      </View>
    ) : null
  // The step panel: the controls sit in the slot under the soroban, and the
  // lines below them (see beadStepLines). Before an answer nothing has been
  // got wrong, so the lines carry no correction edge.
  const steps = panelOpen ? renderSteps({ activeStep, showAnswer: reviewing, given }) : null
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
  // The ✕ over a missed question under review, or the 〇 over a right one
  // until the round rolls on. Either is decoration and never takes a tap.
  const stamp = (size: number) => {
    if (!answered) return null
    return (
      <View style={styles.stampOverlay} pointerEvents="none">
        {review !== null ? <Batsu size={size} /> : <Maru size={size} lasting />}
      </View>
    )
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

  const promptView =
    renderPrompt === undefined ? (
      <Text testID="prompt" style={styles.prompt}>
        {prompt}
      </Text>
    ) : (
      renderPrompt(activeStep)
    )

  // Layout A: the soroban takes the place a keypad would, enlarged and within
  // thumb reach, at every level (the owner, 2026-09-30: the fingers keep
  // moving the beads however faded they are). Only the prompt above it and
  // the step panel's lines below the controls scroll, so the soroban, the
  // step controls under it and the buttons stay on screen even on a
  // 375 × 667 phone.
  // The beads take no taps while the question is answered (under review)
  // or while they show the steps before an answer.
  const locked = review !== null || beforeAnswer || answeredRight
  // The owner's request (2026-09-23): the lines used to share the small
  // scroll above the soroban with the prompt, two lines on show at a
  // time, while below ◀ ▶ the screen stood empty. So with the panel open
  // they take that empty space instead, in the flexible spacer's place
  // under the controls, filling it to the bottom and scrolling on their
  // own, with the line stepped to scrolled into view. Before an answer
  // they take the もどす/こたえる row's place too; in a miss's review
  // つぎへ keeps its row below them.
  // The owner again (2026-09-24, on a 375 × 667 phone): the prompt's
  // scroll above kept a share of the height, so it stood mostly empty
  // between the prompt and the soroban while the lines were cut off at
  // the bottom. So that scroll is only as tall as the prompt
  // (scrollFitted), and the lines take all the height that is left. It
  // is fitted with the panel closed too, before an answer and in review:
  // the owner found the soroban jumping up as the panel opened and back
  // down as it closed distracting, and asked for it to start where the
  // open panel puts it. So the soroban and the board always sit right
  // under the prompt, and opening or closing the panel moves neither;
  // only the space below the controls changes hands (see the spacer).
  const beadStepLines = panelOpen ? (
    <View testID="step-lines" style={[styles.bottomRegion, beforeAnswer && styles.stepLinesOverAnswerRow]}>
      <ScrollingStepLines accent={reviewing}>{steps}</ScrollingStepLines>
    </View>
  ) : null
  return (
    <View style={styles.practice}>
      <ScrollView testID="question-scroll" style={styles.scrollFitted} contentContainerStyle={styles.scrollContent}>
        {promptView}
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
          easeFade={easeFade}
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
      {/* With the panel open the hint gives way to the step controls,
          and once answered to what the beads read (see `given`). All
          three share one slot of the controls' height, so the swap moves
          nothing below it either: the owner (2026-09-24) found the jump
          from the one-line hint to the taller ◀ ▶ row distracting. */}
      <View testID="step-controls-slot" style={styles.controlsSlot}>
        {panelOpen ? (
          stepControls
        ) : answered ? (
          <Text
            testID="bead-reading"
            accessibilityLabel={strings.beadReadingLabel(reading)}
            maxFontSizeMultiplier={1.3}
            style={styles.reading}
          >
            {String(reading)}
          </Text>
        ) : (
          <Text style={styles.hint}>{strings.beadHint}</Text>
        )}
      </View>
      {/* The flexible space under the soroban, the board and the controls'
          slot. The prompt's scroll above is only as tall as the prompt,
          so all the spare height comes here, and nothing above depends on
          what this holds, which is what keeps the soroban still as the
          panel opens and closes (see beadStepLines). With the panel open
          the step lines take its place. Until then 手順を見る sits at its
          top, where the lines will start. It never gets less than the
          button's room (bottomRegion), even where a large text size makes
          the prompt taller than the height to spare: the prompt's scroll
          is what gives way, and scrolls, so the button can always be
          reached, and the soroban, the slot and the buttons stay on
          screen. The space scrolls as well, so should the button ever
          outgrow that room, a small scroll reaches it rather than it
          spilling over もどす and こたえる, which are drawn after it and
          would take its taps. Elsewhere there is nothing to scroll and it
          looks as a plain spacer would. */}
      {beadStepLines ?? (
        <ScrollView
          testID="bead-spacer"
          style={styles.bottomRegion}
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
      {afterAnswerRow ?? (review !== null ? (
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
      ))}
    </View>
  )
}

// 手順を見る's height, a full 44 pt tap target, and the room it takes in
// bead mode with its marginTop: the least the space under the soroban
// keeps (bottomRegion).
const STEPS_OPEN_HEIGHT = 44
const BOTTOM_ROOM = space.sm + STEPS_OPEN_HEIGHT

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
  scroll: { flex: 1 },
  // Bead mode's top scroll, open or closed: only as tall as the prompt it
  // holds, so the soroban sits just under it (sorobanWrap's marginTop keeps
  // them apart) and the space below, or the lines, get the rest
  // (beadStepLines). flexGrow 0 overrides ScrollView's own flexGrow 1, and
  // flexShrink 1 lets it give way, and scroll, on a screen too short for
  // everything. No `flex`: Yoga reads a positive flex as a flex basis of 0,
  // which would squash the prompt to nothing.
  scrollFitted: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingBottom: space.sm },
  sorobanWrap: { alignSelf: 'center', marginTop: space.sm, position: 'relative' },
  // Centred over the soroban's wrap (sorobanWrap), which must itself be
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
  // stays quieter than こたえる, but still a full 44 pt tap target. Its gap
  // from the hint's slot is the same as the step lines' from
  // the controls, which fill that slot, so it sits where their card will
  // start.
  stepsOpen: {
    alignSelf: 'center',
    minHeight: STEPS_OPEN_HEIGHT,
    justifyContent: 'center',
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.key,
  },
  stepsOpenLabel: { fontSize: fontSizes.small, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.6 },
  // Centred in controlsSlot. Its marginTop is the controls' own, so it sits
  // level with ◀ ▶ in the row below the gap they share.
  hint: { textAlign: 'center', marginTop: space.sm, fontSize: fontSizes.caption, color: colors.muted },
  // What the answered beads read, in the hint's place and the prompt's type,
  // within the slot's height.
  reading: { textAlign: 'center', fontFamily: fonts.display, fontSize: fontSizes.prompt, color: colors.ink },
  // As tall as StepControls' row on one line, with its marginTop. A
  // minimum, not a height: at the largest text sizes on a narrow phone the
  // row wraps to a second line, and must grow the slot rather than spill
  // over the lines below, which would take its taps. The soroban above
  // stays put, unless the prompt's scroll is already giving way at that
  // text size, when it gives way by the second line too. At about AX4 and
  // up, the Button's label and the step count (neither capped) can outgrow
  // their rows as well, so the soroban can shift a few pt there, while the
  // prompt is already scrolling.
  controlsSlot: { minHeight: space.sm + STEP_CONTROLS_HEIGHT, justifyContent: 'center' },
  // The space under the controls' slot in bead mode, holding 手順を見る
  // (`bead-spacer`) or, with the panel open, the step lines (`step-lines`).
  // Either takes all the height left over, and never less than the button's
  // room, its marginTop and its height, so the button can be reached at any
  // text size, and the lines keep a line or two on show: the prompt's
  // scroll gives way first (the controller's ruling, 2026-09-24). No
  // shrink: a ScrollView's own style shrinks, and the spacer shrinking
  // with the prompt's scroll where the lines do not would move the soroban
  // as the panel opens on a screen too short for everything. The lines'
  // gap under the controls is inside, on ScrollingStepLines' scroll.
  bottomRegion: { flexGrow: 1, flexShrink: 0, flexBasis: BOTTOM_ROOM },
  // Lets the content fill the spacer, with 手順を見る at its top, as a
  // plain spacer would hold it.
  beadSpacerContent: { flexGrow: 1 },
  // Before an answer the lines also take the もどす/こたえる row's place
  // (buttonRow's marginTop and its buttons' height), so they start from
  // that too. Where there is room it changes nothing, as they take the rest
  // anyway. On a screen too short for everything it is the least they
  // keep, and the column asks for the same height open as closed, so the
  // prompt's scroll gives way by the same amount and the soroban does not
  // move there either.
  stepLinesOverAnswerRow: { flexBasis: BOTTOM_ROOM + space.md + BUTTON_HEIGHT },
  buttonRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  resetSlot: { flex: 1 },
  submitSlot: { flex: 2 },
  // こたえを見る and つぎへ share the row equally (mockup); つぎへ alone
  // fills it.
  reviewSlot: { flex: 1 },
})
