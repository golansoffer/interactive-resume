import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommsDock } from './useCommsDock';
import { createHarness, createKinematicsRef, sample } from './useCommsDockTestHarness';
import type { SceneState } from '../../../scene/types/scene-state';

const playing: SceneState = { kind: 'playing' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCommsDock — concurrency / lifecycle', () => {
  it('unsubscribing the hook stops further kinematics samples from updating state.readout', () => {
    const h = createHarness();
    const { result, unmount } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.kinematics.push(sample(7, 0));
    });
    expect(result.current.readout.metersPerSecond).toBeCloseTo(7);
    const before = result.current.readout;
    unmount();
    expect(h.kinematics.subscriberCount()).toBe(0);
    h.kinematics.push(sample(14, 0));
    expect(result.current.readout).toBe(before);
  });
});
