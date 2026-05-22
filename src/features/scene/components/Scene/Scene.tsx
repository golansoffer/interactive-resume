import type { JSX, RefObject } from 'react';
import { useMemo } from 'react';
import type { CompanyEntry } from '../../types/company';
import type { FillerPlanetEntry } from '../../types/filler-planet';
import type { IntentStream } from '../../types/intent';
import type { LabelProjection } from '../../types/projections';
import type { RouteProjection } from '../../types/route-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import type { ShipEntry } from '../../../ships/types/ship';
import type { SpaceshipAudio } from '../../../audio/types/audio-orchestrator';
import type { Kinematics } from '../../types/kinematics';
import { CelestialTraffic } from './CelestialTraffic';
import { Companies } from './Companies';
import { FillerPlanets } from './FillerPlanets';
import { FollowCamera } from './FollowCamera';
import { PlanetLabels } from './PlanetLabels';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { Starfield } from './Starfield';
import { Sun } from './Sun';
import { WaypointBeam } from './WaypointBeam';
import { useSceneRefs } from './useSceneRefs';

type SceneProps = {
  readonly ship: ShipEntry;
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly fillerPlanets: ReadonlyArray<FillerPlanetEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly routeProjection: RouteProjection;
  readonly audio: SpaceshipAudio;
};

const projectLabel = (entry: CompanyEntry): ReadonlyArray<LabelProjection> => {
  const logo = entry.info.logo;
  switch (logo.kind) {
    case 'with_icon':
      return [
        {
          kind: 'icon',
          id: entry.id,
          placement: entry.planet.placement,
          iconSrc: logo.src,
          backdrop: logo.backdrop,
        },
      ];
    case 'text_label':
      return [
        {
          kind: 'text',
          id: entry.id,
          placement: entry.planet.placement,
          text: logo.text,
          backdrop: logo.backdrop,
        },
      ];
    case 'no_icon':
      return [];
  }
};

const projectLabels = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<LabelProjection> => entries.flatMap((entry) => projectLabel(entry));

export const Scene = (props: SceneProps): JSX.Element => {
  const { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef, boostSignalRef } =
    useSceneRefs();

  const labels = useMemo(() => projectLabels(props.entries), [props.entries]);

  return (
    <>
      <color attach="background" args={['#04050a']} />
      <Starfield />
      <Sun sphereCollidersRef={sphereCollidersRef} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-30, 14, 92]} intensity={1.8} castShadow={false} />
      <directionalLight position={[30, 5, -60]} intensity={0.35} castShadow={false} />
      <FollowCamera kinematicsRef={props.kinematicsRef} boostSignalRef={boostSignalRef} />
      <Player
        ship={props.ship}
        sceneState={props.state}
        intents={props.intents}
        kinematicsRef={props.kinematicsRef}
        meshRef={meshRef}
        sphereCollidersRef={sphereCollidersRef}
        planetActivationsRef={planetActivationsRef}
        boostSignalRef={boostSignalRef}
        audio={props.audio}
      />
      <Companies
        entries={props.entries}
        planetRadiiRef={planetRadiiRef}
        planetActivationsRef={planetActivationsRef}
        sphereCollidersRef={sphereCollidersRef}
      />
      <FillerPlanets fillerPlanets={props.fillerPlanets} sphereCollidersRef={sphereCollidersRef} />
      <CelestialTraffic />
      <PlanetLabels labels={labels} />
      <WaypointBeam projection={props.routeProjection} />
      <ProximityWatcher
        sceneState={props.state}
        kinematicsRef={props.kinematicsRef}
        planetRadiiRef={planetRadiiRef}
        planetActivationsRef={planetActivationsRef}
        onEvent={props.onEvent}
      />
    </>
  );
};
