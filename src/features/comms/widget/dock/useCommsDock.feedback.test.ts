import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCommsDock } from './useCommsDock';
import { createHarness, createKinematicsRef, FEEDBACK_CLEAR_MS } from './useCommsDockTestHarness';
import type { SceneState } from '../../../scene/types/scene-state';

const playing: SceneState = { kind: 'playing' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCommsDock — copy success path', () => {
  it('after a clipboard ok, state.feedback becomes kind "success" with the activated channelId', async () => {
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
    expect(result.current.feedback).toEqual({ kind: 'success', channelId: 'discord' });
  });

  it('state.feedback returns to kind "idle" after the success-clear timer elapses', async () => {
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
    expect(result.current.feedback.kind).toBe('success');
    act(() => {
      h.timer.advance(FEEDBACK_CLEAR_MS);
    });
    expect(result.current.feedback).toEqual({ kind: 'idle' });
  });

  it('re-activating the same copy channel while feedback is "success" leaves feedback "success" with the same channelId', async () => {
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
    expect(result.current.feedback).toEqual({ kind: 'success', channelId: 'discord' });
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    expect(result.current.feedback).toEqual({ kind: 'success', channelId: 'discord' });
  });

  it('re-activating restarts the clear timer (prior pending timer no longer fires a clear)', async () => {
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
      h.timer.advance(1000);
    });
    expect(result.current.feedback.kind).toBe('success');
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'ok' });
    });
    expect(h.timer.pendingCount()).toBe(1);
    act(() => {
      h.timer.advance(800);
    });
    expect(result.current.feedback.kind).toBe('success');
    act(() => {
      h.timer.advance(1000);
    });
    expect(result.current.feedback.kind).toBe('idle');
  });

});

describe('useCommsDock — copy failure path', () => {
  it('after a clipboard failed, state.feedback becomes kind "failed" with the activated channelId', async () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'failed' });
    });
    expect(result.current.feedback).toEqual({ kind: 'failed', channelId: 'discord' });
  });

  it('state.feedback returns to kind "idle" after the failed-clear timer elapses', async () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    act(() => {
      result.current.onActivate('discord');
    });
    await act(async () => {
      await h.resolveClipboard({ kind: 'failed' });
    });
    expect(result.current.feedback.kind).toBe('failed');
    act(() => {
      h.timer.advance(FEEDBACK_CLEAR_MS);
    });
    expect(result.current.feedback).toEqual({ kind: 'idle' });
  });

  it('does not throw out of the activation handler when the clipboard rejects', () => {
    const h = createHarness();
    const { result } = renderHook(() =>
      useCommsDock({ kinematicsRef: createKinematicsRef(), sceneState: playing, deps: h.deps }),
    );
    expect(() => {
      act(() => {
        result.current.onActivate('discord');
      });
    }).not.toThrow();
  });
});
