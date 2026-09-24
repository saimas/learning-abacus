import type { Problem } from '@/domain/problem'
import { DivideWalkthrough } from '@/ui/intro/DivideWalkthrough'
import { IntroScreen } from '@/ui/intro/IntroScreen'
import { useProgress } from '@/ui/ProgressProvider'

// Spec (division walkthrough) §1: the × walkthrough's 47 × 36 run backwards,
// a 2けた problem whose two quotient digits both land one rod left of the
// head (割れない) and each need their 九九 guess fixed down by one, with a
// 九九 taken off per divisor digit after each.
const EXAMPLE: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }

// The bead-by-bead walkthrough of 商除法, guess and all (spec: division
// walkthrough §2, §4), shown before the first ÷ round and from Home's
// わり算のやりかた link.
export default function DivideIntroScreen() {
  const { completeDivideIntro } = useProgress()
  return (
    <IntroScreen op="div" complete={completeDivideIntro}>
      {(finishLabel, onFinish) => <DivideWalkthrough problem={EXAMPLE} finishLabel={finishLabel} onFinish={onFinish} />}
    </IntroScreen>
  )
}
