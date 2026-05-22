import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { AUDIO_SETTINGS_STORAGE_KEY, useAudioSettings } from './useAudioSettings';

describe('useAudioSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when localStorage is empty', () => {
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('reads existing valid settings from localStorage on mount', () => {
    const stored = { muted: true, master: 0.6, music: 0.4, engine: 0.3, boost: 0.5 };
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(stored));
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(stored);
  });

  it('falls back to defaults when localStorage holds malformed JSON', () => {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, '{not valid');
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('falls back to defaults when localStorage holds a malformed shape', () => {
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify({ muted: 'yes' }));
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('setMuted updates state and writes localStorage', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setMuted(true);
    });
    expect(result.current.settings.muted).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.muted).toBe(true);
  });

  it('setVolume updates the named channel and persists', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setVolume('music', 0.25);
    });
    expect(result.current.settings.music).toBe(0.25);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.music).toBe(0.25);
  });

  it('reset restores defaults and persists', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      result.current.setMuted(true);
      result.current.setVolume('master', 0.2);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
    const stored = JSON.parse(window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('reacts to a storage event for the audio key from another tab', () => {
    const { result } = renderHook(() => useAudioSettings());
    const updated = { muted: true, master: 0.1, music: 0.2, engine: 0.3, boost: 0.4 };
    act(() => {
      window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: AUDIO_SETTINGS_STORAGE_KEY,
          newValue: JSON.stringify(updated),
        }),
      );
    });
    expect(result.current.settings).toEqual(updated);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useAudioSettings());
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'unrelated', newValue: 'whatever' }),
      );
    });
    expect(result.current.settings).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
