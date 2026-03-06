import { AbacusState, BeadState, RodState } from "../models/abacus";

const LOWER_BEAD_COUNT = 4;

const createBead = (kind: BeadState["kind"], index: number): BeadState => ({
  id: `${kind}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  active: false,
  kind,
  index,
});

export const createRod = (rodIndex: number): RodState => ({
  id: `rod-${rodIndex}`,
  upper: createBead("upper", 0),
  lowers: Array.from({ length: LOWER_BEAD_COUNT }, (_, index) =>
    createBead("lower", index)
  ),
});

export const createAbacus = (rodCount: number): AbacusState => ({
  rods: Array.from({ length: rodCount }, (_, index) => createRod(index)),
});

export const toggleUpper = (state: AbacusState, rodIndex: number): AbacusState => {
  const rods = state.rods.map((rod, index) => {
    if (index !== rodIndex) return rod;
    return {
      ...rod,
      upper: {
        ...rod.upper,
        active: !rod.upper.active,
      },
    };
  });

  return { rods };
};

export const toggleLower = (
  state: AbacusState,
  rodIndex: number,
  beadIndex: number
): AbacusState => {
  const rods = state.rods.map((rod, index) => {
    if (index !== rodIndex) return rod;

    const shouldActivate = !rod.lowers[beadIndex].active;
    const lowers = rod.lowers.map((bead) => {
      if (shouldActivate) {
        return {
          ...bead,
          active: bead.index <= beadIndex,
        };
      }

      return {
        ...bead,
        active: bead.index < beadIndex ? bead.active : false,
      };
    });

    return { ...rod, lowers };
  });

  return { rods };
};

export const getRodValue = (rod: RodState): number => {
  const lowerActiveCount = rod.lowers.filter((bead) => bead.active).length;
  return (rod.upper.active ? 5 : 0) + lowerActiveCount;
};

export const getAbacusValue = (state: AbacusState): number => {
  return state.rods.reduce((total, rod, index) => {
    const rodValue = getRodValue(rod);
    const place = Math.pow(10, state.rods.length - index - 1);
    return total + rodValue * place;
  }, 0);
};

export const applyNumberToAbacus = (
  state: AbacusState,
  value: number
): AbacusState => {
  const digits = value
    .toString()
    .padStart(state.rods.length, "0")
    .split("")
    .map(Number);

  const rods = state.rods.map((rod, index) => {
    const digit = digits[index] ?? 0;
    const upperActive = digit >= 5;
    const lowerCount = digit % 5;

    return {
      ...rod,
      upper: { ...rod.upper, active: upperActive },
      lowers: rod.lowers.map((bead) => ({
        ...bead,
        active: bead.index < lowerCount,
      })),
    };
  });

  return { rods };
};
