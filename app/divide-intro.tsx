import type { Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { IntroScreen } from '@/ui/intro/IntroScreen'
import { useProgress } from '@/ui/ProgressProvider'

// Spec (division) §3: the × walkthrough's 47 × 36 run backwards, a 2けた
// problem whose two quotient digits both land one rod left of the head
// (割れない), with a 九九 taken off per divisor digit after each.
const EXAMPLE: Problem = { op: 'div', digits: 2, a: 1692, b: 36 }

// How 商除法 works, shown before the first ÷ round and from Home's
// わり算のやりかた link.
export default function DivideIntroScreen() {
  const { completeDivideIntro } = useProgress()
  const strings = useStrings()
  return (
    <IntroScreen
      problem={EXAMPLE}
      intro={{
        title: strings.divideIntroTitle,
        method: strings.divideIntroMethod,
        guess: strings.divideIntroGuess,
        placement: strings.divideIntroPlacement,
        result: strings.divideIntroResult,
      }}
      complete={completeDivideIntro}
    />
  )
}
