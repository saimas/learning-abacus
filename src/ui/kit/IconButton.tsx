import { Pressable, StyleSheet } from 'react-native'
import { Icon, type IconName } from './Icon'

// onPress is optional so the button can sit inside <Link asChild>.
export function IconButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName
  label: string
  onPress?: () => void
  testID?: string
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
})
