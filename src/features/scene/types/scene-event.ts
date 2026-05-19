import type { CompanyId } from './company';
import type { CompanyInfo } from './company-info';

export type SceneEvent =
  | {
      readonly kind: 'entered_proximity';
      readonly objectId: CompanyId;
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
    }
  | { readonly kind: 'exited_proximity'; readonly objectId: CompanyId };
