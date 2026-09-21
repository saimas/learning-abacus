import { useEffect, useState } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { colors } from '@/ui/theme'

// A teacher's red 〇, drawn and gone in 600ms. Decoration only: the next
// question is already on screen and taking input while it fades, so the
// latency the fluency model records is untouched.
export function Maru() {
  const [opacity] = useState(() => new Animated.Value(0.6))

  useEffect(() => {
    Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: false }).start()
  }, [opacity])

  return <Animated.View testID="maru" pointerEvents="none" style={[styles.maru, { opacity }]} />
}

const styles = StyleSheet.create({
  maru: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.accent,
    transform: [{ rotate: '-8deg' }],
  },
})
