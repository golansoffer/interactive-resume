import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { useAudioControls } from './useAudioControls';

describe('useAudioControls', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('panel starts closed', () => {
    const { result } = renderHook(() => useAudioControls());
    expect(result.current.panelOpen).toBe(false);
  });

  it('togglePanel opens then closes', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      result.current.togglePanel();
    });
    expect(result.current.panelOpen).toBe(true);
    act(() => {
      result.current.togglePanel();
    });
    expect(result.current.panelOpen).toBe(false);
  });

  it('Escape closes an open panel', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      result.current.togglePanel();
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.panelOpen).toBe(false);
  });

  it('Escape does nothing when panel is already closed', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.panelOpen).toBe(false);
  });

  it('setMuted persists and reflects', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.settings.muted).toBe(true);
  });

  it('setVolume updates the named channel', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      result.current.setVolume('master', 0.25);
    });
    expect(result.current.settings.master).toBe(0.25);
  });

  it('reset restores defaults', () => {
    const { result } = renderHook(() => useAudioControls());
    act(() => {
      result.current.setMuted(true);
      result.current.setVolume('master', 0.1);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.settings.muted).toBe(false);
    expect(result.current.settings.master).toBe(DEFAULT_AUDIO_SETTINGS.master);
  });
});
