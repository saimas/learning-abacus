import { AbacusState, BeadState, RodState } from "../models/abacus";

const LOWER_BEAD_COUNT = 4;

const createUpperBead = (): BeadState => ({
  id: "upper-0",
  active: false,
  kind: "upper",
  index: 0,
});

const createLowerBeads = (): BeadState[] =>
  Array.from({ length: LOWER_BEAD_COUNT }, (_, index) => ({
    id: `lower-${index}`,
    active: false,
    kind: "lower",
    index,
  }));

const updateRod = (
  state: AbacusState,
  rodIndex: number,
  updater: (rod: RodState) => RodState
): AbacusState => ({
  rods: state.rods.map((rod, index) => (index === rodIndex ? updater(rod) : rod)),
});

const getDigit = (value: number, rodIndex: number, rodCount: number): number => {
  const paddedDigits = value
    .toString()
    .padStart(rodCount, "0")
    .slice(-rodCount)
    .split("")
    .map(Number);

  return paddedDigits[rodIndex] ?? 0;
};

export const createRod = (rodIndex: number): RodState => ({
  id: `rod-${rodIndex}`,
  upper: createUpperBead(),
  lowers: createLowerBeads(),
});

export const createAbacus = (rodCount: number): AbacusState => ({
  rods: Array.from({ length: rodCount }, (_, index) => createRod(index)),
});

export const toggleUpper = (state: AbacusState, rodIndex: number): AbacusState =>
  updateRod(state, rodIndex, (rod) => ({
    ...rod,
    upper: {
      ...rod.upper,
      active: !rod.upper.active,
    },
  }));

export const toggleLower = (
  state: AbacusState,
  rodIndex: number,
  beadIndex: number
): AbacusState =>
  updateRod(state, rodIndex, (rod) => {
    const shouldActivate = !rod.lowers[beadIndex].active;

    return {
      ...rod,
      lowers: rod.lowers.map((bead) => ({
        ...bead,
        active: shouldActivate ? bead.index <= beadIndex : bead.index < beadIndex,
      })),
    };
  });

export const getRodValue = (rod: RodState): number => {
  const activeLowerCount = rod.lowers.filter((bead) => bead.active).length;
  return (rod.upper.active ? 5 : 0) + activeLowerCount;
};

export const getAbacusValue = (state: AbacusState): number =>
  state.rods.reduce((total, rod, index) => {
    const place = Math.pow(10, state.rods.length - index - 1);
    return total + getRodValue(rod) * place;
  }, 0);

export const applyNumberToAbacus = (state: AbacusState, value: number): AbacusState => ({
  rods: state.rods.map((rod, index) => {
    const digit = getDigit(Math.max(0, Math.floor(value)), index, state.rods.length);
    const hasUpperBead = digit >= 5;
    const lowerCount = digit % 5;

    return {
      ...rod,
      upper: {
        ...rod.upper,
        active: hasUpperBead,
      },
      lowers: rod.lowers.map((bead) => ({
        ...bead,
        active: bead.index < lowerCount,
      })),
    };
  }),
});
