import type { CompanyId } from './company';

export type PlanetRole =
  | { readonly kind: 'active'; readonly id: CompanyId }
  | { readonly kind: 'filler'; readonly id: string };
