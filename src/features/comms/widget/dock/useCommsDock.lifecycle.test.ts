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
  it('rapid repeat activations of one copy channel produce a single pending success-clear timer', async () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    expect(h.timer.pendingCount()).toBe(1);
  });

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

  it('unsubscribing the hook cancels any pending success-clear or failed-clear timer', async () => {
    const h = createHarness();
    const { result, unmount } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    expect(h.timer.pendingCount()).toBe(1);
    unmount();
    expect(h.timer.pendingCount()).toBe(0);
  });
});
