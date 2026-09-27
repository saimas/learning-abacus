import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// The prompt's own size where there is room. A 375 × 667 phone
// (SHORT_WINDOW_HEIGHT) needs five lines to leave the soroban, 手順を見る and
// こたえる their room, so there the column is drawn smaller.
export const COLUMN_FONT_SIZE = fontSizes.prompt
export const COLUMN_SHORT_FONT_SIZE = 22

// Spec (見取算) §2, §4: a 見取算 problem drawn as on exam paper, in place of
// the text prompt: the numbers right-aligned in tabular figures, a minus
// sign on the ones to subtract and none on the ones to add, and a rule under
// the last. `activeTerm` is the number the move stepped to belongs to, drawn
// in the accent, as the × board draws its digits. VoiceOver reads the whole
// column as one sentence (`label`), since the rows alone would lose the
// ＋ − that the missing plus signs leave unsaid.
export function TermColumn({
  terms,
  label,
  activeTerm,
}: {
  terms: readonly number[]
  label: string
  activeTerm?: number
}) {
  const { height } = useWindowDimensions()
  const fontSize = height < SHORT_WINDOW_HEIGHT ? COLUMN_SHORT_FONT_SIZE : COLUMN_FONT_SIZE
  const size = { fontSize, lineHeight: Math.round(fontSize * 1.2) }
  return (
    <View testID="prompt" accessible accessibilityLabel={label} style={styles.column}>
      {terms.map((term, index) => {
        const active = index === activeTerm
        return (
          <View key={index} testID={`term-${index}`} style={styles.row}>
            <Text style={[styles.sign, size, active && styles.active]}>{term < 0 ? '−' : ''}</Text>
            <Text style={[styles.number, size, active && styles.active]}>{String(Math.abs(term))}</Text>
          </View>
        )
      })}
      <View style={styles.rule} />
    </View>
  )
}

const styles = StyleSheet.create({
  // As wide as its widest row, centred; every row stretches to that width,
  // so the numbers end at one right edge and the signs start at one left.
  column: { marginTop: space.lg, alignSelf: 'center', alignItems: 'stretch' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  sign: { minWidth: 28, fontFamily: fonts.display, color: colors.ink },
  number: {
    marginLeft: space.sm,
    textAlign: 'right',
    fontFamily: fonts.display,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    color: colors.ink,
  },
  active: { color: colors.accent, fontWeight: '700' },
  rule: { height: 2, marginTop: space.xs, backgroundColor: colors.ink },
})
