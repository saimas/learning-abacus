import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, useWindowDimensions, View } from 'react-native'
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
import { ProblemCorrectionCard } from './ProblemCorrectionCard'
import { RoundTrack } from './RoundTrack'

// Spec (roll) §3: a right answer's 〇 is held on the answered problem for
// ROLL_HOLD_MS; then it rolls out and the next rolls in, so the change of
// problem is seen (the owner, 2026-09-28: "i didnt notice the problem moved
// to next … it rolled even before i see red circle").
export const ROLL_HOLD_MS = 700
export const ROLL_OUT_MS = 175
export const ROLL_IN_MS = 175

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
  // While a roll is pending or running: a blocker over the question takes
  // its taps, so nothing is answered or stepped mid-roll.
  const [rolling, setRolling] = useState(false)
  const [offset] = useState(() => new Animated.Value(0))
  const [opacity] = useState(() => new Animated.Value(1))
  // Spec (roll) §3: with Reduce Motion on, the problem fades out and in.
  const reduceMotion = useRef(false)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // Rolls to problem `to` (or the summary, past the last): out, swap, in.
  // The new problem's clock starts once it has arrived (spec (roll) §3).
  function roll(to: number) {
    setRolling(true)
    const fade = reduceMotion.current
    const out = fade
      ? Animated.timing(opacity, { toValue: 0, duration: ROLL_OUT_MS, useNativeDriver: false })
      : Animated.timing(offset, { toValue: -width, duration: ROLL_OUT_MS, useNativeDriver: false })
    out.start(({ finished: gone }) => {
      if (!gone) return
      setIndex(to)
      // The next one starts where it rolls in from: off to the right, or
      // unseen.
      if (fade) opacity.setValue(0)
      else offset.setValue(width)
      const into = fade
        ? Animated.timing(opacity, { toValue: 1, duration: ROLL_IN_MS, useNativeDriver: false })
        : Animated.timing(offset, { toValue: 0, duration: ROLL_IN_MS, useNativeDriver: false })
      into.start(({ finished: arrived }) => {
        if (!arrived) return
        setShownAt(now())
        setRolling(false)
      })
    })
  }

  const animated = { flex: 1, opacity, transform: [{ translateX: offset }] }
  const blocker = rolling ? <View testID="roll-blocker" style={StyleSheet.absoluteFill} /> : null

  const problem = problems[index]
  if (problem === undefined) {
    return (
      <View style={styles.practice}>
        <Animated.View style={animated}>
          <SessionSummary
            title={strings.roundComplete}
            answered={tally.answered}
            correct={tally.correct}
            onDone={() => {
              if (finished.current) return
              finished.current = true
              onFinish()
            }}
          />
        </Animated.View>
        {blocker}
      </View>
    )
  }

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
    const at = groupIndexOf(activeStep)
    return at === undefined ? undefined : groups[at]
  }

  function submitted({ correct, latencyMs, assisted }: Submission) {
    // Re-narrowed here rather than relied on from the enclosing scope: TS
    // does not carry a const's narrowing into a nested closure.
    if (problem === undefined) return
    const pace = latencyMs === null ? null : latencyMs / problemTargetMs(problem, calibrationMs)
    // An answer with help counts in the tally below all the same; it is the
    // record that leaves it out (spec (core rounds) §5).
    onAttempt({ id: practiceId(kind), correct, pace, assisted })
    setTally((previous) => ({
      answered: previous.answered + 1,
      correct: previous.correct + (correct ? 1 : 0),
    }))
    if (correct) {
      // Held under its 〇, then rolled away (spec (roll) §3).
      setRolling(true)
      hold.current = setTimeout(() => {
        hold.current = null
        roll(index + 1)
      }, ROLL_HOLD_MS)
    }
  }

  // The count sits outside the rolling view, so it stays put while the
  // problem rolls, keeps its place in the tree instead of being remounted
  // with each problem, and changes as the next one arrives. It is outside
  // the blocker too, so ✕ still works mid-roll.
  return (
    <View style={styles.practice}>
      <RoundTrack index={index} total={problems.length} onQuit={onQuit} />
      <View style={styles.practice}>
        <Animated.View style={animated}>
          <QuestionView
            key={index}
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
            onMoveOn={() => roll(index + 1)}
          />
        </Animated.View>
        {blocker}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
})
