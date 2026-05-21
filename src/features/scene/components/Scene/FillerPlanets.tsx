import type { JSX, RefObject } from 'react';
import type { FillerPlanetEntry } from '../../types/filler-planet';
import { Planet } from './Planet';
import type { SphereColliders } from '../../types/scene-refs';

type FillerPlanetsProps = {
  readonly fillerPlanets: ReadonlyArray<FillerPlanetEntry>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
};

export const FillerPlanets = (props: FillerPlanetsProps): JSX.Element => (
  <group>
    {props.fillerPlanets.map((entry) => (
      <Planet
        key={entry.id}
        assetId={entry.assetId}
        placement={entry.placement}
        sphereCollidersRef={props.sphereCollidersRef}
        wiring={{ kind: 'filler', id: entry.id }}
      />
    ))}
  </group>
);
