import type { JSX, RefObject } from 'react';
import type { CompanyEntry } from '../../types/company';
import type { PlanetActivations, PlanetRadii, SphereColliders } from '../../types/scene-refs';
import { Planet } from './Planet';

type CompaniesProps = {
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const Companies = (props: CompaniesProps): JSX.Element => (
  <group>
    {props.entries.map((entry) => (
      <Planet
        key={entry.id}
        assetId={entry.planet.assetId}
        placement={entry.planet.placement}
        sphereCollidersRef={props.sphereCollidersRef}
        wiring={{
          kind: 'active',
          id: entry.id,
          info: entry.info,
          placement: entry.planet.placement,
          planetRadiiRef: props.planetRadiiRef,
          planetActivationsRef: props.planetActivationsRef,
        }}
      />
    ))}
  </group>
);
