import type { BoostSignal } from '../../types/scene-refs';

// Boost smoothing — exponential lerp toward 0/1 with ~167ms time constant
// (1/BOOST_FACTOR_LERP_RATE). Keeps the trail cross-fade and the integrator's
// binary `active` flag in lock-step at frame edges while the visual factor
// glides between them.
const BOOST_FACTOR_LERP_RATE = 6;

// Discriminated boost step result. Multiplier is the integrator gate; factor
// drives smooth visual lerps; active mirrors the input gate after the
// activation-radius mask.
export type BoostStep =
  | { readonly kind: 'inactive'; readonly factor: number; readonly multiplier: 1 }
  | { readonly kind: 'active'; readonly factor: number; readonly multiplier: 4.5 };

// Stateful boost controller. Owns the smoothed factor and writes through
// the shared signal on every tick. Tick takes three distinct positional
// domain values: (1) the raw boost intent, (2) an edge-trigger for new
// planet-proximity entry, (3) the frame delta. Boost engages on press
// regardless of current proximity, and only cancels on the frame a new
// planet enters proximity; the cancel latch resets on the next
// press-edge (release-then-press).
export type BoostController = {
  readonly tick: (boostHeld: boolean, newPlanetEntry: boolean, delta: number) => BoostStep;
};

export const createBoostController = (signal: BoostSignal): BoostController => {
  let factor = 0;
  let cancelled = false;
  let prevHeld = false;
  return {
    tick: (boostHeld, newPlanetEntry, delta) => {
      if (boostHeld && !prevHeld) cancelled = false;
      if (newPlanetEntry && boostHeld) cancelled = true;
      prevHeld = boostHeld;

      const active = boostHeld && !cancelled;
      const target = active ? 1 : 0;
      const blend = 1 - Math.exp(-BOOST_FACTOR_LERP_RATE * delta);
      factor = factor + (target - factor) * blend;
      signal.write(active, factor);
      if (active) return { kind: 'active', factor, multiplier: 4.5 };
      return { kind: 'inactive', factor, multiplier: 1 };
    },
  };
};
