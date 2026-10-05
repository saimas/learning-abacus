import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, Text } from 'react-native'
import type { FadeLevel } from '@/domain/fade'
import { useStrings } from '@/i18n'
import { colors, fonts, fontSizes, radius, space } from '@/ui/theme'

// Spec (runs) §5: a right answer's points float up from its 〇 during the
// hold before its card goes. Hidden from VoiceOver: points are not announced
// per answer.
export const FLOAT_MS = 650
// A moved level's banner, over the card it moved for. Its fade out is not
// ROLL_SWIPE_MS (300) long, which the swipe tests look for.
export const BANNER_MS = 1_400
const BANNER_IN_MS = 180
const BANNER_OUT_MS = 280

export function PointsFloat({ points, reduceMotion }: { points: number; reduceMotion: boolean }) {
  const strings = useStrings()
  const [rise] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const rising = Animated.timing(rise, {
      toValue: 1,
      duration: FLOAT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    })
    rising.start()
    return () => rising.stop()
  }, [rise])
  const opacity = rise.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })
  // With Reduce Motion it fades where it stands.
  const transform = reduceMotion ? [] : [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -36] }) }]
  return (
    <Animated.Text
      testID="points-float"
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.float, { opacity, transform }]}
    >
      {strings.pointsEarned(points)}
    </Animated.Text>
  )
}

// Hidden from VoiceOver: the runner announces the level itself.
export function LevelBanner({ level, reduceMotion }: { level: FadeLevel; reduceMotion: boolean }) {
  const strings = useStrings()
  const [shown] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const showing = Animated.sequence([
      Animated.timing(shown, { toValue: 1, duration: BANNER_IN_MS, useNativeDriver: true }),
      Animated.delay(BANNER_MS - BANNER_IN_MS - BANNER_OUT_MS),
      Animated.timing(shown, { toValue: 0, duration: BANNER_OUT_MS, useNativeDriver: true }),
    ])
    showing.start()
    return () => showing.stop()
  }, [shown])
  const transform = reduceMotion ? [] : [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }]
  return (
    <Animated.View
      testID="level-banner"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.banner, { opacity: shown, transform }]}
    >
      <Text style={styles.bannerText}>{strings.levelName(level)}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  float: { fontFamily: fonts.display, fontSize: 28, color: colors.accent },
  banner: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.panel,
    backgroundColor: colors.ink,
  },
  bannerText: { fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.onAccent },
})
