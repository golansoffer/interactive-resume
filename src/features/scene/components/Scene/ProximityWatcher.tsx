import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { proximityCheck } from '../../services/renderer/proximityCheck';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import type { CompanyEntry, CompanyId } from '../../types/company';
import type { CompanyInfo } from '../../types/company-info';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';

type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly onEvent: (event: SceneEvent) => void;
};

type ProximityTarget = {
  readonly id: CompanyId;
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
};

export const PROXIMITY_RADIUS = 3;

const EMPTY: ReadonlySet<CompanyId> = new Set<CompanyId>();

const emitsIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const suppressesEnter = (state: SceneState, id: CompanyId): boolean =>
  state.kind === 'revealing' && state.objectId === id;

const projectTargets = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<ProximityTarget> =>
  entries.map((entry) => ({
    id: entry.id,
    info: entry.info,
    placement: entry.planet.placement,
  }));

export const ProximityWatcher = (props: ProximityWatcherProps): JSX.Element => {
  const previousRef = useRef<ReadonlySet<CompanyId>>(EMPTY);

  const targets = useMemo(() => projectTargets(props.entries), [props.entries]);

  useFrame(() => {
    if (!emitsIn(props.sceneState)) {
      previousRef.current = EMPTY;
      return;
    }

    const position = props.kinematicsRef.current.position;
    const matches = proximityCheck(position, targets, PROXIMITY_RADIUS);
    const previous = previousRef.current;
    const current = new Set<CompanyId>(matches.map((m) => m.id));

    for (const match of matches) {
      if (previous.has(match.id)) continue;
      if (suppressesEnter(props.sceneState, match.id)) continue;
      props.onEvent({
        kind: 'entered_proximity',
        objectId: match.id,
        info: match.info,
        placement: match.placement,
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
