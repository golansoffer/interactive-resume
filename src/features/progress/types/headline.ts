import type { CompanyId } from '../../scene/types/company';
import type { PlanetAssetId } from '../../scene/types/planet';
import type { ShortCode } from '../../scene/types/short-code';

export type HeadlineCompany = {
  readonly id: CompanyId;
  readonly assetId: PlanetAssetId;
  readonly shortCode: ShortCode;
};

export type Headline =
  | { readonly kind: 'empty' }
  | { readonly kind: 'anchor'; readonly company: HeadlineCompany }
  | { readonly kind: 'active'; readonly company: HeadlineCompany }
  | { readonly kind: 'complete'; readonly company: HeadlineCompany };
