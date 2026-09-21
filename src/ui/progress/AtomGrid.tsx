import { StyleSheet, Text, View } from 'react-native'
import { ATOMS, atomId, classify, type AtomClass, type Direction } from '@/domain/atoms'
import { isReflex, type AtomRecord } from '@/domain/fluency'
import { MAX_FADE } from '@/domain/fade'
import type { Progress } from '@/domain/progress'
import { useStrings } from '@/i18n'
import { cellColors, colors, fonts, fontSizes, space } from '@/ui/theme'

export type CellState = 'unseen' | 'learning' | 'reflex' | 'mental'

const CELL_STATES: readonly CellState[] = ['unseen', 'learning', 'reflex', 'mental']
const ROD_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const OPERANDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
const DIRECTIONS: readonly Direction[] = ['add', 'sub']

export function cellState(
  record: AtomRecord | undefined,
  cls: AtomClass,
  calibrationMs: number,
): CellState {
  if (record === undefined) return 'unseen'
  const fluent = isReflex(record, cls, calibrationMs)
  if (fluent && record.fade >= MAX_FADE) return 'mental'
  if (fluent) return 'reflex'
  return 'learning'
}

export function atomStates(progress: Progress): Record<string, CellState> {
  return Object.fromEntries(
    ATOMS.map((atom) => [
      atom.id,
      cellState(progress.atoms[atom.id], classify(atom), progress.calibrationMs),
    ]),
  )
}

export function mentalCount(states: Record<string, CellState>): number {
  return Object.values(states).filter((state) => state === 'mental').length
}

// One direction's 90 atoms as a 10 × 9 grid: rows are the rod's value before
// the move (0–9), columns the operand (1–9). Every atom has a fixed cell, so
// the technique regions show: direct moves fill in first, then the 5- and
// 10-complement areas.
function AtomMap({
  direction,
  states,
  compact,
}: {
  direction: Direction
  states: Record<string, CellState>
  compact: boolean
}) {
  const strings = useStrings()
  return (
    <View testID={`atom-map-${direction}`} style={styles.map}>
      {compact ? null : (
        <>
          <Text style={styles.mapTitle}>{direction === 'add' ? strings.mapAdd : strings.mapSub}</Text>
          <View style={styles.row}>
            <View style={styles.axis} />
            {OPERANDS.map((operand) => (
              <Text key={operand} style={[styles.slot, styles.axisText]}>
                {operand}
              </Text>
            ))}
          </View>
        </>
      )}
      {ROD_VALUES.map((rodValue) => (
        <View key={rodValue} testID={`atom-row-${direction}-${rodValue}`} style={styles.row}>
          {compact ? null : <Text style={[styles.axis, styles.axisText]}>{rodValue}</Text>}
          {OPERANDS.map((operand) => {
            const id = atomId(rodValue, operand, direction)
            const state = states[id] ?? 'unseen'
            const fill = { backgroundColor: cellColors[state] }
            return compact ? (
              <View key={id} testID={`preview-cell-${id}`} style={[styles.slot, styles.cell, fill]} />
            ) : (
              <View
                key={id}
                testID={`atom-cell-${id}`}
                accessible={true}
                accessibilityLabel={strings.cellLabel(id, state)}
                style={[styles.slot, styles.cell, fill]}
              />
            )
          })}
        </View>
      ))}
    </View>
  )
}

export function AtomGrid({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const strings = useStrings()
  const states = atomStates(progress)
  const summary = strings.atomSummary(mentalCount(states), ATOMS.length)

  if (compact) {
    // A glance, not a place to explore: one screen-reader stop for all 180.
    return (
      <View testID="atom-preview" accessible accessibilityLabel={summary} style={styles.maps}>
        {DIRECTIONS.map((direction) => (
          <AtomMap key={direction} direction={direction} states={states} compact />
        ))}
      </View>
    )
  }

  return (
    <View>
      <Text testID="atom-summary" style={styles.summary}>
        {summary}
      </Text>
      <View style={styles.legend}>
        {CELL_STATES.map((state) => (
          <View key={state} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: cellColors[state] }]} />
            <Text style={styles.legendText}>{strings.cellStateName(state)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.maps}>
        {DIRECTIONS.map((direction) => (
          <AtomMap key={direction} direction={direction} states={states} compact={false} />
        ))}
      </View>
      <Text style={styles.caption}>{strings.mapAxis}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: fontSizes.caption, color: colors.muted },
  maps: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  map: { flex: 1 },
  mapTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.small,
    color: colors.ink,
    marginBottom: space.xs,
    marginLeft: 14,
  },
  row: { flexDirection: 'row' },
  axis: { width: 12 },
  axisText: { fontSize: 8, color: colors.muted, textAlign: 'center' },
  slot: { flex: 1, margin: 1 },
  cell: { aspectRatio: 1, borderRadius: 2 },
  caption: { marginTop: space.sm, fontSize: 10, color: colors.muted, lineHeight: 15 },
})
