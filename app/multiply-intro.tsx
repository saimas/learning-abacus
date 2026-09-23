import { router, useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { isPracticeId, parsePracticeId } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { MultiplyIntro } from '@/ui/multiply/MultiplyIntro'
import { useProgress } from '@/ui/ProgressProvider'

// Spec (multiplication) §4: shown before the first × round, with that
// round's kind, and from the chooser's やりかた link, without one. Either way
// finishing it marks it seen.
export default function MultiplyIntroScreen() {
  const { hydrated, completeMultiplyIntro } = useProgress()
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

  // completeMultiplyIntro saves the whole progress object, so finishing
  // before it has loaded would overwrite disk with the provider's initial,
  // empty progress. Waiting for hydration, as /round does, keeps that safe.
  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <MultiplyIntro finishLabel={id !== null ? strings.start : strings.done} onFinish={finish} />
    </Screen>
  )
}
