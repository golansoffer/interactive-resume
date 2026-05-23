import type { PlanetAssetId } from './planet';

export type SatelliteOrbit = {
  readonly radius: number;
  readonly periodSeconds: number;
  readonly phase: number;
  readonly inclinationDeg: number;
};

export type SatelliteSpec = {
  // id is BOTH the React render key AND the phase seed for own-axis rotation
  // (orbit position derives from time + orbit params only; the rotation phase
  // derives from id via phaseFromId). Renaming a satellite re-phases its spin.
  readonly id: string;
  readonly assetId: PlanetAssetId;
  readonly scale: number;
  readonly orbit: SatelliteOrbit;
};
