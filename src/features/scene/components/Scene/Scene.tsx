import type { JSX, RefObject } from 'react';
import { useMemo } from 'react';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { LabelProjection, PlanetProjection } from '../../types/projections';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import type { ShipEntry } from '../../../ships/types/ship';
import type { Kinematics } from '../../types/kinematics';
import { Asteroids } from './Asteroids';
import { Companies } from './Companies';
import { FollowCamera } from './FollowCamera';
import { PlanetLabels } from './PlanetLabels';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { Starfield } from './Starfield';
import { Sun } from './Sun';
import { useSceneRefs } from './useSceneRefs';

type SceneProps = {
  readonly ship: ShipEntry;
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly kinematicsRef: RefObject<Kinematics>;
};

const projectPlanets = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<PlanetProjection> =>
  entries.map((entry) => ({ id: entry.id, planet: entry.planet }));

const projectLabels = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<LabelProjection> =>
  entries.flatMap((entry): ReadonlyArray<LabelProjection> => {
    const logo = entry.info.logo;
    if (logo.kind === 'no_icon') return [];
    return [
      {
        id: entry.id,
        placement: entry.planet.placement,
        iconSrc: logo.src,
        backdrop: logo.backdrop,
      },
    ];
  });

export const Scene = (props: SceneProps): JSX.Element => {
  const { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef } = useSceneRefs();

  const planets = useMemo(() => projectPlanets(props.entries), [props.entries]);
  const labels = useMemo(() => projectLabels(props.entries), [props.entries]);

  return (
    <>
      <color attach="background" args={['#04050a']} />
      <Starfield />
      <Sun sphereCollidersRef={sphereCollidersRef} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 18, 6]} intensity={1.6} castShadow={false} />
      <directionalLight position={[-8, 6, -10]} intensity={0.2} castShadow={false} />
      <FollowCamera kinematicsRef={props.kinematicsRef} />
      <Player
        ship={props.ship}
        sceneState={props.state}
        intents={props.intents}
        kinematicsRef={props.kinematicsRef}
        meshRef={meshRef}
        sphereCollidersRef={sphereCollidersRef}
      />
      <Companies
        planets={planets}
        planetRadiiRef={planetRadiiRef}
        planetActivationsRef={planetActivationsRef}
        sphereCollidersRef={sphereCollidersRef}
      />
      <Asteroids />
      <PlanetLabels labels={labels} />
      <ProximityWatcher
        sceneState={props.state}
        entries={props.entries}
        kinematicsRef={props.kinematicsRef}
        planetRadiiRef={planetRadiiRef}
        planetActivationsRef={planetActivationsRef}
        onEvent={props.onEvent}
      />
    </>
  );
};
