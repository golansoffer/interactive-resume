import type { PlanetConfig } from './planet';
import type { CompanyInfo } from './company-info';

export type CompanyId = string & { readonly __brand: 'CompanyId' };

export const asCompanyId = (raw: string): CompanyId => raw as CompanyId;

export type CompanyEntry = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
  readonly info: CompanyInfo;
};
