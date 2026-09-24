import type { Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { IntroScreen } from '@/ui/intro/IntroScreen'
import { MethodIntro } from '@/ui/intro/MethodIntro'
import { useProgress } from '@/ui/ProgressProvider'

// Spec (multiplication) §4: one worked 2×2 problem, small enough to follow
// and with every kind of placement in it.
const EXAMPLE: Problem = { op: 'mul', digits: 2, a: 47, b: 36 }

function Walkthrough({ finishLabel, onFinish }: { finishLabel: string; onFinish: () => void }) {
  const strings = useStrings()
  return (
    <MethodIntro
      problem={EXAMPLE}
      intro={{
        title: strings.introTitle,
        method: strings.introMethod,
        placement: strings.introPlacement,
        result: strings.introResult,
      }}
      finishLabel={finishLabel}
      onFinish={onFinish}
    />
  )
}

// How 両落とし works, shown before the first × round and from Home's
// かけ算のやりかた link.
export default function MultiplyIntroScreen() {
  const { completeMultiplyIntro } = useProgress()
  return <IntroScreen op="mul" complete={completeMultiplyIntro} walkthrough={Walkthrough} />
}
