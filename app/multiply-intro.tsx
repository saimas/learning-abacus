import { router, useLocalSearchParams } from 'expo-router'
import { isPracticeId, parsePracticeId } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { MultiplyIntro } from '@/ui/multiply/MultiplyIntro'
import { useProgress } from '@/ui/ProgressProvider'

// Spec (multiplication) §4: shown before the first × round, with that
// round's kind, and from the chooser's やりかた link, without one. Either way
// finishing it marks it seen.
export default function MultiplyIntroScreen() {
  const { completeMultiplyIntro } = useProgress()
  const strings = useStrings()
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) && parsePracticeId(param)?.op === 'mul' ? param : null

  const finish = () => {
    void completeMultiplyIntro().then(() => {
      if (id !== null) router.replace({ pathname: '/round', params: { kind: id } })
      else if (router.canGoBack()) router.back()
      else router.replace('/')
    })
  }

  return (
    <Screen>
      <MultiplyIntro finishLabel={id !== null ? strings.start : strings.done} onFinish={finish} />
    </Screen>
  )
}
