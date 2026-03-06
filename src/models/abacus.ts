export type BeadState = {
  id: string;
  active: boolean;
  kind: "upper" | "lower";
  index: number;
};

export type RodState = {
  id: string;
  upper: BeadState;
  lowers: BeadState[];
};

export type AbacusState = {
  rods: RodState[];
};
