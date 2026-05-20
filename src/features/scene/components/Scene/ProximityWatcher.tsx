import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { proximityCheck } from '../../services/renderer/proximityCheck';
import type { Kinematics } from '../../types/kinematics';
import type { CompanyEntry, CompanyId } from '../../types/company';
import type { CompanyInfo } from '../../types/company-info';
import type { SceneEvent } from '../../types/scene-event';
import type { SceneState } from '../../types/scene-state';
import type { PlanetActivations, PlanetRadii } from './useSceneRefs';

type ProximityWatcherProps = {
  readonly sceneState: SceneState;
  readonly entries: ReadonlyArray<CompanyEntry>;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly onEvent: (event: SceneEvent) => void;
};

type StaticTargetFields = {
  readonly id: CompanyId;
  readonly info: CompanyInfo;
  readonly placement: readonly [number, number, number];
};

type ProximityTarget = StaticTargetFields & { readonly radius: number };

const EMPTY: ReadonlySet<CompanyId> = new Set<CompanyId>();

const emitsIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const suppressesEnter = (state: SceneState, id: CompanyId): boolean =>
  state.kind === 'revealing' && state.objectId === id;

const projectStaticTargets = (
  entries: ReadonlyArray<CompanyEntry>,
): ReadonlyArray<StaticTargetFields> =>
  entries.map((entry) => ({
    id: entry.id,
    info: entry.info,
    placement: entry.planet.placement,
  }));

const resolveTargets = (
  staticTargets: ReadonlyArray<StaticTargetFields>,
  radii: PlanetRadii,
): ReadonlyArray<ProximityTarget> =>
  staticTargets.map((t) => ({ ...t, radius: radii.read(t.id) }));

export const ProximityWatcher = (props: ProximityWatcherProps): JSX.Element => {
  const previousRef = useRef<ReadonlySet<CompanyId>>(EMPTY);
  const staticTargets = useMemo(
    () => projectStaticTargets(props.entries),
    [props.entries],
  );

  useFrame(() => {
    if (!emitsIn(props.sceneState)) {
      previousRef.current = EMPTY;
      props.planetActivationsRef.current.publish(EMPTY);
      return;
    }

    const position = props.kinematicsRef.current.position;
    const targets = resolveTargets(staticTargets, props.planetRadiiRef.current);
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
