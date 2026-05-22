import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';

export type VisitEvent =
  | {
      readonly kind: 'first_visit';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'route_complete';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'revisit';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    }
  | {
      readonly kind: 'depart';
      readonly companyId: CompanyId;
      readonly assetId: PlanetAssetId;
    };
