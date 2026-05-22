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

const writeToStorage = (settings: AudioSettings): void => {
  window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
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
    const handler = (event: StorageEvent): void => {
      if (event.key !== AUDIO_SETTINGS_STORAGE_KEY) return;
      setSettings(readFromStorage());
    };
    window.addEventListener('storage', handler);
    return (): void => {
      window.removeEventListener('storage', handler);
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
