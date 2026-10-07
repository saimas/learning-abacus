import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useStrings } from '@/i18n'
import { SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { colors, fonts, fontSizes } from '@/ui/theme'

// A flashed number's size: large (spec (flash) §2), and within the five
// lines of the column whose height the prompt holds: about 190 pt at the
// column's 28 pt, about 150 pt at its 22 pt on a 375 × 667 phone.
export const FLASH_FONT_SIZE = 64
export const FLASH_SHORT_FONT_SIZE = 44

// Spec (flash) §2, §4: a フラッシュ暗算 problem in the prompt's place. While
// the flash plays, the number on show (`shown`, an index into `terms`),
// large, under its counter (「1/5」), or nothing before and between
// numbers. Once it is over, nothing: the numbers are not seen again, as in
// real フラッシュ暗算, until the step panel opens (`columnShown`: 手順を見る,
// or a miss's review), where they stand as 見取算's column, the number
// stepped to lit (`activeTerm`) and read as one sentence (`columnLabel`).
// Whatever it shows, it takes that column's height: the column is drawn
// unseen underneath and hidden from VoiceOver, so the soroban below never
// moves as numbers come and go or the panel opens (the owner, 2026-09-24,
// found the soroban moving distracting). VoiceOver reads the box as the
// problem's name (`label`); each number is announced as it appears
// (QuestionView).
export function FlashPrompt({
  terms,
  label,
  columnLabel,
  shown,
  columnShown,
  activeTerm,
}: {
  terms: readonly number[]
  label: string
  columnLabel: string
  shown: number | null
  columnShown: boolean
  activeTerm?: number
}) {
  const strings = useStrings()
  const { height } = useWindowDimensions()
  if (columnShown) return <TermColumn terms={terms} label={columnLabel} activeTerm={activeTerm} />
  const term = shown === null ? undefined : terms[shown]
  const fontSize = height < SHORT_WINDOW_HEIGHT ? FLASH_SHORT_FONT_SIZE : FLASH_FONT_SIZE
  return (
    <View testID="prompt" accessible accessibilityLabel={label}>
      <View
        testID="flash-column-space"
        style={styles.unseen}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TermColumn terms={terms} label={columnLabel} />
      </View>
      {shown === null || term === undefined ? null : (
        <View style={styles.flash} pointerEvents="none">
          <Text testID="flash-counter" style={styles.counter}>
            {strings.flashCounter(shown + 1, terms.length)}
          </Text>
          <Text testID="flash-number" style={[styles.number, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}>
            {String(term)}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // Holds the column's height without showing it.
  unseen: { opacity: 0 },
  // Over the unseen column, centred in it.
  flash: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  counter: { fontSize: fontSizes.small, color: colors.muted },
  number: { fontFamily: fonts.display, fontVariant: ['tabular-nums'], color: colors.ink },
})
