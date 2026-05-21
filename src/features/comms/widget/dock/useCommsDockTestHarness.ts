import { vi } from 'vitest';
import type { RefObject } from 'react';
import type { CommsDockDeps, LinkOpenRequest } from './useCommsDock';
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

export type MotionControl = {
  readonly emit: (m: MotionPreference) => void;
  readonly unsubscribed: () => boolean;
};

export type Harness = {
  readonly kinematics: FakeKinematicsSource;
  readonly motion: MotionControl;
  readonly openExternal: ReturnType<typeof vi.fn>;
  readonly deps: CommsDockDeps;
};

export const createHarness = (): Harness => {
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
  const deps: CommsDockDeps = {
    createKinematicsSource: () => kinematics,
    subscribePrefersReducedMotion: (cb) => {
      motionCb = cb;
      return () => {
        motionUnsubscribed = true;
        motionCb = null;
      };
    },
    openExternal,
  };
  return { kinematics, motion, openExternal, deps };
};

export const createKinematicsRef = (k: Kinematics = INITIAL_KINEMATICS): RefObject<Kinematics> => ({
  current: k,
});

export const sample = (vx: number, vz: number): KinematicsSample => ({
  velocity: { x: vx, y: 0, z: vz },
});
