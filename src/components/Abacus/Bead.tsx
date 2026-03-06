import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../theme/colors";

const ANIMATION_DURATION = 180;

type BeadProps = {
  active: boolean;
  size: number;
  offset: number;
  onPress: () => void;
  style?: ViewStyle;
};

export const Bead = ({ active, size, offset, onPress, style }: BeadProps) => {
  const translateY = useRef(new Animated.Value(active ? offset : 0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: active ? offset : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [active, offset, translateY]);

  return (
    <Pressable onPress={onPress} style={[styles.hitArea, style]}>
      <Animated.View
        style={[
          styles.bead,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ translateY }],
          },
        ]}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hitArea: {
    alignItems: "center",
    justifyContent: "center",
  },
  bead: {
    backgroundColor: colors.bead,
    borderWidth: 2,
    borderColor: colors.beadHighlight,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
