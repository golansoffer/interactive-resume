import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getChannelById, getChannels } from './channels';
import { feedbackReducer } from './feedbackReducer';
import { projectVelocityReadout } from './projectVelocityReadout';
import { projectDockVisibility } from './projectDockVisibility';
import { copyToClipboard as defaultCopyToClipboard, type CopyResult } from '../../services/clipboard';
import {
  createRafKinematicsSource,
  type KinematicsSource,
} from '../../services/subscribeKinematics';
import { subscribePrefersReducedMotion as defaultSubscribePrefersReducedMotion } from '../../services/prefersReducedMotion';
import type { Channel, ChannelId } from '../../types/channel';
import type { CopyFeedback } from '../../types/feedback';
import type { MotionPreference } from '../../types/motion-preference';
import type { VelocityReadout } from '../../types/velocity-readout';
import type { DockVisibility } from '../../types/visibility';
import { MAX_SPEED, type Kinematics } from '../../../scene/types/kinematics';
import type { SceneState } from '../../../scene/types/scene-state';

const FEEDBACK_CLEAR_MS = 1800;

export type LinkOpenRequest = {
  readonly href: string;
  readonly target: '_blank';
  readonly rel: 'noopener noreferrer';
};

export type TimerScheduler = {
  readonly setTimeout: (callback: () => void, delayMs: number) => number;
  readonly clearTimeout: (handle: number) => void;
};

export type CommsDockDeps = {
  readonly copyToClipboard: (value: string) => Promise<CopyResult>;
  readonly createKinematicsSource: (getSample: () => { readonly velocity: Kinematics['velocity'] }) => KinematicsSource;
  readonly subscribePrefersReducedMotion: (cb: (m: MotionPreference) => void) => () => void;
  readonly openExternal: (request: LinkOpenRequest) => void;
  readonly timer: TimerScheduler;
};

export type UseCommsDockProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly sceneState: SceneState;
  readonly deps?: CommsDockDeps;
};

export type UseCommsDockResult = {
  readonly channels: ReadonlyArray<Channel>;
  readonly readout: VelocityReadout;
  readonly feedback: CopyFeedback;
  readonly visibility: DockVisibility;
  readonly motion: MotionPreference;
  readonly onActivate: (channelId: ChannelId) => void;
};

const ZERO_READOUT: VelocityReadout = projectVelocityReadout({ x: 0, y: 0, z: 0 }, MAX_SPEED);
const INITIAL_FEEDBACK: CopyFeedback = { kind: 'idle' };
const INITIAL_MOTION: MotionPreference = { kind: 'normal' };

const defaultOpenExternal = (request: LinkOpenRequest): void => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined) return;
  win.open(request.href, request.target, request.rel);
};

// `window.setTimeout` returns `number` (browser/jsdom) — `globalThis.setTimeout`
// returns `NodeJS.Timeout` when `@types/node` is in scope, so the widget binds
// to the browser surface deliberately.
const noopTimer: TimerScheduler = {
  setTimeout: (): number => 0,
  clearTimeout: (): void => {},
};

const defaultTimer = (): TimerScheduler => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined) return noopTimer;
  return {
    setTimeout: (cb: () => void, ms: number): number => win.setTimeout(cb, ms),
    clearTimeout: (handle: number): void => {
      win.clearTimeout(handle);
    },
  };
};

const defaultDeps = (): CommsDockDeps => ({
  copyToClipboard: defaultCopyToClipboard,
  createKinematicsSource: (getSample) => createRafKinematicsSource(getSample),
  subscribePrefersReducedMotion: defaultSubscribePrefersReducedMotion,
  openExternal: defaultOpenExternal,
  timer: defaultTimer(),
});

type ClearTimerState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly handle: number };

export const useCommsDock = (props: UseCommsDockProps): UseCommsDockResult => {
  const deps = useMemo<CommsDockDeps>(() => props.deps ?? defaultDeps(), [props.deps]);
  const channels = useMemo<ReadonlyArray<Channel>>(() => getChannels(), []);
  const visibility = useMemo<DockVisibility>(
    () => projectDockVisibility(props.sceneState),
    [props.sceneState],
  );

  const [readout, setReadout] = useState<VelocityReadout>(ZERO_READOUT);
  const [motion, setMotion] = useState<MotionPreference>(INITIAL_MOTION);
  const [feedback, dispatchFeedback] = useReducer(feedbackReducer, INITIAL_FEEDBACK);

  const kinematicsRef = props.kinematicsRef;
  const clearTimerRef = useRef<ClearTimerState>({ kind: 'idle' });
  const timer = deps.timer;

  const cancelClearTimer = useCallback((): void => {
    const current = clearTimerRef.current;
    if (current.kind === 'idle') return;
    timer.clearTimeout(current.handle);
    clearTimerRef.current = { kind: 'idle' };
  }, [timer]);

  const scheduleClearTimer = useCallback((): void => {
    cancelClearTimer();
    const handle = timer.setTimeout(() => {
      clearTimerRef.current = { kind: 'idle' };
      dispatchFeedback({ kind: 'clear' });
    }, FEEDBACK_CLEAR_MS);
    clearTimerRef.current = { kind: 'pending', handle };
  }, [cancelClearTimer, timer]);

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

  useEffect(() => {
    return cancelClearTimer;
  }, [cancelClearTimer]);

  const handleLinkActivation = useCallback(
    (channel: Channel & { readonly kind: 'link' }): void => {
      deps.openExternal({
        href: channel.href,
        target: '_blank',
        rel: 'noopener noreferrer',
      });
    },
    [deps],
  );

  const handleCopyActivation = useCallback(
    (channel: Channel & { readonly kind: 'copy' }): void => {
      const promise = deps.copyToClipboard(channel.value);
      promise.then((result) => {
        switch (result.kind) {
          case 'ok':
            dispatchFeedback({ kind: 'copy_succeeded', channelId: channel.id });
            scheduleClearTimer();
            return;
          case 'failed':
            dispatchFeedback({ kind: 'copy_failed', channelId: channel.id });
            scheduleClearTimer();
        }
      });
    },
    [deps, scheduleClearTimer],
  );

  const onActivate = useCallback(
    (channelId: ChannelId): void => {
      const channel = getChannelById(channelId);
      switch (channel.kind) {
        case 'link':
          handleLinkActivation(channel);
          return;
        case 'copy':
          handleCopyActivation(channel);
      }
    },
    [handleLinkActivation, handleCopyActivation],
  );

  return { channels, readout, feedback, visibility, motion, onActivate };
};
