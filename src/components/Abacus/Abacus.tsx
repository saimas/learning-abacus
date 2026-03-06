import React from "react";
import { StyleSheet, View } from "react-native";
import { AbacusState } from "../../models/abacus";
import { colors } from "../../theme/colors";
import { Rod } from "./Rod";

type AbacusProps = {
  state: AbacusState;
  onToggleUpper: (rodIndex: number) => void;
  onToggleLower: (rodIndex: number, beadIndex: number) => void;
};

export const Abacus = ({ state, onToggleUpper, onToggleLower }: AbacusProps) => {
  return (
    <View style={styles.frame}>
      {state.rods.map((rod, index) => (
        <Rod
          key={rod.id}
          upper={rod.upper}
          lowers={rod.lowers}
          onToggleUpper={() => onToggleUpper(index)}
          onToggleLower={(beadIndex) => onToggleLower(index, beadIndex)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.wood,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.accent,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
