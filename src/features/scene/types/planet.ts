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
};
