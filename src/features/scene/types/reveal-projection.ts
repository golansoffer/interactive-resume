import type { CompanyInfo } from './company-info';
import type { PlanetAssetId } from './planet';

export type RevealProjection =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly info: CompanyInfo;
      readonly assetId: PlanetAssetId;
    };
