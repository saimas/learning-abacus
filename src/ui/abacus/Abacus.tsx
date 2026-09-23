import { StyleSheet, View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { BeadRef, Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { colors } from '@/ui/theme'
import { FadeLayer, showsFrame } from './FadeLayer'
import { DeckLines, FrameBackground } from './Frame'
import { geometryFor } from './geometry'
import { Rod } from './Rod'

// Controlled: the parent owns the soroban. With onTapBead and onAdjustRod the
// rods take taps and VoiceOver adjustments. Without them it is the static
// soroban the keypad levels show. `highlightRods` (rod indices, highest place
// first) puts a soft band behind those rods' columns.
export function Abacus({
  soroban,
  fade,
  scale = 1,
  highlightRods,
  onTapBead,
  onAdjustRod,
}: {
  soroban: Soroban
  fade: FadeLevel
  scale?: number
  highlightRods?: readonly number[]
  onTapBead?: (rodIndex: number, bead: BeadRef) => void
  onAdjustRod?: (rodIndex: number, delta: number) => void
}) {
  const strings = useStrings()
  const g = geometryFor(scale)
  // Visibility resolves here and nowhere else. Bead and Rod never see a FadeLevel.
  const visual = visualForFade(fade)
  const framed = showsFrame(visual)
  const count = soroban.rods.length

  return (
    <View
      testID={framed ? 'abacus-frame' : 'abacus-blank'}
      style={[styles.frame, { padding: g.framePadding, borderRadius: g.frameRadius }, framed && styles.framed]}
    >
      {framed ? <FrameBackground scale={scale} /> : null}
      <View style={[styles.deck, { paddingHorizontal: g.deckPadding }, framed && styles.deckFilled]}>
        {framed ? <DeckLines rodCount={count} scale={scale} highlight={highlightRods} /> : null}
        {/* Only the beads fade. At F6 nothing above is drawn, but the bead
            columns still take their space, so the screen does not jump. */}
        <FadeLayer level={fade}>
          <View style={styles.rods}>
            {soroban.rods.map((rod, index) => (
              <Rod
                key={index}
                rod={rod}
                index={index}
                scale={scale}
                label={strings.rodName(count - 1 - index)}
                onTapBead={onTapBead === undefined ? undefined : (bead) => onTapBead(index, bead)}
                onAdjust={onAdjustRod === undefined ? undefined : (delta) => onAdjustRod(index, delta)}
              />
            ))}
          </View>
        </FadeLayer>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  framed: {
    backgroundColor: colors.frameBottom,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  deck: { borderRadius: 8 },
  deckFilled: { backgroundColor: colors.deck },
  rods: { flexDirection: 'row' },
})
