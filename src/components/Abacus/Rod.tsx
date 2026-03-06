import React from "react";
import { StyleSheet, View } from "react-native";
import { BeadState } from "../../models/abacus";
import { colors } from "../../theme/colors";
import { Bead } from "./Bead";

const UPPER_OFFSET = 28;
const LOWER_OFFSET = -28;

const BEAD_SIZE = 32;

type RodProps = {
  upper: BeadState;
  lowers: BeadState[];
  onToggleUpper: () => void;
  onToggleLower: (beadIndex: number) => void;
};

export const Rod = ({ upper, lowers, onToggleUpper, onToggleLower }: RodProps) => {
  return (
    <View style={styles.rodContainer}>
      <View style={styles.upperDeck}>
        <Bead
          active={upper.active}
          size={BEAD_SIZE}
          offset={UPPER_OFFSET}
          onPress={onToggleUpper}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.lowerDeck}>
        {lowers.map((bead) => (
          <Bead
            key={bead.id}
            active={bead.active}
            size={BEAD_SIZE}
            offset={LOWER_OFFSET}
            onPress={() => onToggleLower(bead.index)}
            style={styles.lowerBead}
          />
        ))}
      </View>
      <View style={styles.rod} />
    </View>
  );
};

const styles = StyleSheet.create({
  rodContainer: {
    alignItems: "center",
    marginHorizontal: 6,
  },
  rod: {
    position: "absolute",
    width: 6,
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  upperDeck: {
    paddingVertical: 6,
    minHeight: 80,
    justifyContent: "center",
  },
  lowerDeck: {
    paddingVertical: 6,
    minHeight: 160,
    justifyContent: "space-between",
  },
  divider: {
    width: 48,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.wood,
    marginVertical: 4,
  },
  lowerBead: {
    marginVertical: 4,
  },
});
