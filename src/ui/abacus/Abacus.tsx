import { StyleSheet, View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { StepColouring } from '@/domain/exercise'
import type { BeadRef, PlacedBead, Soroban } from '@/domain/soroban'
import { useStrings } from '@/i18n'
import { colors } from '@/ui/theme'
import type { BeadTint } from './Bead'
import { FadeLayer, showsFrame } from './FadeLayer'
import { DeckLines, FrameBackground } from './Frame'
import { geometryFor } from './geometry'
import { Rod } from './Rod'

// A bead to draw red while stepping, and which red.
export type TintedBead = PlacedBead & { tint: BeadTint }

// The owner's request (2026-09-23): the beads the current operation has moved
// so far are red, the latest step's the deepest. The latest step's beads are
// in the operation's too, and the rod draws a bead listed as both 'latest'.
export function tintsFor(colouring: StepColouring): TintedBead[] {
  return [
    ...colouring.group.map((placed): TintedBead => ({ ...placed, tint: 'group' })),
    ...colouring.latest.map((placed): TintedBead => ({ ...placed, tint: 'latest' })),
  ]
}

// Controlled: the parent owns the soroban. With onTapBead and onAdjustRod the
// rods take taps and VoiceOver adjustments. Without them it is the static
// soroban the keypad levels show. `highlightRods` (rod indices, highest place
// first) puts a soft band behind those rods' columns. `tintedBeads` draws
// those beads red instead of wood, for stepping through a move.
export function Abacus({
  soroban,
  fade,
  scale = 1,
  highlightRods,
  tintedBeads,
  onTapBead,
  onAdjustRod,
}: {
  soroban: Soroban
  fade: FadeLevel
  scale?: number
  highlightRods?: readonly number[]
  tintedBeads?: readonly TintedBead[]
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
                tints={tintedBeads?.filter((tinted) => tinted.rod === index)}
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
