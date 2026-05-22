import type { JSX } from 'react';
import { SlidersHorizontal } from 'lucide-react';

type SettingsTriggerProps = {
  readonly open: boolean;
  readonly controlsId: string;
  readonly onToggle: () => void;
};

const BUTTON_CLASSES =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 text-foreground/85 opacity-55 shadow-lg backdrop-blur-md transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50';

export const SettingsTrigger = ({
  open,
  controlsId,
  onToggle,
}: SettingsTriggerProps): JSX.Element => (
  <button
    type="button"
    aria-label="Audio settings"
    aria-expanded={open}
    aria-controls={controlsId}
    onClick={onToggle}
    className={BUTTON_CLASSES}
  >
    <SlidersHorizontal size={20} strokeWidth={1.75} aria-hidden="true" />
  </button>
);
