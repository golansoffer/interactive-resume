import type { JSX, MouseEvent } from 'react';
import type { AudioChannel } from '../../types/audio-orchestrator';
import type { AudioSettings } from '../../types/audio-settings';
import { VolumeSlider } from './VolumeSlider';

type AudioSettingsPanelProps = {
  readonly id: string;
  readonly settings: AudioSettings;
  readonly onSetVolume: (channel: AudioChannel, value: number) => void;
  readonly onReset: () => void;
};

type Row = {
  readonly channel: AudioChannel;
  readonly label: string;
};

const ROWS: ReadonlyArray<Row> = [
  { channel: 'master', label: 'Master' },
  { channel: 'music', label: 'Music' },
  { channel: 'engine', label: 'Engine' },
  { channel: 'boost', label: 'Boost' },
];

const PANEL_CLASSES =
  'fixed top-[4.5rem] left-6 z-50 w-72 rounded-xl border border-white/10 bg-card/85 p-4 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md';

// Mouse-click default focuses the button; without this preventDefault, the
// reset button keeps focus and the next Space press (boost) would re-fire it.
const swallowFocusOnMouseDown = (event: MouseEvent<HTMLButtonElement>): void => {
  event.preventDefault();
};

export const AudioSettingsPanel = ({
  id,
  settings,
  onSetVolume,
  onReset,
}: AudioSettingsPanelProps): JSX.Element => (
  <div id={id} role="group" aria-label="Audio settings" className={PANEL_CLASSES}>
    <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">
      Audio
    </div>
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => (
        <VolumeSlider
          key={row.channel}
          label={row.label}
          value={settings[row.channel]}
          onChange={(value): void => onSetVolume(row.channel, value)}
        />
      ))}
    </div>
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={onReset}
        onMouseDown={swallowFocusOnMouseDown}
        className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        Reset to defaults
      </button>
    </div>
  </div>
);
