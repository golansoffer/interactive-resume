import type { PlanetAssetId } from './planet';

// `id` is a collider-registry key only — must not collide with any CompanyId.
export type FillerPlanetEntry = {
  readonly id: string;
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
};
