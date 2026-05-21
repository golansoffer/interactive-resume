import type { CompanyId } from './company';
import type { CompanyInfo } from './company-info';
import type { Sphere } from './sphere';

// Per-planet proximity target registry. attach yields a mutable radius cell
// that callers mutate as the asset settles. forEach consumes complete
// (info, placement, radius) tuples; re-attaching the same id replaces the
// entry (StrictMode-safe).
export type PlanetRadii = {
  readonly attach: (
    id: CompanyId,
    info: CompanyInfo,
    placement: readonly [number, number, number],
  ) => { value: number };
  readonly forEach: (
    callback: (
      id: CompanyId,
      info: CompanyInfo,
      placement: readonly [number, number, number],
      radius: number,
    ) => void,
  ) => void;
};

// Visual-activation registry — per-planet boolean, independent of the
// SceneMachine's single `revealing.objectId`. Multiple planets can be
// visually active at once if the viewer is within several activation radii
// simultaneously.
export type PlanetActivations = {
  readonly isActive: (id: CompanyId) => boolean;
  readonly anyActive: () => boolean;
  readonly publish: (active: ReadonlySet<CompanyId>) => void;
};

// String-keyed registry of sphere colliders. Unregistered ids never appear
// in list(), so a fold over list() carries the identity when nothing is
// measured yet — no `undefined` ever leaks (Iron Law 3).
export type SphereColliders = {
  readonly register: (id: string, sphere: Sphere) => void;
  readonly list: () => ReadonlyArray<Sphere>;
};

// Shared boost signal — `active` is the binary integrator gate; `factor` is
// the smoothed visual blend.
export type BoostSignal = {
  readonly read: () => { readonly active: boolean; readonly factor: number };
  readonly write: (active: boolean, factor: number) => void;
};
