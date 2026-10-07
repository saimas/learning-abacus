import { StyleSheet, Text, View } from 'react-native'
import { practiceStage } from '@/domain/practice'
import { DIGITS, OPERATION_SYMBOL, OPERATIONS, practiceId, type PracticeKind } from '@/domain/problem'
import type { Progress } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { colors, fonts, fontSizes, space } from '@/ui/theme'
import { STAGE_COLOR, stageInk } from './stageColor'

// Spec (multi-digit ＋ −) §6: a row per operation, a column per size, each
// cell in its stage's colour. The progress screen's table, read-only. Home
// used it as its grid of buttons until it became a menu of operations, whose
// pages start the runs now (spec (home menu) §2–3, §5).
export function PracticeTable({ progress }: { progress: Progress }) {
  const strings = useStrings()
  return (
    <View testID="practice-table" style={styles.table}>
      <Text style={styles.title}>{strings.roundSection}</Text>
      <View style={styles.row}>
        <View style={styles.head} />
        {DIGITS.map((digits) => (
          <Text key={digits} style={[styles.cellBox, styles.axis]}>
            {strings.digitsName(digits)}
          </Text>
        ))}
      </View>
      {OPERATIONS.map((op) => (
        <View key={op} style={styles.row}>
          <Text style={[styles.head, styles.axis]}>{OPERATION_SYMBOL[op]}</Text>
          {DIGITS.map((digits) => {
            const kind: PracticeKind = { op, digits }
            const record = progress.practices[practiceId(kind)]
            const stage = practiceStage(record)
            const ink = { color: stageInk(stage) }
            const testID = `practice-cell-${practiceId(kind)}`
            const label = strings.practiceCellLabel(kind, stage, record?.fade)
            // The owner (2026-09-30): a practised kind shows its level under
            // its word, drawn like the word, so it reads on every colour.
            const text = (
              <>
                <Text style={[styles.cellText, ink]}>{strings.practiceStageName(stage)}</Text>
                {record === undefined ? null : (
                  <Text testID={`practice-level-${practiceId(kind)}`} style={[styles.cellText, ink]}>
                    {strings.levelName(record.fade)}
                  </Text>
                )}
              </>
            )
            return (
              <View
                key={digits}
                testID={testID}
                accessible
                accessibilityLabel={label}
                style={[styles.cellBox, styles.cell, { backgroundColor: STAGE_COLOR[stage] }]}
              >
                {text}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  table: { marginTop: space.xl, gap: space.xs },
  title: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink, marginBottom: space.xs },
  row: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  head: { width: 24 },
  axis: { fontSize: fontSizes.caption, color: colors.muted, textAlign: 'center' },
  cellBox: { flex: 1 },
  // At least 36 pt, and taller when a level's second line needs it at a
  // large text size.
  cell: { minHeight: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: fontSizes.caption, color: colors.ink },
})
