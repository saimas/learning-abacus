import { Link } from 'expo-router'
import { Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { useProgress } from '@/ui/ProgressProvider'
import { AtomGrid } from '@/ui/progress/AtomGrid'

export default function ProgressScreen() {
  const { progress, hydrated } = useProgress()
  const strings = useStrings()
  if (!hydrated) return <Text testID="hydrating">{strings.loading}</Text>
  return (
    <View>
      <Text>{strings.daysPracticed(progress.daysPracticed)}</Text>
      <AtomGrid progress={progress} />
      <Link href="/" testID="link-today">
        {strings.navToday}
      </Link>
    </View>
  )
}
