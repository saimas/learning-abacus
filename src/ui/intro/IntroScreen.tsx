import { router, useLocalSearchParams } from 'expo-router'
import { useRef, type ComponentType } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { isPracticeId, parsePracticeId, type Operation } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { Screen } from '@/ui/kit/Screen'
import { useProgress } from '@/ui/ProgressProvider'

// A walkthrough as a route (spec (multiplication) §4, (division walkthrough)
// §4): shown before the first round of its operation, with that round's
// kind, and from Home's やりかた link, without one. Either way finishing it
// (or leaving it by ✕) marks it seen through `complete`, then starts the
// round or goes back. The
// walkthrough itself is handed in as a component, since × (MethodIntro) and
// ÷ (DivideWalkthrough) no longer share one.
export function IntroScreen({
  op,
  complete,
  walkthrough: Walkthrough,
}: {
  op: Operation
  complete: () => Promise<void>
  walkthrough: ComponentType<{ finishLabel: string; onFinish: () => void }>
}) {
  const { hydrated } = useProgress()
  const strings = useStrings()
  // Only a round of the walkthrough's own operation is started from it: the
  // route is reachable by deep link with any kind.
  const param = useLocalSearchParams().kind
  const id = isPracticeId(param) && parsePracticeId(param)?.op === op ? param : null
  // A second tap while progress is saving must not leave the screen twice,
  // whether by finishing or by ✕.
  const finished = useRef(false)
  // Either way out marks the walkthrough seen. Finishing starts the round it
  // was shown before, if any; ✕ (the owner, 2026-09-29: "quit anytime they
  // want") always goes back, and the next tap on the grid starts the round
  // without it. It can still be replayed from Home's やりかた link.
  const leave = (startRound: boolean) => {
    if (finished.current) return
    finished.current = true
    void complete().then(() => {
      if (startRound && id !== null) router.replace({ pathname: '/round', params: { kind: id } })
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
      {/* The same ✕, at the same place, as a round's (RoundTrack). */}
      <View style={styles.bar}>
        <Pressable
          testID="intro-exit"
          accessibilityRole="button"
          accessibilityLabel={strings.introExit}
          onPress={() => leave(false)}
          hitSlop={12}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      <Walkthrough finishLabel={id !== null ? strings.start : strings.done} onFinish={() => leave(true)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', height: 28 },
})
