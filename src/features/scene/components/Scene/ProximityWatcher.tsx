import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { proximityCheck } from '../../services/renderer/proximityCheck';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import type { Company, CompanyId } from '../../types/company';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly companies: ReadonlyArray<Company>;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly onEvent: (event: SceneEvent) => void;
};

export const PROXIMITY_RADIUS = 3;

const EMPTY: ReadonlySet<CompanyId> = new Set<CompanyId>();

const emitsIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const suppressesEnter = (state: SceneState, id: CompanyId): boolean =>
  state.kind === 'revealing' && state.objectId === id;

export const ProximityWatcher = (props: ProximityWatcherProps): JSX.Element => {
  const previousRef = useRef<ReadonlySet<CompanyId>>(EMPTY);

  useFrame(() => {
    if (!emitsIn(props.sceneState)) {
      previousRef.current = EMPTY;
      return;
    }

    const position = props.kinematicsRef.current.position;
    const current = proximityCheck(position, props.companies, PROXIMITY_RADIUS);
    const previous = previousRef.current;

    for (const id of current) {
      if (previous.has(id)) continue;
      if (suppressesEnter(props.sceneState, id)) continue;
      props.onEvent({ kind: 'entered_proximity', objectId: id });
    }
    for (const id of previous) {
      if (!current.has(id)) {
        props.onEvent({ kind: 'exited_proximity', objectId: id });
      }
    }

    previousRef.current = current;
  });

  return <group />;
};
