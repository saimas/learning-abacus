import { Link } from 'expo-router'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useStrings } from '@/i18n'
import { colors, fontSizes, space } from '@/ui/theme'
import { Icon } from './Icon'

// dismissTo pops back to the home screen already in the stack instead of
// pushing a second copy of it on top.
export function BackLink() {
  const strings = useStrings()
  return (
    <Link href="/" dismissTo asChild testID="link-today">
      <Pressable accessibilityRole="link" hitSlop={10} style={styles.back}>
        <Icon name="back" size={18} />
        <Text style={styles.label}>{strings.back}</Text>
      </Pressable>
    </Link>
  )
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    paddingVertical: space.xs,
  },
  label: { fontSize: fontSizes.body, color: colors.ink },
})
