import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../../types/audio-settings';
import type { AudioChannel } from '../../types/audio-orchestrator';
import { parseAudioSettings } from '../../schema/parseAudioSettings';

export const AUDIO_SETTINGS_STORAGE_KEY = 'audio.settings';

const readFromStorage = (): AudioSettings => {
  const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
  if (raw === null) return DEFAULT_AUDIO_SETTINGS;
  try {
    return parseAudioSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
};

// In-tab subscriber registry. Same-tab `localStorage.setItem` does NOT fire
// the `storage` event (only cross-tab does), so any hook instance other than
// the one that called the setter would miss the update. The registry lets
// every mounted instance of the hook re-read on every write, regardless of
// which instance issued the write — so two consumers in the same tab (e.g.
// the audio service push side in `useScene` and the UI side in the controls
// widget) stay in lockstep.
const subscribers = new Set<() => void>();

const writeToStorage = (settings: AudioSettings): void => {
  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  // Defer the cross-instance notify so we never fire setSettings on one hook
  // instance while React is still inside a state-update batch of another.
  // Without this, React 19 logs "Cannot update a component while rendering a
  // different component" because writeToStorage is invoked from inside a
  // setSettings updater (which counts as the update phase of that instance),
  // and the synchronous notify() then fires setSettings on every other
  // subscribed instance.
  const pending = Array.from(subscribers);
  queueMicrotask((): void => {
    for (const notify of pending) notify();
  });
};

export type UseAudioSettingsResult = {
  readonly settings: AudioSettings;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly reset: () => void;
};

export const useAudioSettings = (): UseAudioSettingsResult => {
  const [settings, setSettings] = useState<AudioSettings>(readFromStorage);

  useEffect(() => {
    const refresh = (): void => setSettings(readFromStorage());
    subscribers.add(refresh);
    const storageHandler = (event: StorageEvent): void => {
      if (event.key !== AUDIO_SETTINGS_STORAGE_KEY) return;
      refresh();
    };
    window.addEventListener('storage', storageHandler);
    return (): void => {
      subscribers.delete(refresh);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const setMuted = useCallback((muted: boolean): void => {
    setSettings((prev) => {
      const next: AudioSettings = { ...prev, muted };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setVolume = useCallback((channel: AudioChannel, value: number): void => {
    setSettings((prev) => {
      const next: AudioSettings = { ...prev, [channel]: value };
      writeToStorage(next);
      return next;
    });
  }, []);

  const reset = useCallback((): void => {
    writeToStorage(DEFAULT_AUDIO_SETTINGS);
    setSettings(DEFAULT_AUDIO_SETTINGS);
  }, []);

  return { settings, setMuted, setVolume, reset };
};
