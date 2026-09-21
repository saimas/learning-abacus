import { StyleSheet, View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { Soroban } from '@/domain/soroban'
import { colors } from '@/ui/theme'
import { FadeLayer, showsFrame } from './FadeLayer'
import { DeckLines, FrameBackground } from './Frame'
import { DECK_PADDING, FRAME_PADDING, FRAME_RADIUS } from './geometry'
import { Rod } from './Rod'

export function Abacus({ soroban, fade }: { soroban: Soroban; fade: FadeLevel }) {
  // Visibility resolves here and nowhere else. Bead and Rod never see a FadeLevel.
  const visual = visualForFade(fade)
  const framed = showsFrame(visual)

  return (
    <View
      testID={framed ? 'abacus-frame' : 'abacus-blank'}
      style={[styles.frame, framed && styles.framed]}
    >
      {framed ? <FrameBackground /> : null}
      <View style={[styles.deck, framed && styles.deckFilled]}>
        {framed ? <DeckLines rodCount={soroban.rods.length} /> : null}
        {/* Only the beads fade. At F6 nothing above is drawn, but the bead
            columns still take their space, so the screen does not jump. */}
        <FadeLayer level={fade}>
          <View style={styles.rods}>
            {soroban.rods.map((rod, index) => (
              <Rod key={index} rod={rod} index={index} />
            ))}
          </View>
        </FadeLayer>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', padding: FRAME_PADDING, borderRadius: FRAME_RADIUS },
  framed: {
    backgroundColor: colors.frameBottom,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  deck: { paddingHorizontal: DECK_PADDING, borderRadius: 8 },
  deckFilled: { backgroundColor: colors.deck },
  rods: { flexDirection: 'row' },
})
