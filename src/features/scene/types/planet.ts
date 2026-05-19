export type PlanetAssetId =
  | 'planet00'
  | 'planet01'
  | 'planet02'
  | 'planet03'
  | 'planet04'
  | 'planet05'
  | 'planet06'
  | 'planet07'
  | 'planet08'
  | 'planet09';

export type PlanetConfig = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
};
