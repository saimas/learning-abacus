import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { exerciseForProblem } from '@/domain/exercise'
import { coachingForFade, type FadeLevel } from '@/domain/fade'
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
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { QuestionView, type Submission } from '@/ui/session/QuestionView'
import { SessionSummary } from '@/ui/session/SessionSummary'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'
import { RoundTrack } from './RoundTrack'

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
  // As in SessionRunner: counts right answers so each one replays the 〇.
  const [maru, setMaru] = useState(0)
  const finished = useRef(false)

  const problem = problems[index]
  if (problem === undefined) {
    return (
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
    )
  }

  const exercise = exerciseForProblem(problem)
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

  function next(t: number) {
    setIndex((previous) => previous + 1)
    setShownAt(t)
  }

  function submitted({ correct, latencyMs, t, assisted }: Submission) {
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
      setMaru((previous) => previous + 1)
      next(t)
    } else {
      setMaru(0)
    }
  }

  // The count sits outside the keyed QuestionView, as SessionRunner's time
  // track does, so the bar keeps its place in the tree from one problem to
  // the next instead of being remounted with each.
  return (
    <View style={styles.practice}>
      <RoundTrack index={index} total={problems.length} onQuit={onQuit} />
      <QuestionView
        key={index}
        exercise={exercise}
        fade={fade}
        coaching={coachingForFade(fade)}
        prompt={strings.problemPrompt(problem)}
        demonstration={null}
        renderSteps={({ activeStep, showAnswer }) => (
          <ProblemCorrectionCard
            problem={problem}
            expected={exercise.expected}
            activeGroup={groupIndexOf(activeStep)}
            showAnswer={showAnswer}
          />
        )}
        // 両落とし leaves both numbers off the soroban, so a × problem shows
        // them on a board of their own beneath it, and 商除法 leaves the
        // divisor off, so a ÷ problem shows that (see OperandBoard).
        renderBeneath={
          problem.op === 'mul' || problem.op === 'div'
            ? (activeStep) => <OperandBoard problem={problem} activeGroup={groupOf(activeStep)} />
            : undefined
        }
        track={null}
        maru={maru}
        shownAt={shownAt}
        now={now}
        onSubmit={submitted}
        onMoveOn={next}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  practice: { flex: 1 },
})
