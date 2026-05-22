import { useEffect, useState, type JSX } from 'react';
import { AudioSettingsPanel } from '../../components/AudioSettingsPanel/AudioSettingsPanel';
import { MuteToggle } from '../../components/MuteToggle/MuteToggle';
import { SettingsTrigger } from '../../components/SettingsTrigger/SettingsTrigger';
import { useAudioSettings } from './useAudioSettings';

const PANEL_ID = 'audio-settings-panel';
const CLUSTER_CLASSES = 'fixed top-6 left-6 z-50 flex gap-2';

export const AudioControlsWidget = (): JSX.Element => {
  const { settings, setMuted, setVolume, reset } = useAudioSettings();
  const [panelOpen, setPanelOpen] = useState(false);

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

  return (
    <>
      <div className={CLUSTER_CLASSES}>
        <MuteToggle muted={settings.muted} onToggle={(): void => setMuted(!settings.muted)} />
        <SettingsTrigger
          open={panelOpen}
          controlsId={PANEL_ID}
          onToggle={(): void => setPanelOpen((prev) => !prev)}
        />
      </div>
      {panelOpen ? (
        <AudioSettingsPanel
          id={PANEL_ID}
          settings={settings}
          onSetVolume={setVolume}
          onReset={reset}
        />
      ) : null}
    </>
  );
};
