import { Link, Redirect } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { selectSession } from '@/domain/session'
import { useStrings } from '@/i18n'
import { useProgress } from '@/ui/ProgressProvider'
import { SessionRunner } from '@/ui/session/SessionRunner'

export default function Today() {
  const { progress, hydrated, attempt, flush } = useProgress()
  const strings = useStrings()
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
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </View>
    )
  }

  if (!progress.tutorialDone) {
    return <Redirect href="/tutorial" />
  }

  return (
    <View>
      <Text testID="days-practiced">{strings.daysPracticed(progress.daysPracticed)}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Link href="/progress" testID="link-progress">
          {strings.navProgress}
        </Link>
        <Link href="/settings" testID="link-settings">
          {strings.navSettings}
        </Link>
      </View>
      <SessionRunner
        plan={plan}
        onAttempt={attempt}
        onBlockEnd={() => void flush()}
        onFinish={() => void flush()}
      />
    </View>
  )
}
