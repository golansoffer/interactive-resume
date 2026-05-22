import { useEffect, useState } from 'react';
import type { AudioChannel } from '../../types/audio-orchestrator';
import type { AudioSettings } from '../../types/audio-settings';
import { useAudioSettings } from './useAudioSettings';

export type UseAudioControlsResult = {
  readonly settings: AudioSettings;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly reset: () => void;
  readonly panelOpen: boolean;
  readonly togglePanel: () => void;
};

export const useAudioControls = (): UseAudioControlsResult => {
  const { settings, setMuted, setVolume, reset } = useAudioSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const togglePanel = (): void => setPanelOpen((prev) => !prev);

  useEffect(() => {
    if (!panelOpen) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', handler);
    return (): void => {
      window.removeEventListener('keydown', handler);
    };
  }, [panelOpen]);

  return { settings, setMuted, setVolume, reset, panelOpen, togglePanel };
};
