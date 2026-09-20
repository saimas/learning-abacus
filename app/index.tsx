import { Redirect } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { selectSession } from '@/domain/session'
import { useProgress } from '@/ui/ProgressProvider'
import { SessionRunner } from '@/ui/session/SessionRunner'

export default function Today() {
  const { progress, hydrated, attempt, flush } = useProgress()
  // Captured once at mount, not read fresh from Date.now() during render:
  // react-hooks/purity forbids calling an impure function while rendering.
  const [startedAt] = useState(() => Date.now())

  // Planned once per mount: re-planning mid-session would reshuffle the queue
  // under the learner as their own answers change the schedule.
  const plan = useMemo(
    () => (hydrated ? selectSession(progress, startedAt) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, startedAt],
  )

  if (!hydrated || plan === null) {
    return (
      <View>
        <Text testID="hydrating">Loading your progress…</Text>
      </View>
    )
  }

  if (!progress.tutorialDone) {
    return <Redirect href="/tutorial" />
  }

  return (
    <View>
      <Text testID="days-practiced">{`${progress.daysPracticed} days practised`}</Text>
      <SessionRunner
        plan={plan}
        onAttempt={attempt}
        onBlockEnd={() => void flush()}
        onFinish={() => void flush()}
      />
    </View>
  )
}
