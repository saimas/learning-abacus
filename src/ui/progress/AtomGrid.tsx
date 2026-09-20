import { Text, View } from 'react-native'
import { ATOMS, classify, type AtomClass } from '@/domain/atoms'
import { isReflex, type AtomRecord } from '@/domain/fluency'
import { MAX_FADE } from '@/domain/fade'
import type { Progress } from '@/domain/progress'
import { useStrings } from '@/i18n'

export type CellState = 'unseen' | 'learning' | 'reflex' | 'mental'

const CELL_COLOR: Record<CellState, string> = {
  unseen: '#E8E4DC',
  learning: '#F0C36D',
  reflex: '#7FB069',
  mental: '#2E6E4E',
}

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

export function AtomGrid({ progress }: { progress: Progress }) {
  const strings = useStrings()
  const states = ATOMS.map((atom) =>
    cellState(progress.atoms[atom.id], classify(atom), progress.calibrationMs),
  )
  const mental = states.filter((s) => s === 'mental').length

  return (
    <View>
      <Text testID="atom-summary">{strings.atomSummary(mental, ATOMS.length)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {ATOMS.map((atom, index) => (
          <View
            key={atom.id}
            testID={`atom-cell-${atom.id}`}
            accessible={true}
            accessibilityLabel={strings.cellLabel(atom.id, states[index] ?? 'unseen')}
            style={{
              width: 16,
              height: 16,
              margin: 1,
              borderRadius: 3,
              backgroundColor: CELL_COLOR[states[index] ?? 'unseen'],
            }}
          />
        ))}
      </View>
    </View>
  )
}
