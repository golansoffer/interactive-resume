import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { proximityCheck } from '../../services/renderer/proximityCheck';
import type { Kinematics } from '../../types/kinematics';
import type { CompanyId } from '../../types/company';
import type { CompanyInfo } from '../../types/company-info';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import type { PlanetActivations, PlanetRadii } from '../../types/scene-refs';

type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly onEvent: (event: SceneEvent) => void;
};

type ProximityTarget = {
  readonly id: CompanyId;
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
  readonly radius: number;
};

const EMPTY: ReadonlySet<CompanyId> = new Set<CompanyId>();

const emitsIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const suppressesEnter = (state: SceneState, id: CompanyId): boolean =>
  state.kind === 'revealing' && state.objectId === id;

// Materialize the per-frame target list by iterating the registry — Planet
// pushed (info, placement) plus the live radius cell at attach time, so no
// id-keyed join is required at the call site.
const collectTargets = (radii: PlanetRadii): ReadonlyArray<ProximityTarget> => {
  const out: ProximityTarget[] = [];
  radii.forEach((id, info, placement, radius) => {
    out.push({ id, info, placement, radius });
  });
  return out;
};

export const ProximityWatcher = (props: ProximityWatcherProps): JSX.Element => {
  const previousRef = useRef<ReadonlySet<CompanyId>>(EMPTY);

  useFrame(() => {
    if (!emitsIn(props.sceneState)) {
      previousRef.current = EMPTY;
      props.planetActivationsRef.current.publish(EMPTY);
      return;
    }

    const position = props.kinematicsRef.current.position;
    const targets = collectTargets(props.planetRadiiRef.current);
    const matches = proximityCheck(position, targets);
    const previous = previousRef.current;
    const current = new Set<CompanyId>(matches.map((m) => m.id));

    // Visual activation publishes the full set every frame — every Planet
    // whose own radius contains the player turns on, independently of the
    // SceneMachine's single-target reveal selection.
    props.planetActivationsRef.current.publish(current);

    for (const match of matches) {
      if (previous.has(match.id)) continue;
      if (suppressesEnter(props.sceneState, match.id)) continue;
      props.onEvent({
        kind: 'entered_proximity',
        objectId: match.id,
        info: match.info,
      });
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
