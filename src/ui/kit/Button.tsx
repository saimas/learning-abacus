import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, space } from '@/ui/theme'

export type ButtonVariant = 'primary' | 'outline'

// onPress is optional only so a Button can sit inside <Link asChild>, which
// supplies it.
export function Button({
  label,
  detail,
  variant = 'primary',
  onPress,
  testID,
}: {
  label: string
  detail?: string
  variant?: ButtonVariant
  onPress?: () => void
  testID?: string
}) {
  const primary = variant === 'primary'
  const tone = primary ? styles.onPrimary : styles.onOutline
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.outline,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.label, tone]}>{label}</Text>
        {detail !== undefined ? <Text style={[styles.detail, tone]}>{detail}</Text> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  primary: {
    backgroundColor: colors.accent,
    borderBottomWidth: 2,
    borderBottomColor: colors.accentShadow,
  },
  outline: { borderWidth: 1.5, borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  content: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 1.5 },
  detail: { fontSize: 12, opacity: 0.8 },
  onPrimary: { color: colors.onAccent },
  onOutline: { color: colors.accent },
})
