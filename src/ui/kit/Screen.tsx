import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, space } from '@/ui/theme'

// Every route renders inside one of these: paper background, the 20pt gutter,
// and content kept clear of the status bar, Dynamic Island and home indicator.
export function Screen({
  children,
  style,
  testID,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}) {
  const insets = useSafeAreaInsets()
  return (
    <View
      testID={testID}
      style={[
        styles.screen,
        { paddingTop: insets.top + space.xs, paddingBottom: Math.max(insets.bottom, space.xl) },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.xl },
})
