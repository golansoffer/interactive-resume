import type { Vec3 } from '../../scene/types/kinematics';

export type KinematicsSample = { readonly velocity: Vec3 };

export type KinematicsSource = {
  readonly subscribe: (callback: (sample: KinematicsSample) => void) => () => void;
};

export type RafScheduler = {
  readonly schedule: (run: () => void) => number;
  readonly cancel: (handle: number) => void;
  readonly now: () => number;
};

const SAMPLE_INTERVAL_MS = 33;

type LastEmit = { readonly kind: 'never' } | { readonly kind: 'at'; readonly time: number };

type LoopState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly handle: number; readonly lastEmit: LastEmit };

const shouldEmitNow = (lastEmit: LastEmit, now: number): boolean => {
  if (lastEmit.kind === 'never') return true;
  return now - lastEmit.time >= SAMPLE_INTERVAL_MS;
};

const defaultRafScheduler = (): RafScheduler => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined || typeof win.requestAnimationFrame !== 'function') {
    return {
      schedule: (): number => 0,
      cancel: (): void => {},
      now: (): number => 0,
    };
  }
  return {
    schedule: (run: () => void): number => win.requestAnimationFrame(run),
    cancel: (handle: number): void => {
      win.cancelAnimationFrame(handle);
    },
    now: (): number => win.performance.now(),
  };
};

type Loop = {
  readonly ensureRunning: () => void;
  readonly stopIfIdleAfter: () => void;
};

const createLoop = (
  scheduler: RafScheduler,
  subscribers: ReadonlySet<(sample: KinematicsSample) => void>,
  getSample: () => KinematicsSample,
): Loop => {
  let state: LoopState = { kind: 'idle' };

  const tick = (): void => {
    if (subscribers.size === 0) {
      state = { kind: 'idle' };
      return;
    }
    const now = scheduler.now();
    const previousEmit: LastEmit = state.kind === 'running' ? state.lastEmit : { kind: 'never' };
    const emit = shouldEmitNow(previousEmit, now);
    const nextEmit: LastEmit = emit ? { kind: 'at', time: now } : previousEmit;
    if (emit) {
      const sample = getSample();
      for (const subscriber of subscribers) {
        subscriber(sample);
      }
    }
    const handle = scheduler.schedule(tick);
    state = { kind: 'running', handle, lastEmit: nextEmit };
  };

  return {
    ensureRunning: (): void => {
      if (state.kind === 'running') return;
      const handle = scheduler.schedule(tick);
      state = { kind: 'running', handle, lastEmit: { kind: 'never' } };
    },
    stopIfIdleAfter: (): void => {
      if (subscribers.size > 0) return;
      if (state.kind === 'idle') return;
      scheduler.cancel(state.handle);
      state = { kind: 'idle' };
    },
  };
};

export const createRafKinematicsSource = (
  getSample: () => KinematicsSample,
  scheduler: RafScheduler = defaultRafScheduler(),
): KinematicsSource => {
  const subscribers = new Set<(sample: KinematicsSample) => void>();
  const loop = createLoop(scheduler, subscribers, getSample);

  return {
    subscribe: (callback: (sample: KinematicsSample) => void): (() => void) => {
      subscribers.add(callback);
      loop.ensureRunning();
      return (): void => {
        subscribers.delete(callback);
        loop.stopIfIdleAfter();
      };
    },
  };
};
