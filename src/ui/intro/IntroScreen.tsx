import { router, useLocalSearchParams } from 'expo-router'
import { useRef, type ReactNode } from 'react'
import { Text } from 'react-native'
import { isPracticeId, parsePracticeId, type Operation } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'

// A walkthrough as a route (spec (multiplication) §4, (division walkthrough)
// §4): shown before the first round of its operation, with that round's
// kind, and from Home's やりかた link, without one. Either way finishing it
// marks it seen through `complete`, then starts the round or goes back. The
// walkthrough itself is handed in as a render function, since × (MethodIntro)
// and ÷ (DivideWalkthrough) no longer share one component.
export function IntroScreen({
  op,
  complete,
  children,
}: {
  op: Operation
  complete: () => Promise<void>
  children: (finishLabel: string, onFinish: () => void) => ReactNode
}) {
  const { hydrated } = useProgress()
  const strings = useStrings()
  // Only a round of the walkthrough's own operation is started from it: the
  // route is reachable by deep link with any kind.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) && parsePracticeId(param)?.op === op ? param : null
  // The screen goes away only once progress is saved, so a second tap in the
  // meantime (either walkthrough's finish button) must not finish it twice.
  // `finish` only ever reads or writes the ref from inside itself, once
  // called as an event handler (DivideWalkthrough's and MethodIntro's own
  // Button both just wire it to onPress) — never during any render. React
  // Compiler cannot see that far, though: it only recognises a ref-reading
  // function as safe when it is handed to a child directly as a JSX prop of
  // this component's own, never through a call made while rendering (the
  // owner's note on useActiveLineLayout.ts), which is what handing `finish`
  // to `children` here is. useCallback and useEffectEvent were tried first;
  // both are unwrapped or restricted in ways that do not fit a value handed
  // out through a render prop, so this one line is exempted instead.
  const finished = useRef(false)
  const finish = () => {
    if (finished.current) return
    finished.current = true
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

  // eslint-disable-next-line react-hooks/refs -- see the comment on `finish` above
  return <Screen>{children(id !== null ? strings.start : strings.done, finish)}</Screen>
}
