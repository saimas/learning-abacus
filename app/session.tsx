import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, Text } from 'react-native'
import { isPracticePart, planForPart, selectSession } from '@/domain/session'
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
  // Captured once at mount — the moment the session was chosen — not read fresh
  // from Date.now() during render, which react-hooks/purity forbids.
  const [startedAt] = useState(() => Date.now())

  // Spec (choosing what to practise) §5: ?part=focus practises that part alone.
  // No part, one this app does not know, or a repeated ?part= is the full
  // session. It is narrowed to a primitive here, because a repeated param
  // comes back as a new array on every render and would re-plan the session
  // under the learner.
  const param = useLocalSearchParams().part
  const part = isPracticePart(param) ? param : null

  // Planned once per mount: re-planning mid-session would reshuffle the queue
  // under the learner as their own answers change the schedule.
  const plan = useMemo(
    () => {
      if (!hydrated) return null
      const today = selectSession(progress, startedAt)
      return part === null ? today : planForPart(today, part)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, startedAt, part],
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
