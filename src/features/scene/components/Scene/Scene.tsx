import type { JSX } from 'react';
import { useMemo } from 'react';
import type { CompanyEntry } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { LabelProjection, PlanetProjection } from '../../types/projections';
import type { RevealProjection } from '../../types/reveal-projection';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { Companies } from './Companies';
import { FollowCamera } from './FollowCamera';
import { PlanetLabels } from './PlanetLabels';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { RevealOverlay } from './RevealOverlay';
import { useSceneRefs } from './useSceneRefs';

type SceneProps = {
  readonly state: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
  readonly revealProjection: RevealProjection;
};

const projectPlanets = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<PlanetProjection> =>
  entries.map((entry) => ({ id: entry.id, planet: entry.planet }));

const projectLabels = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<LabelProjection> =>
  entries.map((entry) => ({
    id: entry.id,
    placement: entry.planet.placement,
    companyName: entry.info.companyName,
    logoSrc: entry.info.logoSrc,
  }));

export const Scene = (props: SceneProps): JSX.Element => {
  const { kinematicsRef, meshRef } = useSceneRefs();

  const planets = useMemo(() => projectPlanets(props.entries), [props.entries]);
  const labels = useMemo(() => projectLabels(props.entries), [props.entries]);

  return (
    <>
      <color attach="background" args={['#04050a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 18, 6]} intensity={1.6} castShadow={false} />
      <directionalLight position={[-8, 6, -10]} intensity={0.2} castShadow={false} />
      <FollowCamera kinematicsRef={kinematicsRef} />
      <Player
        sceneState={props.state}
        intents={props.intents}
        kinematicsRef={kinematicsRef}
        meshRef={meshRef}
      />
      <Companies planets={planets} />
      <PlanetLabels labels={labels} />
      <ProximityWatcher
        sceneState={props.state}
        entries={props.entries}
        kinematicsRef={kinematicsRef}
        onEvent={props.onEvent}
      />
      {props.revealProjection.kind === 'visible' ? (
        <RevealOverlay
          info={props.revealProjection.info}
          placement={props.revealProjection.placement}
        />
      ) : null}
    </>
  );
};
