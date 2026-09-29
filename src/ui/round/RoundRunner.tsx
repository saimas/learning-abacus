import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { answerModeForFade, coachingForFade, type FadeLevel } from '@/domain/fade'
import type { PracticeAttempt } from '@/domain/practice'
import {
  groupOfStep,
  practiceId,
  problemSteps,
  problemTargetMs,
  type PracticeKind,
  type Problem,
} from '@/domain/problem'
import { useStrings } from '@/i18n'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { QuestionView, type Submission } from '@/ui/session/QuestionView'
import { SessionSummary } from '@/ui/session/SessionSummary'
import { colors } from '@/ui/theme'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'
import { RoundTrack } from './RoundTrack'

// Spec (roll) §3: a right answer's 〇 is held on the answered problem for
// ROLL_HOLD_MS; then it moves on, so the change of problem is seen (the
// owner, 2026-09-28: "i didnt notice the problem moved to next … it rolled
// even before i see red circle"). It moves on as a stack of cards: the next
// problem is laid in its place underneath, still, and the answered card is
// swiped off to the left over it in ROLL_SWIPE_MS. The eye has nothing to
// chase and no blank to wait through (2026-09-29: sliding "makes human eye to
// chase it"; fading "is still distracting").
export const ROLL_HOLD_MS = 700
export const ROLL_SWIPE_MS = 300

// Spec (multi-digit ＋ −) §6: a round is its problems in order, each once. A
// miss is reviewed and the round moves on; it does not come back, since a
// fresh problem of the same kind teaches as much. The fade is the kind's
// level when the round began and holds for the whole round, as a session
// plan holds its items' levels.
export function RoundRunner({
  kind,
  problems,
  fade,
  calibrationMs,
  onAttempt,
  onFinish,
  onQuit,
  now = Date.now,
}: {
  kind: PracticeKind
  problems: Problem[]
  fade: FadeLevel
  calibrationMs: number
  onAttempt: (attempt: PracticeAttempt) => void
  onFinish: () => void
  onQuit?: () => void
  now?: () => number
}) {
  const strings = useStrings()
  const [index, setIndex] = useState(0)
  // When the problem on screen was shown, for its latency. The first is shown
  // when the round mounts.
  const [shownAt, setShownAt] = useState(() => now())
  const [tally, setTally] = useState({ answered: 0, correct: 0 })
  const finished = useRef(false)
  const { width } = useWindowDimensions()
  // While a roll is pending or running: a blocker over the cards takes their
  // taps, so nothing is answered or stepped mid-roll.
  const [rolling, setRolling] = useState(false)
  // The answered problem whose card is being swiped off, over `index`'s.
  const [leaving, setLeaving] = useState<number | null>(null)
  const [offset] = useState(() => new Animated.Value(0))
  const [opacity] = useState(() => new Animated.Value(1))
  // Spec (roll) §3: with Reduce Motion on, the answered card fades away in
  // place instead.
  const reduceMotion = useRef(false)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The last problem rolled on from: each rolls on once.
  const rolledFrom = useRef(-1)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on
    })
    // Leaving mid-roll: nothing may fire into the unmounted round.
    return () => {
      if (hold.current !== null) clearTimeout(hold.current)
      offset.stopAnimation()
      opacity.stopAnimation()
    }
  }, [offset, opacity])

  // Rolls on from problem `from`: the next card (or the summary, past the
  // last) is laid underneath, and the answered one, back in its place, stays
  // on top. Only once: a second つぎへ can land before the blocker is drawn
  // and reach here after the swipe has started, and resetting the card then
  // would stop the swipe with nothing to start it again.
  function roll(from: number) {
    if (from <= rolledFrom.current) return
    rolledFrom.current = from
    setRolling(true)
    offset.setValue(0)
    opacity.setValue(1)
    setLeaving(from)
    setIndex(from + 1)
  }

  // The swipe starts once the next card is underneath: started with the
  // swap, it would uncover nothing for a frame or two. The next problem's
  // clock starts once it is uncovered (spec (roll) §3). Both run on the
  // native driver, so the next card mounting cannot make the swipe stutter.
  const swiped = useEffectEvent(() => {
    setLeaving(null)
    setShownAt(now())
    setRolling(false)
  })
  useEffect(() => {
    if (leaving === null) return
    const config = { duration: ROLL_SWIPE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }
    const away = reduceMotion.current
      ? Animated.timing(opacity, { ...config, toValue: 0 })
      : Animated.timing(offset, { ...config, toValue: -width })
    away.start(({ finished: gone }) => {
      if (gone) swiped()
    })
  }, [leaving, offset, opacity, width])

  const blocker = rolling ? <View testID="roll-blocker" style={StyleSheet.absoluteFill} /> : null

  function finish() {
    if (finished.current) return
    finished.current = true
    onFinish()
  }

  // Problem `at`'s card, or past the last, the summary.
  function card(at: number) {
    const problem = problems[at]
    if (problem === undefined) {
      return (
        <SessionSummary
          title={strings.roundComplete}
          answered={tally.answered}
          correct={tally.correct}
          onDone={finish}
        />
      )
    }
    return question(at, problem)
  }

  function question(at: number, problem: Problem) {
    const exercise = exerciseForProblem(problem)
    // QuestionView decides bead vs. keypad from the same fade this round holds
    // throughout (see its own `mode`). The review card needs it too: a ÷
    // miss's beads were checked against expectedBeads (the final soroban
    // reading), so only in bead mode does its answer line say more than the
    // quotient.
    const mode = answerModeForFade(fade)
    const groups = problemSteps(problem)
    // The group of the move the learner has stepped to, if any: an index into
    // `groups` for the answer card's lines, and the group itself for the
    // operand (or divisor) board. Both follow it.
    const groupIndexOf = (activeStep: number | undefined) =>
      activeStep === undefined ? undefined : groupOfStep(groups, activeStep)
    const groupOf = (activeStep: number | undefined) => {
      const found = groupIndexOf(activeStep)
      return found === undefined ? undefined : groups[found]
    }

    function submitted({ correct, latencyMs, assisted }: Submission) {
      const pace = latencyMs === null ? null : latencyMs / problemTargetMs(problem, calibrationMs)
      // An answer with help counts in the tally below all the same; it is the
      // record that leaves it out (spec (core rounds) §5).
      onAttempt({ id: practiceId(kind), correct, pace, assisted })
      setTally((previous) => ({
        answered: previous.answered + 1,
        correct: previous.correct + (correct ? 1 : 0),
      }))
      if (correct) {
        // Held under its 〇, then swiped away (spec (roll) §3).
        setRolling(true)
        hold.current = setTimeout(() => {
          hold.current = null
          roll(at)
        }, ROLL_HOLD_MS)
      }
    }

    return (
      <QuestionView
        exercise={exercise}
        fade={fade}
        coaching={coachingForFade(fade)}
        prompt={strings.problemPrompt(problem)}
        renderSteps={({ activeStep, showAnswer }) => (
          <ProblemCorrectionCard
            problem={problem}
            expected={exercise.expected}
            expectedBeads={mode === 'beads' ? exercise.expectedBeads : undefined}
            activeGroup={groupIndexOf(activeStep)}
            showAnswer={showAnswer}
          />
        )}
        // Spec (見取算) §2: a 見取算 problem is a column in the prompt's place,
        // lighting the number the move stepped to belongs to.
        renderPrompt={
          problem.op === 'mitori'
            ? (activeStep) => {
              const group = groupOf(activeStep)
              return (
                <TermColumn
                  terms={problem.terms}
                  label={strings.problemPrompt(problem)}
                  activeTerm={group?.kind === 'column' ? group.term : undefined}
                />
              )
            }
            : undefined
        }
        // 両落とし leaves both numbers off the soroban, so a × problem shows
        // them on a board of their own beneath it, and 商除法 leaves the
        // divisor off, so a ÷ problem shows that (see OperandBoard).
        renderBeneath={
          problem.op === 'mul' || problem.op === 'div'
            ? (activeStep) => <OperandBoard problem={problem} activeGroup={groupOf(activeStep)} />
            : undefined
        }
        shownAt={shownAt}
        now={now}
        onSubmit={submitted}
        onMoveOn={() => roll(at)}
      />
    )
  }

  // The count sits outside the cards, so it stays put while they move and
  // ticks over as the next is laid underneath; it stays on the summary too,
  // so nothing jumps as the last card goes, and there its ✕, with nothing
  // left to lose, just finishes. It is outside the blocker, so ✕ still works
  // mid-roll. The cards are keyed by problem: the answered one keeps its
  // answer and its 〇 as it goes on top, and the next keeps its place once
  // uncovered. Only the card on top moves.
  const cards = leaving === null ? [index] : [index, leaving]
  const quit = index < problems.length ? onQuit : onQuit && finish
  return (
    <View style={styles.practice}>
      <RoundTrack index={index} total={problems.length} onQuit={quit} />
      <View style={styles.practice}>
        {cards.map((at) => (
          <Animated.View
            key={at}
            testID={at === leaving ? 'card-leaving' : 'card'}
            style={
              at === leaving ? [styles.card, styles.leaving, { opacity, transform: [{ translateX: offset }] }] : styles.card
            }
          >
            {card(at)}
          </Animated.View>
        ))}
        {blocker}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
  // Opaque paper, so the card underneath shows only as this one uncovers it.
  card: { ...StyleSheet.absoluteFill, backgroundColor: colors.paper },
  // A soft shadow on the trailing edge of the card going off, so it reads as
  // a card lifting away from the one beneath.
  leaving: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 6, height: 0 },
  },
})
