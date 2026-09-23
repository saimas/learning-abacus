import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text } from 'react-native'
import { generateProblems, isPracticeId, parsePracticeId, ROUND_LENGTH } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { RoundRunner } from '@/ui/round/RoundRunner'
import { confirmQuit } from '@/ui/session/confirmQuit'

// Home is always underneath when the round was started from it. The replace
// covers a cold deep link straight to /round.
function goHome() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function Round() {
  const { progress, hydrated, practise, flush } = useProgress()
  const strings = useStrings()

  // Spec §6: ?kind=add:2. Narrowed to the id string, a primitive, because a
  // repeated param comes back as a new array on every render.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) ? param : null
  const kind = parsePracticeId(id)

  // Drawn once, at mount — the moment the round was chosen.
  const [problems] = useState(() => (kind === null ? [] : generateProblems(kind, ROUND_LENGTH, Math.random)))

  // The kind's level and the learner's calibration, read once progress has
  // loaded and then held for the round, so a promotion earned mid-round does
  // not change the screen under the learner.
  const setup = useMemo(
    () =>
      hydrated && id !== null
        ? { fade: progress.practices[id]?.fade ?? 0, calibrationMs: progress.calibrationMs }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, id],
  )

  if (kind === null) return <Redirect href="/" />

  if (setup === null) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  // Answers are already applied to progress one by one; this only makes
  // sure they are on disk before the screen goes.
  const leave = () => {
    void flush().then(goHome)
  }

  return (
    <Screen>
      <RoundRunner
        kind={kind}
        problems={problems}
        fade={setup.fade}
        calibrationMs={setup.calibrationMs}
        onAttempt={practise}
        onFinish={leave}
        onQuit={() => confirmQuit(strings, leave)}
      />
    </Screen>
  )
}
