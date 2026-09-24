import { router, useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { isPracticeId, parsePracticeId, type Problem } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { MethodIntro, type IntroTexts } from './MethodIntro'

// A walkthrough as a route (spec (multiplication) §4, (division) §3): shown
// before the first round of its operation, with that round's kind, and from
// Home's やりかた link, without one. Either way finishing it marks it seen
// through `complete`, then starts the round or goes back.
export function IntroScreen({
  problem,
  intro,
  complete,
}: {
  problem: Problem
  intro: IntroTexts
  complete: () => Promise<void>
}) {
  const { hydrated } = useProgress()
  const strings = useStrings()
  // Only a round of the walkthrough's own operation is started from it: the
  // route is reachable by deep link with any kind.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) && parsePracticeId(param)?.op === problem.op ? param : null

  const finish = () => {
    void complete().then(() => {
      if (id !== null) router.replace({ pathname: '/round', params: { kind: id } })
      else if (router.canGoBack()) router.back()
      else router.replace('/')
    })
  }

  // Marking a walkthrough seen saves the whole progress object, so finishing
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
      <MethodIntro
        problem={problem}
        intro={intro}
        finishLabel={id !== null ? strings.start : strings.done}
        onFinish={finish}
      />
    </Screen>
  )
}
