import type { JSX, RefObject } from 'react';
import type { PlanetProjection } from '../../types/projections';
import type { PlanetActivations, PlanetRadii, SphereColliders } from './useSceneRefs';
import { Planet } from './Planet';

type CompaniesProps = {
  readonly planets: ReadonlyArray<PlanetProjection>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.planets.map((planet) => (
      <Planet
        key={planet.id}
        planet={planet}
        planetRadiiRef={props.planetRadiiRef}
        planetActivationsRef={props.planetActivationsRef}
        sphereCollidersRef={props.sphereCollidersRef}
      />
    ))}
  </group>
);
