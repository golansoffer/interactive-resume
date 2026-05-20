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
  it('activating a link channel calls openExternal with href + rel containing "noreferrer"', () => {
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

  it('activating a link channel does not call the clipboard port', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('github');
    });
    expect(h.clipboard).not.toHaveBeenCalled();
  });

  it('activating a copy channel calls the clipboard port once with the channel value', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    expect(h.clipboard).toHaveBeenCalledTimes(1);
    expect(h.clipboard).toHaveBeenCalledWith('golan618');
  });

  it('activating a copy channel does not call openExternal', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    expect(h.openExternal).not.toHaveBeenCalled();
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
    expect(h.clipboard).not.toHaveBeenCalled();
  });
});

describe('useCommsDock — channels + motion plumbing', () => {
  it('exposes the channel registry as ReadonlyArray<Channel> (linkedin, github, discord, gmail)', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    const ids = new Set(result.current.channels.map((c) => c.id));
    expect(ids).toEqual(new Set(['discord', 'github', 'gmail', 'linkedin']));
    expect(result.current.channels).toHaveLength(4);
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

  it('two hooks rendered with separate harnesses do not share clipboard state', () => {
    const h1 = createHarness();
    const h2 = createHarness();
    const r1 = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h1.deps }),
    );
    const r2 = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h2.deps }),
    );
    act(() => {
      r1.result.current.onActivate('discord');
    });
    expect(h1.clipboard).toHaveBeenCalledTimes(1);
    expect(h2.clipboard).not.toHaveBeenCalled();
    r1.unmount();
    r2.unmount();
  });
});
