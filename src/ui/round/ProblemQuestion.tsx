import { exerciseForProblem } from '@/domain/exercise'
import { coachingForFade, type FadeLevel } from '@/domain/fade'
import { groupOfStep, problemSteps, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { FlashPrompt } from '@/ui/flash/FlashPrompt'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { OperandBoard } from '@/ui/multiply/OperandBoard'
import { QuestionView, type AfterAnswer, type Submission } from '@/ui/session/QuestionView'
import { ProblemCorrectionCard } from './ProblemCorrectionCard'

// One problem as a question: QuestionView with the problem's correction
// card, its 見取算 column, its フラッシュ暗算 flash or its operand board. A
// round and a lesson's やってみよう ask problems the same way.
export function ProblemQuestion({
  problem,
  fade,
  shownAt,
  now,
  onSubmit,
  onMoveOn,
  afterAnswer,
  easeFade,
  missNote,
  revealed = true,
}: {
  problem: Problem
  fade: FadeLevel
  shownAt: number
  now: () => number
  onSubmit: (submission: Submission) => void
  onMoveOn: () => void
  afterAnswer?: AfterAnswer
  easeFade?: boolean
  missNote?: string
  // Spec (flash) §4: whether the card is uncovered, which a flash waits
  // for. A card on top at rest is; a lesson's やってみよう never asks a flash.
  revealed?: boolean
}) {
  const strings = useStrings()
  const exercise = exerciseForProblem(problem)
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
  // The number the move stepped to belongs to, which a column lights:
  // 見取算's, or a flash's once the step panel is open (spec (flash) §2).
  const activeTermOf = (activeStep: number | undefined) => {
    const group = groupOf(activeStep)
    return group?.kind === 'column' ? group.term : undefined
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
          activeGroup={groupIndexOf(activeStep)}
          showAnswer={showAnswer}
          given={given}
        />
      )}
      // Spec (見取算) §2: a 見取算 problem is a column in the prompt's place,
      // lighting the number the move stepped to belongs to. Spec (flash) §2:
      // a フラッシュ暗算 problem flashes its numbers there, and shows them as
      // that column once the step panel is open. Spec (home menu) §4: once
      // its flash is over, until the answer is in, a line there says to add
      // the fifth number on the beads.
      renderPrompt={
        problem.op === 'mitori'
          ? (activeStep) => (
            <TermColumn
              terms={problem.terms}
              label={strings.problemPrompt(problem)}
              activeTerm={activeTermOf(activeStep)}
            />
          )
          : problem.op === 'flash'
            ? (activeStep, { panelOpen, flashShown, flashAnswering }) => (
              <FlashPrompt
                terms={problem.terms}
                label={strings.problemPrompt(problem)}
                columnLabel={strings.columnReading(problem.terms)}
                shown={flashShown}
                columnShown={panelOpen}
                answering={flashAnswering}
                activeTerm={activeTermOf(activeStep)}
              />
            )
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
      easeFade={easeFade}
      missNote={missNote}
      flash={problem.op === 'flash' ? { terms: problem.terms, revealed } : undefined}
    />
  )
}
