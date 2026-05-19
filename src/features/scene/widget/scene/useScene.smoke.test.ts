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

  it('returns { state, companies, intents, onEvent } with the expected shapes', () => {
    const { result } = renderHook(() => useScene());

    expect(typeof result.current.state.kind).toBe('string');
    expect(Array.isArray(result.current.companies)).toBe(true);
    expect(result.current.companies.length).toBeGreaterThan(0);
    expect(result.current.intents.current).toBeInstanceOf(Set);
    expect(typeof result.current.onEvent).toBe('function');
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
