import type { JSX } from 'react';
import { AudioSettingsPanel } from '../../components/AudioSettingsPanel/AudioSettingsPanel';
import { MuteToggle } from '../../components/MuteToggle/MuteToggle';
import { SettingsTrigger } from '../../components/SettingsTrigger/SettingsTrigger';
import { useAudioControls } from './useAudioControls';

const PANEL_ID = 'audio-settings-panel';
const CLUSTER_CLASSES = 'fixed top-6 left-6 z-50 flex gap-2';

export const AudioControlsWidget = (): JSX.Element => {
  const { settings, setMuted, setVolume, reset, panelOpen, togglePanel } = useAudioControls();
  return (
    <>
      <div className={CLUSTER_CLASSES}>
        <MuteToggle muted={settings.muted} onToggle={(): void => setMuted(!settings.muted)} />
        <SettingsTrigger open={panelOpen} controlsId={PANEL_ID} onToggle={togglePanel} />
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
