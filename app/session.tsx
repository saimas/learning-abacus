import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, Text } from 'react-native'
import { selectSession } from '@/domain/session'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { SessionRunner } from '@/ui/session/SessionRunner'

// Home is always underneath when the session was started from it. The
// replace covers a cold deep link straight to /session.
function goHome() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function Session() {
  const { progress, hydrated, attempt, flush } = useProgress()
  const strings = useStrings()
  // Captured once at mount — the moment はじめる was tapped — not read fresh
  // from Date.now() during render, which react-hooks/purity forbids.
  const [startedAt] = useState(() => Date.now())

  // Planned once per mount: re-planning mid-session would reshuffle the queue
  // under the learner as their own answers change the schedule.
  const plan = useMemo(
    () => (hydrated ? selectSession(progress, startedAt) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, startedAt],
  )

  if (plan === null) {
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

  const confirmQuit = () => {
    Alert.alert(strings.quitTitle, strings.quitBody, [
      { text: strings.quitContinue, style: 'cancel' },
      { text: strings.quitStop, style: 'destructive', onPress: leave },
    ])
  }

  return (
    <Screen>
      <SessionRunner
        plan={plan}
        onAttempt={attempt}
        onBlockEnd={() => void flush()}
        onFinish={leave}
        onQuit={confirmQuit}
      />
    </Screen>
  )
}
