export type CompanyId = string & { readonly __brand: 'CompanyId' };

export const asCompanyId = (raw: string): CompanyId => raw as CompanyId;

export type Company = {
  readonly id: CompanyId;
  readonly position: readonly [number, number, number];
};
