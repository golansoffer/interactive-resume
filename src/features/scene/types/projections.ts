import type { CompanyId } from './company';
import type { PlanetConfig } from './planet';

export type PlanetProjection = {
  readonly id: CompanyId;
  readonly planet: PlanetConfig;
};

export type LabelProjection =
  | {
      readonly kind: 'icon';
      readonly id: CompanyId;
      readonly placement: readonly [number, number, number];
      readonly iconSrc: string;
      readonly backdrop: 'light' | 'dark';
    }
  | {
      readonly kind: 'text';
      readonly id: CompanyId;
      readonly placement: readonly [number, number, number];
      readonly text: string;
      readonly backdrop: 'light' | 'dark';
    };
