import { describe, expect, it, vi } from 'vitest';
import {
  createRafKinematicsSource,
  type KinematicsSample,
  type RafScheduler,
} from './subscribeKinematics';

const sample = (vx: number, vy: number, vz: number): KinematicsSample => ({
  velocity: { x: vx, y: vy, z: vz },
});

type FakeScheduler = RafScheduler & {
  readonly runNext: () => void;
  readonly advance: (delta: number) => void;
  readonly pendingCount: () => number;
};

const createFakeScheduler = (): FakeScheduler => {
  let now = 0;
  let nextHandle = 1;
  const queue = new Map<number, () => void>();
  return {
    schedule: (run: () => void): number => {
      const handle = nextHandle;
      nextHandle += 1;
      queue.set(handle, run);
      return handle;
    },
    cancel: (handle: number): void => {
      queue.delete(handle);
    },
    now: (): number => now,
    runNext: (): void => {
      const entry = queue.entries().next();
      if (entry.done === true) return;
      const [handle, run] = entry.value;
      queue.delete(handle);
      run();
    },
    advance: (delta: number): void => {
      now += delta;
    },
    pendingCount: (): number => queue.size,
  };
};

describe('createRafKinematicsSource — single subscriber', () => {
  it('emits the first sample on the next tick', () => {
    const scheduler = createFakeScheduler();
    const getSample = vi.fn(() => sample(1, 0, 0));
    const source = createRafKinematicsSource(getSample, scheduler);
    const seen = vi.fn();
    const unsubscribe = source.subscribe(seen);
    scheduler.runNext();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ velocity: { x: 1, y: 0, z: 0 } });
    unsubscribe();
  });

  it('throttles repeated emissions to once per ~80ms', () => {
    const scheduler = createFakeScheduler();
    const source = createRafKinematicsSource(() => sample(2, 0, 0), scheduler);
    const seen = vi.fn();
    const unsubscribe = source.subscribe(seen);
    scheduler.runNext();
    // Same frame timestamp — second tick should be throttled.
    scheduler.runNext();
    expect(seen).toHaveBeenCalledTimes(1);
    scheduler.advance(80);
    scheduler.runNext();
    expect(seen).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('unsubscribe stops further samples and cancels the pending rAF', () => {
    const scheduler = createFakeScheduler();
    const source = createRafKinematicsSource(() => sample(3, 0, 0), scheduler);
    const seen = vi.fn();
    const unsubscribe = source.subscribe(seen);
    scheduler.runNext();
    unsubscribe();
    expect(scheduler.pendingCount()).toBe(0);
    seen.mockClear();
    // Even if a stale tick existed, no subscribers means no emission.
    scheduler.runNext();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('createRafKinematicsSource — multi-subscriber sharing one loop', () => {
  it('shares a single rAF loop across multiple subscribers', () => {
    const scheduler = createFakeScheduler();
    const source = createRafKinematicsSource(() => sample(4, 0, 0), scheduler);
    const a = vi.fn();
    const b = vi.fn();
    const unA = source.subscribe(a);
    const unB = source.subscribe(b);
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.runNext();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unA();
    unB();
  });

  it('keeps the loop running while at least one subscriber remains', () => {
    const scheduler = createFakeScheduler();
    const source = createRafKinematicsSource(() => sample(5, 0, 0), scheduler);
    const a = vi.fn();
    const b = vi.fn();
    const unA = source.subscribe(a);
    const unB = source.subscribe(b);
    scheduler.runNext();
    unA();
    scheduler.advance(80);
    scheduler.runNext();
    expect(b).toHaveBeenCalledTimes(2);
    unB();
  });

  it('stops the loop once the last subscriber unsubscribes', () => {
    const scheduler = createFakeScheduler();
    const source = createRafKinematicsSource(() => sample(6, 0, 0), scheduler);
    const a = vi.fn();
    const b = vi.fn();
    const unA = source.subscribe(a);
    const unB = source.subscribe(b);
    scheduler.runNext();
    unA();
    unB();
    expect(scheduler.pendingCount()).toBe(0);
  });

  it('reads the latest sample on each emission (not a cached value)', () => {
    const scheduler = createFakeScheduler();
    let nextValue = 1;
    const getSample = (): KinematicsSample => {
      const s = sample(nextValue, 0, 0);
      nextValue += 1;
      return s;
    };
    const source = createRafKinematicsSource(getSample, scheduler);
    const seen = vi.fn();
    const unsubscribe = source.subscribe(seen);
    scheduler.runNext();
    scheduler.advance(80);
    scheduler.runNext();
    scheduler.advance(80);
    scheduler.runNext();
    expect(seen.mock.calls.map(([s]) => s)).toEqual([sample(1, 0, 0), sample(2, 0, 0), sample(3, 0, 0)]);
    unsubscribe();
  });
});
