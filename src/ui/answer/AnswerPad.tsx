import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { colors, fonts, radius, space } from '@/ui/theme'

// The largest answer a single-rod atom can have is 9 + 9 = 18.
export const MAX_ANSWER_DIGITS = 2

// A lone "0" is replaced rather than extended, so "05" can never be typed.
// `maxDigits` is the most the answer can have: a problem's answer can run to
// one digit more than its operands, 999 + 999 = 1998.
export function appendDigit(value: string, digit: string, maxDigits = MAX_ANSWER_DIGITS): string {
  if (value === '0') return digit
  if (value.length >= maxDigits) return value
  return value + digit
}

const DIGIT_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
] as const

function DigitKey({ digit, onPress }: { digit: string; onPress: () => void }) {
  return (
    <Pressable
      testID={`key-${digit}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.key, pressed && styles.pressed]}
    >
      {/* The key is a fixed-size shape; Dynamic Type must not push the digit
          out of it. */}
      <Text style={styles.digit} maxFontSizeMultiplier={1.3}>
        {digit}
      </Text>
    </Pressable>
  )
}

// Controlled: the caller owns the value and decides what submitting means.
// A blank value is never submitted, matching parseAnswer's rule that a blank
// field is not an answer.
export function AnswerPad({
  value,
  onChange,
  onSubmit,
  submitLabel,
  submitTestID,
  adornment,
  maxDigits = MAX_ANSWER_DIGITS,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  submitLabel: string
  submitTestID: string
  adornment?: ReactNode
  maxDigits?: number
}) {
  const strings = useStrings()
  const empty = value === ''

  return (
    <View>
      <View style={styles.readoutRow}>
        <View style={styles.side} />
        <Text testID="answer-readout" accessibilityLiveRegion="polite" style={styles.readout}>
          {value}
        </Text>
        <View style={styles.side}>{adornment}</View>
      </View>
      {DIGIT_ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((digit) => (
            <DigitKey key={digit} digit={digit} onPress={() => onChange(appendDigit(value, digit, maxDigits))} />
          ))}
        </View>
      ))}
      <View style={styles.row}>
        <Pressable
          testID="key-delete"
          accessibilityRole="button"
          accessibilityLabel={strings.deleteKey}
          onPress={() => onChange(value.slice(0, -1))}
          style={({ pressed }) => [styles.key, styles.quiet, pressed && styles.pressed]}
        >
          <Icon name="delete" color={colors.muted} />
        </Pressable>
        <DigitKey digit="0" onPress={() => onChange(appendDigit(value, '0', maxDigits))} />
        <Pressable
          testID={submitTestID}
          accessibilityRole="button"
          accessibilityState={{ disabled: empty }}
          onPress={() => {
            if (!empty) onSubmit()
          }}
          style={({ pressed }) => [
            styles.key,
            styles.submit,
            empty && styles.submitIdle,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.submitLabel} maxFontSizeMultiplier={1.3}>
            {submitLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  side: { width: 48, alignItems: 'center' },
  readout: {
    minWidth: 120,
    height: 52,
    lineHeight: 52,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  key: {
    flex: 1,
    height: 50,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderBottomWidth: 2,
    borderBottomColor: colors.keyEdge,
  },
  digit: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent', borderBottomColor: 'transparent' },
  submit: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderBottomColor: colors.accentShadow,
  },
  submitIdle: { opacity: 0.45 },
  submitLabel: { color: colors.onAccent, fontSize: 15, fontWeight: '600', letterSpacing: 1 },
  pressed: { opacity: 0.7 },
})
