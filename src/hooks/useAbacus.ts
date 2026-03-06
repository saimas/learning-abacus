import { useCallback, useMemo, useState } from "react";
import { AbacusState } from "../models/abacus";
import { createAbacus, getAbacusValue, toggleLower, toggleUpper } from "../services/abacusEngine";

export const useAbacus = (rodCount: number) => {
  const [state, setState] = useState<AbacusState>(() => createAbacus(rodCount));

  const value = useMemo(() => getAbacusValue(state), [state]);

  const reset = useCallback(() => {
    setState(createAbacus(rodCount));
  }, [rodCount]);

  const handleToggleUpper = useCallback((rodIndex: number) => {
    setState((prev) => toggleUpper(prev, rodIndex));
  }, []);

  const handleToggleLower = useCallback((rodIndex: number, beadIndex: number) => {
    setState((prev) => toggleLower(prev, rodIndex, beadIndex));
  }, []);

  return {
    state,
    value,
    reset,
    toggleUpper: handleToggleUpper,
    toggleLower: handleToggleLower,
  };
};
