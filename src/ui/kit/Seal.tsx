import { useEffect, useState } from 'react'
import { Animated, Easing, StyleSheet, Text } from 'react-native'
import { colors, fonts } from '@/ui/theme'

export type SealState = 'empty' | 'outline' | 'stamped'

// The hanko. `empty` is a dashed ring with nothing pressed yet, `outline` is a
// seal waiting to be stamped, `stamped` is filled in. `animateIn` presses it
// down once, on mount.
export function Seal({
  text,
  state,
  size = 54,
  animateIn = false,
  testID,
}: {
  text: string
  state: SealState
  size?: number
  animateIn?: boolean
  testID?: string
}) {
  const [scale] = useState(() => new Animated.Value(animateIn ? 1.4 : 1))
  const [opacity] = useState(() => new Animated.Value(animateIn ? 0 : 1))

  useEffect(() => {
    if (!animateIn) return
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: false,
      }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start()
  }, [animateIn, scale, opacity])

  const stamped = state === 'stamped'
  const large = size >= 100
  return (
    <Animated.View
      testID={testID}
      style={[
        styles.seal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: large ? 4 : 2.5,
          borderStyle: state === 'empty' ? 'dashed' : 'solid',
          backgroundColor: stamped ? colors.accent : 'transparent',
          opacity,
          transform: [{ rotate: '-6deg' }, { scale }],
        },
      ]}
    >
      {text === '' ? null : (
        <Text
          // The seal is a fixed-size circle; Dynamic Type must not push the
          // text out of it.
          maxFontSizeMultiplier={1.3}
          style={[
            styles.text,
            {
              color: stamped ? colors.onAccent : colors.accent,
              fontSize: large ? size * 0.37 : size * 0.26,
              lineHeight: large ? size * 0.45 : size * 0.3,
            },
          ]}
        >
          {text}
        </Text>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  seal: { alignItems: 'center', justifyContent: 'center', borderColor: colors.accent },
  text: { fontFamily: fonts.display, textAlign: 'center' },
})
