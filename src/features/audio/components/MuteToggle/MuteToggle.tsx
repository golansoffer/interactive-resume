import type { JSX, MouseEvent } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

type MuteToggleProps = {
  readonly muted: boolean;
  readonly onToggle: () => void;
};

const BUTTON_CLASSES =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-foreground/85 opacity-55 shadow-lg backdrop-blur-md transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50';

// Mouse-click default focuses the button; without this preventDefault, the
// button keeps focus after a click and the next Space press (boost) would
// re-activate it. Keyboard Tab navigation still focuses normally.
const swallowFocusOnMouseDown = (event: MouseEvent<HTMLButtonElement>): void => {
  event.preventDefault();
};

export const MuteToggle = ({ muted, onToggle }: MuteToggleProps): JSX.Element => {
  const label = muted ? 'Unmute audio' : 'Mute audio';
  const Icon = muted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={muted}
      onClick={onToggle}
      onMouseDown={swallowFocusOnMouseDown}
      className={BUTTON_CLASSES}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
};
