import { View } from 'react-native'
import { visualForFade, type FadeLevel } from '@/domain/fade'
import type { Soroban } from '@/domain/soroban'
import { FadeLayer, showsFrame } from './FadeLayer'
import { Rod } from './Rod'

export function Abacus({
  soroban,
  fade,
  onBeadPress,
}: {
  soroban: Soroban
  fade: FadeLevel
  onBeadPress?: (rodIndex: number, kind: 'heaven' | 'earth', beadIndex: number) => void
}) {
  // Visibility resolves here and nowhere else. Bead and Rod never see a FadeLevel.
  const visual = visualForFade(fade)

  return (
    <View
      testID={showsFrame(visual) ? 'abacus-frame' : 'abacus-blank'}
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        padding: 12,
        borderWidth: showsFrame(visual) ? 2 : 0,
        borderColor: '#5C4033',
        borderRadius: 8,
      }}
    >
      <FadeLayer level={fade}>
        <View style={{ flexDirection: 'row' }}>
          {soroban.rods.map((rod, index) => (
            <Rod
              key={index}
              rod={rod}
              index={index}
              onBeadPress={(kind, beadIndex) => onBeadPress?.(index, kind, beadIndex)}
            />
          ))}
        </View>
      </FadeLayer>
    </View>
  )
}
