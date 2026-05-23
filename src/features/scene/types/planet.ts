import type { SatelliteSpec } from './satellite';

export type PlanetAssetId =
  | 'earth_a'
  | 'earth_b'
  | 'jupiter_a'
  | 'jupiter_b'
  | 'mars_a'
  | 'mars_b'
  | 'mercury_a'
  | 'mercury_b'
  | 'moon_a'
  | 'moon_b'
  | 'neptune_a'
  | 'neptune_b'
  | 'pluto_a'
  | 'pluto_b'
  | 'saturn_a'
  | 'saturn_b'
  | 'sun_a'
  | 'sun_b'
  | 'uranus_a'
  | 'uranus_b'
  | 'venus_a'
  | 'venus_b';

export type PlanetConfig = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  // [] means "no moons"
  readonly satellites: ReadonlyArray<SatelliteSpec>;
};

export const planetDisplayName = (assetId: PlanetAssetId): string => {
  switch (assetId) {
    case 'earth_a':
    case 'earth_b':
      return 'Earth';
    case 'jupiter_a':
    case 'jupiter_b':
      return 'Jupiter';
    case 'mars_a':
    case 'mars_b':
      return 'Mars';
    case 'mercury_a':
    case 'mercury_b':
      return 'Mercury';
    case 'moon_a':
    case 'moon_b':
      return 'Moon';
    case 'neptune_a':
    case 'neptune_b':
      return 'Neptune';
    case 'pluto_a':
    case 'pluto_b':
      return 'Pluto';
    case 'saturn_a':
    case 'saturn_b':
      return 'Saturn';
    case 'sun_a':
    case 'sun_b':
      return 'Sun';
    case 'uranus_a':
    case 'uranus_b':
      return 'Uranus';
    case 'venus_a':
    case 'venus_b':
      return 'Venus';
  }
};
