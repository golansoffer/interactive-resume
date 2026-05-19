import type { CompanyId } from './company';
import type { PlanetConfig } from './planet';

export type PlanetProjection = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
};

export type LabelProjection = {
  readonly id: CompanyId;
  readonly placement: readonly [number, number, number];
  readonly companyName: string;
  readonly logoSrc: string;
};
