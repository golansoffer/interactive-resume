import type { BoostSignal } from '../../types/scene-refs';

export const createBoostSignal = (): BoostSignal => {
  let active = false;
  let factor = 0;
  return {
    read: () => ({ active, factor }),
    write: (nextActive, nextFactor) => {
      active = nextActive;
      factor = nextFactor;
    },
  };
};
