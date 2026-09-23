import { ScrollView, StyleSheet, Text } from 'react-native'
import { useStrings } from '@/i18n'
import { BackLink } from '@/ui/kit/BackLink'
import { Screen } from '@/ui/kit/Screen'
import { AtomGrid } from '@/ui/progress/AtomGrid'
import { PracticeTable } from '@/ui/progress/PracticeTable'
import { useProgress } from '@/ui/ProgressProvider'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

export default function ProgressScreen() {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()

  if (!hydrated) {
    return (
      <Screen>
        <Text testID="hydrating">{strings.loading}</Text>
      </Screen>
    )
  }

  return (
    <Screen>
      <BackLink />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{strings.navProgress}</Text>
        <Text style={styles.days}>{strings.daysPracticed(progress.daysPracticed)}</Text>
        <AtomGrid progress={progress} />
        <PracticeTable progress={progress} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xl },
  title: {
    marginTop: space.md,
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    letterSpacing: 2,
    color: colors.ink,
  },
  days: { marginTop: space.xs, marginBottom: space.lg, fontSize: fontSizes.small, color: colors.muted },
})
