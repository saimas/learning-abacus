import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { HOW_TO_OPS } from '@/domain/lessons'
import { practiceStage } from '@/domain/practice'
import { DIGITS, practiceId, type Operation, type PairOperation, type PracticeKind } from '@/domain/problem'
import { useStrings } from '@/i18n'
import { BackLink } from '@/ui/kit/BackLink'
import { Button } from '@/ui/kit/Button'
import { Screen } from '@/ui/kit/Screen'
import { STAGE_COLOR, stageInk } from '@/ui/progress/stageColor'
import { useProgress } from '@/ui/ProgressProvider'
import { useOnePush } from '@/ui/useOnePush'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

// Spec (home menu) §3: an operation's page, opened from its button on Home.
// A card per size, in its stage's colour, with its stage and level as the
// progress table's cell has them, and its best run. A tap starts a run of
// that kind exactly as Home's grid cell did; a × or ÷ kind never played
// opens its lesson first, which the round screen sees to. Under the cards,
// やりかた opens the operation's lessons, for ＋ − × ÷.
export function OperationScreen({ op }: { op: Operation }) {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()
  const onePush = useOnePush()

  // A cold deep link renders before progress has loaded, when every card
  // would read まだ.
  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating" style={styles.muted}>
          {strings.loadingProgress}
        </Text>
      </Screen>
    )
  }

  const startRun = (kind: PracticeKind) =>
    onePush(() => router.push({ pathname: '/round', params: { kind: practiceId(kind) } }))
  const openHowTo = (lessonsOp: PairOperation) =>
    onePush(() => router.push({ pathname: '/howto/[op]', params: { op: lessonsOp } }))
  const howTo = HOW_TO_OPS.find((candidate) => candidate === op)

  return (
    <Screen>
      <BackLink />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          {strings.operationName(op)}
        </Text>
        <View style={styles.cards}>
          {DIGITS.map((digits) => {
            const kind: PracticeKind = { op, digits }
            const id = practiceId(kind)
            const record = progress.practices[id]
            const stage = practiceStage(record)
            const best = progress.bestRuns[id]
            const ink = { color: stageInk(stage) }
            return (
              <Pressable
                key={digits}
                testID={`practice-card-${id}`}
                accessibilityRole="button"
                accessibilityLabel={strings.practiceCardLabel(kind, stage, record?.fade, best)}
                onPress={() => startRun(kind)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: STAGE_COLOR[stage] },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.size, ink]}>{strings.digitsName(digits)}</Text>
                <View style={styles.standing}>
                  <Text testID={`practice-card-stage-${id}`} style={[styles.detail, ink]}>
                    {strings.practiceStageName(stage)}
                  </Text>
                  {record === undefined ? null : (
                    <Text testID={`practice-card-level-${id}`} style={[styles.detail, ink]}>
                      {strings.levelName(record.fade)}
                    </Text>
                  )}
                </View>
                {best === undefined ? null : (
                  <Text testID={`practice-card-best-${id}`} style={[styles.detail, ink]}>
                    {strings.bestScore(best)}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
        {howTo === undefined ? null : (
          <View style={styles.howTo}>
            <Button
              testID="practice-howto"
              variant="outline"
              label={strings.howToButton}
              accessibilityLabel={strings.howToTitle(howTo)}
              onPress={() => openHowTo(howTo)}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  muted: { fontSize: fontSizes.small, color: colors.muted },
  scroll: { flex: 1 },
  content: { paddingBottom: space.xl },
  // As the やりかた page's title.
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  cards: { marginTop: space.lg, gap: space.md },
  // A full-width button per size, tall enough for its three lines, and
  // taller at a large text size: the page scrolls.
  card: {
    minHeight: 88,
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.card,
  },
  // As Home's buttons.
  pressed: { opacity: 0.85 },
  size: { fontFamily: fonts.display, fontSize: fontSizes.title },
  // The stage, then its level beside it, wrapping at a large text size.
  standing: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md },
  detail: { fontSize: fontSizes.body },
  howTo: { marginTop: space.xl },
})
