import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { getChannelById, getChannels } from './channels';
import { projectVelocityReadout } from './projectVelocityReadout';
import { projectDockVisibility } from './projectDockVisibility';
import {
  createRafKinematicsSource,
  type KinematicsSource,
} from '../../services/subscribeKinematics';
import { subscribePrefersReducedMotion as defaultSubscribePrefersReducedMotion } from '../../services/prefersReducedMotion';
import type { Channel, ChannelId } from '../../types/channel';
import type { MotionPreference } from '../../types/motion-preference';
import type { VelocityReadout } from '../../types/velocity-readout';
import type { DockVisibility } from '../../types/visibility';
import { MAX_SPEED, type Kinematics } from '../../../scene/types/kinematics';
import type { SceneState } from '../../../scene/types/scene-state';

export type LinkOpenRequest = {
  readonly href: string;
  readonly target: '_blank';
  readonly rel: 'noopener noreferrer';
};

export type CommsDockDeps = {
  readonly createKinematicsSource: (getSample: () => { readonly velocity: Kinematics['velocity'] }) => KinematicsSource;
  readonly subscribePrefersReducedMotion: (cb: (m: MotionPreference) => void) => () => void;
  readonly openExternal: (request: LinkOpenRequest) => void;
};

export type UseCommsDockProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly sceneState: SceneState;
  readonly deps?: CommsDockDeps;
};

export type UseCommsDockResult = {
  readonly channels: ReadonlyArray<Channel>;
  readonly readout: VelocityReadout;
  readonly visibility: DockVisibility;
  readonly motion: MotionPreference;
  readonly onActivate: (channelId: ChannelId) => void;
};

const ZERO_READOUT: VelocityReadout = projectVelocityReadout({ x: 0, y: 0, z: 0 }, MAX_SPEED);
const INITIAL_MOTION: MotionPreference = { kind: 'normal' };

const defaultOpenExternal = (request: LinkOpenRequest): void => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined) return;
  win.open(request.href, request.target, request.rel);
};

const defaultDeps = (): CommsDockDeps => ({
  createKinematicsSource: (getSample) => createRafKinematicsSource(getSample),
  subscribePrefersReducedMotion: defaultSubscribePrefersReducedMotion,
  openExternal: defaultOpenExternal,
});

export const useCommsDock = (props: UseCommsDockProps): UseCommsDockResult => {
  const deps = useMemo<CommsDockDeps>(() => props.deps ?? defaultDeps(), [props.deps]);
  const channels = useMemo<ReadonlyArray<Channel>>(() => getChannels(), []);
  const visibility = useMemo<DockVisibility>(
    () => projectDockVisibility(props.sceneState),
    [props.sceneState],
  );

  const [readout, setReadout] = useState<VelocityReadout>(ZERO_READOUT);
  const [motion, setMotion] = useState<MotionPreference>(INITIAL_MOTION);

  const kinematicsRef = props.kinematicsRef;

  useEffect(() => {
    const source = deps.createKinematicsSource(() => ({ velocity: kinematicsRef.current.velocity }));
    const unsubscribe = source.subscribe((sample) => {
      setReadout(projectVelocityReadout(sample.velocity, MAX_SPEED));
    });
    return unsubscribe;
  }, [deps, kinematicsRef]);

  useEffect(() => {
    const unsubscribe = deps.subscribePrefersReducedMotion((next) => {
      setMotion(next);
    });
    return unsubscribe;
  }, [deps]);

  const onActivate = useCallback(
    (channelId: ChannelId): void => {
      const channel = getChannelById(channelId);
      deps.openExternal({
        href: channel.href,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
    },
    [deps],
  );

  return { channels, readout, visibility, motion, onActivate };
};
