import { vi } from 'vitest';
import type { RefObject } from 'react';
import type { CommsDockDeps, LinkOpenRequest, TimerScheduler } from './useCommsDock';
import type { CopyResult } from '../../services/clipboard';
import type { KinematicsSample, KinematicsSource } from '../../services/subscribeKinematics';
import type { MotionPreference } from '../../types/motion-preference';
import { INITIAL_KINEMATICS, type Kinematics } from '../../../scene/types/kinematics';

export type FakeKinematicsSource = KinematicsSource & {
  readonly push: (sample: KinematicsSample) => void;
  readonly subscriberCount: () => number;
};

export const createFakeKinematicsSource = (): FakeKinematicsSource => {
  const subscribers = new Set<(sample: KinematicsSample) => void>();
  return {
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    push: (sample) => {
      for (const cb of subscribers) cb(sample);
    },
    subscriberCount: () => subscribers.size,
  };
};

export type FakeTimer = TimerScheduler & {
  readonly advance: (ms: number) => void;
  readonly pendingCount: () => number;
};

export const createFakeTimer = (): FakeTimer => {
  type Entry = { readonly handle: number; readonly fireAt: number; readonly cb: () => void };
  let now = 0;
  let nextHandle = 1;
  const entries = new Map<number, Entry>();
  return {
    setTimeout: (cb, delayMs) => {
      const handle = nextHandle;
      nextHandle += 1;
      entries.set(handle, { handle, fireAt: now + delayMs, cb });
      return handle;
    },
    clearTimeout: (handle) => {
      entries.delete(handle);
    },
    advance: (ms) => {
      now += ms;
      // Map preserves insertion order; handles increment monotonically.
      // Snapshot first so newly-scheduled timers inside callbacks don't fire
      // in this pass.
      const due: ReadonlyArray<Entry> = [...entries.values()].filter((e) => e.fireAt <= now);
      for (const e of due) {
        entries.delete(e.handle);
        e.cb();
      }
    },
    pendingCount: () => entries.size,
  };
};

export type MotionControl = {
  readonly emit: (m: MotionPreference) => void;
  readonly unsubscribed: () => boolean;
};

export type Harness = {
  readonly clipboard: ReturnType<typeof vi.fn>;
  readonly resolveClipboard: (result: CopyResult) => Promise<void>;
  readonly kinematics: FakeKinematicsSource;
  readonly motion: MotionControl;
  readonly openExternal: ReturnType<typeof vi.fn>;
  readonly timer: FakeTimer;
  readonly deps: CommsDockDeps;
};

export const createHarness = (): Harness => {
  let pendingResolve: ((r: CopyResult) => void) | null = null;
  const clipboard = vi.fn((_value: string): Promise<CopyResult> => {
    return new Promise<CopyResult>((resolve) => {
      pendingResolve = resolve;
    });
  });
  const resolveClipboard = async (result: CopyResult): Promise<void> => {
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve === null) throw new Error('no pending clipboard call');
    resolve(result);
    await Promise.resolve();
    await Promise.resolve();
  };
  const kinematics = createFakeKinematicsSource();
  let motionCb: ((m: MotionPreference) => void) | null = null;
  let motionUnsubscribed = false;
  const motion: MotionControl = {
    emit: (m: MotionPreference): void => {
      const cb = motionCb;
      if (cb !== null) cb(m);
    },
    unsubscribed: () => motionUnsubscribed,
  };
  const openExternal = vi.fn((_request: LinkOpenRequest): void => {});
  const timer = createFakeTimer();
  const deps: CommsDockDeps = {
    copyToClipboard: clipboard,
    createKinematicsSource: () => kinematics,
    subscribePrefersReducedMotion: (cb) => {
      motionCb = cb;
      return () => {
        motionUnsubscribed = true;
        motionCb = null;
      };
    },
    openExternal,
    timer,
  };
  return { clipboard, resolveClipboard, kinematics, motion, openExternal, timer, deps };
};

export const createKinematicsRef = (k: Kinematics = INITIAL_KINEMATICS): RefObject<Kinematics> => ({
  current: k,
});

export const sample = (vx: number, vz: number): KinematicsSample => ({
  velocity: { x: vx, y: 0, z: vz },
});

export const FEEDBACK_CLEAR_MS = 1800;
