import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScene } from './useScene';

describe('useScene — composition root smoke', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { state, entries, intents, onEvent, revealProjection } with the expected shapes', () => {
    const { result } = renderHook(() => useScene());

    expect(typeof result.current.state.kind).toBe('string');
    expect(Array.isArray(result.current.entries)).toBe(true);
    expect(result.current.entries.length).toBeGreaterThan(0);
    expect(result.current.intents.current).toBeInstanceOf(Set);
    expect(typeof result.current.onEvent).toBe('function');
    expect(result.current.revealProjection.kind).toBe('hidden');
  });

  it('transitions from loading to playing after the start effect fires', () => {
    let initialKind = '';
    const { result } = renderHook(() => {
      const value = useScene();
      if (initialKind === '') {
        initialKind = value.state.kind;
      }
      return value;
    });

    expect(initialKind).toBe('loading');
    expect(result.current.state.kind).toBe('playing');
  });

  it('preserves the intents object identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useScene());
    const intentsBefore = result.current.intents;

    act(() => {
      rerender();
    });

    expect(result.current.intents).toBe(intentsBefore);
  });
});

describe('useScene — audio wiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes an audio handle with the SpaceshipAudio shape', () => {
    const { result } = renderHook(() => useScene());
    expect(typeof result.current.audio.setSceneAlive).toBe('function');
    expect(typeof result.current.audio.setBoost).toBe('function');
    expect(typeof result.current.audio.setMuted).toBe('function');
    expect(typeof result.current.audio.setVolume).toBe('function');
    expect(typeof result.current.audio.dispose).toBe('function');
  });
});
