import type { CompanyId } from './company';

export type SceneEvent =
  | { readonly kind: 'entered_proximity'; readonly objectId: CompanyId }
  | { readonly kind: 'exited_proximity'; readonly objectId: CompanyId };
