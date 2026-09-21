import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSizes, space } from '@/ui/theme'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFor,
  testIDFor,
}: {
  options: readonly T[]
  value: T
  onChange: (next: T) => void
  labelFor: (option: T) => string
  testIDFor: (option: T) => string
}) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const selected = option === value
        const testID = testIDFor(option)
        return (
          <Pressable
            key={option}
            testID={testID}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text testID={`${testID}-label`} style={[styles.label, selected && styles.selectedLabel]}>
              {labelFor(option)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.soft, borderRadius: 9, padding: 2 },
  option: { paddingVertical: 6, paddingHorizontal: space.md, borderRadius: 7 },
  selected: {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  label: { fontSize: fontSizes.small, color: colors.muted },
  selectedLabel: { color: colors.ink, fontWeight: '600' },
})
