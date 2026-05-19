import type { JSX } from 'react';
import type { PlanetProjection } from '../../types/projections';
import { Planet } from './Planet';

type CompaniesProps = {
  readonly planets: ReadonlyArray<PlanetProjection>;
};

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.planets.map((planet) => (
      <Planet key={planet.id} planet={planet} />
    ))}
  </group>
);
