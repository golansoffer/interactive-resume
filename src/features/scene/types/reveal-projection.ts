import type { CompanyInfo } from './company-info';

export type RevealProjection =
  | { readonly kind: 'hidden' }
  | {
      readonly kind: 'visible';
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
    };
