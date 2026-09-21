import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius, space } from '@/ui/theme'

// `accent` is the correction style: a vermilion edge down the left, used
// wherever the app is telling the learner they got something wrong.
export function Card({
  children,
  accent = false,
  style,
  testID,
}: {
  children: ReactNode
  accent?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  return (
    <View testID={testID} style={[styles.card, accent && styles.accent, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.card,
    padding: space.md,
  },
  accent: { borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: radius.panel },
})
