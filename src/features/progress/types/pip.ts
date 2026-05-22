import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';

export type Pip =
  | { readonly kind: 'unvisited'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'visited'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId }
  | { readonly kind: 'here'; readonly companyId: CompanyId; readonly assetId: PlanetAssetId };
