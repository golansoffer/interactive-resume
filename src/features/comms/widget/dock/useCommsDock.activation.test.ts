import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommsDock } from './useCommsDock';
import { createHarness, createKinematicsRef } from './useCommsDockTestHarness';
import type { SceneState } from '../../../scene/types/scene-state';

const playing: SceneState = { kind: 'playing' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCommsDock — activation routing', () => {
  it('activating a channel calls openExternal with href + rel containing "noreferrer"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('linkedin');
    });
    expect(h.openExternal).toHaveBeenCalledTimes(1);
    expect(h.openExternal).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'https://www.linkedin.com/in/golansofer/',
        target: '_blank',
        rel: expect.stringContaining('noreferrer'),
      }),
    );
  });

  it('activating the github channel opens its url via openExternal', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('github');
    });
    expect(h.openExternal).toHaveBeenCalledTimes(1);
    expect(h.openExternal).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://github.com/golansoffer' }),
    );
  });

  it('activating the gmail channel opens its mailto URL via openExternal', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('gmail');
    });
    expect(h.openExternal).toHaveBeenCalledTimes(1);
    expect(h.openExternal).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'mailto:Gsoffer550@gmail.com' }),
    );
  });
});

describe('useCommsDock — channels + motion plumbing', () => {
  it('exposes the channel registry as ReadonlyArray<Channel> (linkedin, github, gmail)', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    const ids = new Set(result.current.channels.map((c) => c.id));
    expect(ids).toEqual(new Set(['github', 'gmail', 'linkedin']));
    expect(result.current.channels).toHaveLength(3);
  });

  it('initial state.motion is kind "normal"', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    expect(result.current.motion).toEqual({ kind: 'normal' });
  });

  it('state.motion updates when the motion subscription emits a new preference', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      h.motion.emit({ kind: 'reduced' });
    });
    expect(result.current.motion).toEqual({ kind: 'reduced' });
    act(() => {
      h.motion.emit({ kind: 'normal' });
    });
    expect(result.current.motion).toEqual({ kind: 'normal' });
  });

  it('unmount unsubscribes from the motion source', () => {
    const h = createHarness();
    const { unmount } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    expect(h.motion.unsubscribed()).toBe(false);
    unmount();
    expect(h.motion.unsubscribed()).toBe(true);
  });
});
