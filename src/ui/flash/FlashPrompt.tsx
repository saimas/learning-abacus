import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useStrings } from '@/i18n'
import { SHORT_WINDOW_HEIGHT } from '@/ui/abacus/geometry'
import { TermColumn } from '@/ui/mitori/TermColumn'
import { colors, fonts, fontSizes, space } from '@/ui/theme'

// A flashed number's size: large (spec (flash) §2), and within the five
// lines of the column whose height the prompt holds: about 190 pt at the
// column's 28 pt, about 150 pt at its 22 pt on a 375 × 667 phone.
export const FLASH_FONT_SIZE = 64
export const FLASH_SHORT_FONT_SIZE = 44

// How far the line after the flash grows with the text size. Its first half,
// 「5つめの数を珠でたして、」, must stay on one line on a 375 pt phone: at
// the largest standard size, uncapped, it broke before 「て、」, and
// shrinking the text to fit two lines (adjustsFontSizeToFit) cut off the
// second half instead.
export const ADD_LAST_TEXT_CAP = 1.1

// Spec (flash) §2, §4: a フラッシュ暗算 problem in the prompt's place. While
// the flash plays, the number on show (`shown`, an index into `terms`),
// large, under its counter (「1/5」), or nothing before and between
// numbers. Once it is over, and until the answer is in (`answering`), one
// line says what is left to do (spec (home menu) §4): the owner, 2026-10-07,
// took こたえる and もどす for broken, with nothing on screen saying the
// fifth number was theirs to add on the beads. The numbers are not seen
// again, unless the learner plays the flash again (もう一度見る, the owner,
// 2026-10-08), until the step panel opens
// (`columnShown`: 手順を見る, or a miss's review), where they stand as
// 見取算's column, the number stepped to lit (`activeTerm`) and read as one
// sentence (`columnLabel`); the line gives way to it. Whatever it shows, it
// takes that column's height: the column is drawn unseen underneath and
// hidden from VoiceOver, so the soroban below never moves as numbers come
// and go, the line appears or the panel opens (the owner, 2026-09-24, found
// the soroban moving distracting). VoiceOver reads the box as the problem's
// name (`label`); each number, then 「こたえてください」, is announced
// (QuestionView).
export function FlashPrompt({
  terms,
  label,
  columnLabel,
  shown,
  columnShown,
  answering,
  activeTerm,
}: {
  terms: readonly number[]
  label: string
  columnLabel: string
  shown: number | null
  columnShown: boolean
  answering: boolean
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
      {shown !== null && term !== undefined ? (
        <View style={styles.flash} pointerEvents="none">
          <Text testID="flash-counter" style={styles.counter}>
            {strings.flashCounter(shown + 1, terms.length)}
          </Text>
          <Text testID="flash-number" style={[styles.number, { fontSize, lineHeight: Math.round(fontSize * 1.2) }]}>
            {String(term)}
          </Text>
        </View>
      ) : answering ? (
        <View style={styles.flash} pointerEvents="none">
          <Text testID="flash-add-last" style={styles.addLast} maxFontSizeMultiplier={ADD_LAST_TEXT_CAP}>
            {strings.flashAddLast}
          </Text>
        </View>
      ) : null}
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
  // In the prompt's type, smaller: two lines, well within the column's five,
  // growing a little with the text size (ADD_LAST_TEXT_CAP).
  addLast: {
    paddingHorizontal: space.md,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: Math.round(fontSizes.title * 1.4),
    color: colors.ink,
  },
})
