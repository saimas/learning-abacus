import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Text } from 'react-native'
import { lessonForKind } from '@/domain/lessons'
import { isPracticeId, parsePracticeId, practiceId } from '@/domain/problem'
import { nextProblem } from '@/domain/run'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'
import { RunRunner } from '@/ui/round/RunRunner'
import { confirmQuit } from '@/ui/session/confirmQuit'

// The operation's page the run was started from (spec (home menu) §3) is
// underneath. The replace covers a cold deep link straight to /round.
function leaveRun() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

export default function Round() {
  const { progress, hydrated, practise, earn, beginRun, endRun, flush } = useProgress()
  const strings = useStrings()

  // Spec §6: ?kind=add:2. Narrowed to the id string, a primitive, because a
  // repeated param comes back as a new array on every render.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) ? param : null
  const kind = parsePracticeId(id)

  // Spec (runs) §5: もう一回 starts a new run of the same kind, mounted afresh.
  const [runNumber, setRunNumber] = useState(0)

  // What a run reads once, as it starts: the calibration for its time
  // targets, and for its results the lifetime points and the kind's best
  // before it. Its own answers move progress on under it.
  const setup = useMemo(
    () =>
      hydrated && id !== null
        ? { calibrationMs: progress.calibrationMs, pointsBefore: progress.points, best: progress.bestRuns[id] }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated, id, runNumber],
  )

  // Spec (runs) §2: each run starts its kind's streaks afresh.
  useEffect(() => {
    if (setup !== null && id !== null) beginRun(id)
  }, [setup, id, beginRun])

  if (kind === null) return <Redirect href="/" />

  if (setup === null) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loadingProgress}</Text>
      </Screen>
    )
  }

  // Spec (howto tutorial) §4: a × or ÷ kind never played opens its own
  // 桁数's lesson first, unless that lesson is done. ＋ and − open none.
  const runId = practiceId(kind)
  const lesson = lessonForKind(kind)
  if (lesson !== null && progress.practices[runId] === undefined && !progress.lessonsSeen.includes(lesson.id)) {
    return <Redirect href={{ pathname: '/lesson/[id]', params: { id: lesson.id, kind: runId } }} />
  }

  // Answers and points are already applied to progress one by one; this
  // only makes sure they are on disk before the screen goes.
  const leave = () => {
    void flush().then(leaveRun)
  }

  return (
    <Screen>
      <RunRunner
        key={runNumber}
        kind={kind}
        // The record's level, live: the run lays each new card at it.
        level={progress.practices[runId]?.fade ?? 0}
        calibrationMs={setup.calibrationMs}
        draw={(shown) => nextProblem(kind, shown, Math.random)}
        pointsBefore={setup.pointsBefore}
        best={setup.best}
        onAttempt={practise}
        onPoints={earn}
        onEnd={(score) => void endRun(runId, score)}
        onAgain={() => setRunNumber((number) => number + 1)}
        onLeave={leave}
        askQuit={(confirmed) => confirmQuit(strings, confirmed)}
      />
    </Screen>
  )
}
