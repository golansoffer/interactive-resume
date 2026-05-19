import type { JSX } from 'react';
import type { Company } from '../../types/company';
import type { IntentStream } from '../../types/intent';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import { Companies } from './Companies';
import { FollowCamera } from './FollowCamera';
import { Player } from './Player';
import { ProximityWatcher } from './ProximityWatcher';
import { RevealOverlay } from './RevealOverlay';
import { useSceneRefs } from './useSceneRefs';

type SceneProps = {
  readonly state: SceneState;
  readonly companies: ReadonlyArray<Company>;
  readonly intents: IntentStream;
  readonly onEvent: (event: SceneEvent) => void;
};

export const Scene = (props: SceneProps): JSX.Element => {
  const { kinematicsRef, meshRef } = useSceneRefs();

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />
      <FollowCamera targetMeshRef={meshRef} />
      <Player
        sceneState={props.state}
        intents={props.intents}
        kinematicsRef={kinematicsRef}
        meshRef={meshRef}
      />
      <Companies companies={props.companies} />
      <ProximityWatcher
        sceneState={props.state}
        companies={props.companies}
        kinematicsRef={kinematicsRef}
        onEvent={props.onEvent}
      />
      {props.state.kind === 'revealing' ? (
        <RevealOverlay objectId={props.state.objectId} />
      ) : null}
    </>
  );
};
