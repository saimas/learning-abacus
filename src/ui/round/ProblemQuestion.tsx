import { exerciseForProblem } from '@/domain/exercise'
import { answerModeForFade, coachingForFade, type FadeLevel } from '@/domain/fade'
import { groupOfStep, problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { QuestionView, type AfterAnswer, type Submission } from '@/ui/session/QuestionView'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'

// One problem as a question: QuestionView with the problem's correction
// card, its 見取算 column or its operand board. A round and a lesson's
// やってみよう ask problems the same way.
export function ProblemQuestion({
  problem,
  fade,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
  afterAnswer,
}: {
  problem: Problem
  fade: FadeLevel
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: () => void
  afterAnswer?: AfterAnswer
}) {
  const strings = useStrings()
  const exercise = exerciseForProblem(problem)
  // QuestionView decides bead vs. keypad from the same fade (see its own
  // `mode`). The review card needs it too: a ÷ miss's beads were checked
  // against expectedBeads (the final soroban reading), so only in bead mode
  // does its answer line say more than the quotient.
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

  return (
    <QuestionView
      exercise={exercise}
      fade={fade}
      coaching={coachingForFade(fade)}
      prompt={strings.problemPrompt(problem)}
      renderSteps={({ activeStep, showAnswer, given }) => (
        <ProblemCorrectionCard
          problem={problem}
          expected={exercise.expected}
          expectedBeads={mode === 'beads' ? exercise.expectedBeads : undefined}
          activeGroup={groupIndexOf(activeStep)}
          showAnswer={showAnswer}
          given={given}
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
      onSubmit={onSubmit}
      onMoveOn={() => onMoveOn()}
      afterAnswer={afterAnswer}
    />
  )
}
