import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, space } from '@/ui/theme'

export type ButtonVariant = 'primary' | 'outline'

// The button's own minHeight, exported for a caller that needs to hold a row
// of buttons' place (at the same height) before or after they are mounted,
// so nothing else on screen shifts when they appear or disappear.
export const BUTTON_HEIGHT = 54

// onPress is optional only so a Button can sit inside <Link asChild>, which
// supplies it.
export function Button({
  label,
  variant = 'primary',
  onPress,
  testID,
  disabled = false,
}: {
  label: string
  variant?: ButtonVariant
  onPress?: () => void
  testID?: string
  disabled?: boolean
}) {
  const primary = variant === 'primary'
  const tone = primary ? styles.onPrimary : styles.onOutline
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.outline,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.label, tone]}>{label}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: BUTTON_HEIGHT,
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
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 1.5 },
  onPrimary: { color: colors.onAccent },
  onOutline: { color: colors.accent },
})
