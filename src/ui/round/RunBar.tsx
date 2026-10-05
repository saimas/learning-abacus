import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { RUN_LIVES } from '@/domain/run'
import { comboFactor } from '@/domain/score'
import { useStrings } from '@/i18n'
import { Icon } from '@/ui/kit/Icon'
import { colors, fontSizes, space } from '@/ui/theme'

export const LIFE_DROP_MS = 400
export const COMBO_PULSE_MS = 220

// Spec (runs) §5: the run's bar, in place of a round's ten segments: ✕, the
// lives left as beads, the level of the problem on show, and the score.
// Under it, the combo once there is one; its row keeps its height either
// way, so nothing below moves as it comes and goes. VoiceOver reads the
// lives, level and score as one line; ✕ stays a button of its own.
// Right after ✕, ‹ looks back at the problem before (the owner, 2026-10-06),
// given `onBack` while there is one to look back at.
export function RunBar({
  lives,
  level,
  score,
  combo,
  reduceMotion,
  onQuit,
  onBack,
}: {
  lives: number
  level: FadeLevel
  score: number
  combo: number
  reduceMotion: boolean
  onQuit?: () => void
  onBack?: () => void
}) {
  const strings = useStrings()
  return (
    <View>
      <View style={styles.bar}>
        {onQuit !== undefined ? (
          <Pressable
            testID="quit"
            accessibilityRole="button"
            accessibilityLabel={strings.quitLabel}
            onPress={onQuit}
            hitSlop={12}
          >
            <Icon name="close" size={BAR_ICON_SIZE} />
          </Pressable>
        ) : null}
        {/* ‹'s place is kept while it is not offered (before the first
            answer, and while a card moves), so the lives beside it do not
            shift each time it comes and goes, as the combo's row keeps its
            height. A placeholder in its stead rather than a box around it,
            which would cut its hitSlop short. */}
        {onBack !== undefined ? (
          <Pressable
            testID="look-back"
            accessibilityRole="button"
            accessibilityLabel={strings.lookBackLabel}
            onPress={onBack}
            hitSlop={12}
          >
            <Icon name="back" size={BAR_ICON_SIZE} />
          </Pressable>
        ) : (
          <View style={styles.backPlace} />
        )}
        <View
          testID="run-status"
          accessible
          accessibilityLabel={strings.runBarLabel(lives, level, score)}
          style={styles.status}
        >
          <View style={styles.lives}>
            {Array.from({ length: RUN_LIVES }, (_, i) => (
              <LifeBead key={i} alive={i < lives} reduceMotion={reduceMotion} />
            ))}
          </View>
          <Text testID="run-level" style={styles.label}>
            {strings.roundLevel(level)}
          </Text>
          <Text testID="run-score" style={styles.score}>
            {strings.runScore(score)}
          </Text>
        </View>
      </View>
      <View style={styles.comboRow}>{combo >= 2 ? <Combo combo={combo} reduceMotion={reduceMotion} /> : null}</View>
    </View>
  )
}

// A life: a bead while it lasts. Lost, it drops away and leaves its ring
// (with Reduce Motion, it fades where it is).
function LifeBead({ alive, reduceMotion }: { alive: boolean; reduceMotion: boolean }) {
  const [gone] = useState(() => new Animated.Value(alive ? 0 : 1))
  useEffect(() => {
    const dropping = Animated.timing(gone, { toValue: alive ? 0 : 1, duration: LIFE_DROP_MS, useNativeDriver: true })
    dropping.start()
    return () => dropping.stop()
  }, [alive, gone])
  const opacity = gone.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  const transform = reduceMotion ? [] : [{ translateY: gone.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) }]
  return (
    <View testID={alive ? 'life' : 'life-lost'} style={styles.life}>
      <View style={styles.ring} />
      <Animated.View style={[styles.bead, { opacity, transform }]} />
    </View>
  )
}

// The combo swells a little each time it grows (with Reduce Motion, it dims
// and brightens instead).
function Combo({ combo, reduceMotion }: { combo: number; reduceMotion: boolean }) {
  const strings = useStrings()
  const [pulse] = useState(() => new Animated.Value(0))
  useEffect(() => {
    pulse.setValue(1)
    const settling = Animated.timing(pulse, { toValue: 0, duration: COMBO_PULSE_MS, useNativeDriver: true })
    settling.start()
    return () => settling.stop()
  }, [combo, pulse])
  const style = reduceMotion
    ? { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) }
    : { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }
  return (
    <Animated.Text testID="run-combo" style={[styles.combo, style]}>
      {strings.runCombo(combo, comboFactor(combo))}
    </Animated.Text>
  )
}

const LIFE_SIZE = 12
// ✕'s and ‹'s icons.
const BAR_ICON_SIZE = 18

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 28 },
  backPlace: { width: BAR_ICON_SIZE, height: BAR_ICON_SIZE },
  status: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  lives: { flex: 1, flexDirection: 'row', gap: 6 },
  life: { width: LIFE_SIZE, height: LIFE_SIZE },
  ring: { ...StyleSheet.absoluteFill, borderRadius: LIFE_SIZE / 2, borderWidth: 1.5, borderColor: colors.bead },
  bead: { ...StyleSheet.absoluteFill, borderRadius: LIFE_SIZE / 2, backgroundColor: colors.bead },
  label: { fontSize: fontSizes.small, color: colors.muted },
  score: { fontSize: fontSizes.body, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  comboRow: { height: 22, alignItems: 'center', justifyContent: 'center' },
  combo: { fontSize: fontSizes.small, fontWeight: '600', color: colors.accent },
})
