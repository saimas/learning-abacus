import { StyleSheet, Text, View } from 'react-native'
import { MAX_FADE } from '@/domain/fade'
import type { PracticeRecord } from '@/domain/practice'
import { DIGITS, OPERATION_SYMBOL, OPERATIONS, practiceId } from '@/domain/problem'
import type { Progress } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { cellColors, colors, fonts, fontSizes, space } from '@/ui/theme'

// Where a practice kind stands, named for what the learner does at it:
// not tried yet, answering on the beads (F0–F2), answering from faded beads
// (F3–F5), or mental (F6).
export type PracticeStage = 'unseen' | 'beads' | 'fading' | 'mental'

export function practiceStage(record: PracticeRecord | undefined): PracticeStage {
  if (record === undefined) return 'unseen'
  if (record.fade >= MAX_FADE) return 'mental'
  if (record.fade >= 3) return 'fading'
  return 'beads'
}

// The atom map's four colours, in the same order of progress.
const STAGE_COLOR: Record<PracticeStage, string> = {
  unseen: cellColors.unseen,
  beads: cellColors.learning,
  fading: cellColors.reflex,
  mental: cellColors.mental,
}

// Spec (multi-digit ＋ −) §6: a row per operation, a column per size.
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
            const kind = { op, digits }
            const stage = practiceStage(progress.practices[practiceId(kind)])
            // Only the mental stage's dark background needs light text for contrast.
            const onDark = stage === 'mental'
            return (
              <View
                key={digits}
                testID={`practice-cell-${practiceId(kind)}`}
                accessible
                accessibilityLabel={strings.practiceCellLabel(kind, stage)}
                style={[styles.cellBox, styles.cell, { backgroundColor: STAGE_COLOR[stage] }]}
              >
                <Text style={[styles.cellText, onDark && styles.cellTextDark]}>{strings.practiceStageName(stage)}</Text>
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
  cell: { height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: fontSizes.caption, color: colors.ink },
  cellTextDark: { color: colors.paper },
})
