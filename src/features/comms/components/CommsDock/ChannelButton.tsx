import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Channel, ChannelId } from '../../types/channel';
import type { MotionPreference } from '../../types/motion-preference';

type ChannelButtonProps = {
  readonly channel: Channel;
  readonly motion: MotionPreference;
  readonly onActivate: (channelId: ChannelId) => void;
};

const accessibleName = (channel: Channel): string =>
  channel.href.startsWith('mailto:')
    ? `Email ${channel.label}`
    : `Open ${channel.label} in a new tab`;

const BUTTON_CLASSNAME = cn(
  'group inline-flex shrink-0 items-center gap-2 rounded-md',
  'px-2.5 py-1.5 text-xs font-medium tracking-wide',
  'text-foreground/75 ring-1 ring-transparent',
  'transition-[background-color,color,box-shadow,transform] duration-200',
  'hover:bg-foreground/[0.06] hover:text-foreground hover:ring-foreground/15',
  'focus-visible:outline-none focus-visible:bg-foreground/[0.08]',
  'focus-visible:text-foreground focus-visible:ring-(--color-accent)/40',
  'active:translate-y-px',
  'data-[motion=reduced]:transition-none',
);

const ICON_CLASSNAME = cn(
  'h-3.5 w-3.5 shrink-0 opacity-80',
  'transition-opacity duration-200',
  'group-hover:opacity-100 group-focus-visible:opacity-100',
  'group-data-[motion=reduced]:transition-none',
);

export const ChannelButton = (props: ChannelButtonProps): JSX.Element => {
  return (
    <button
      type="button"
      data-channel-button
      data-channel-id={props.channel.id}
      data-motion={props.motion.kind}
      aria-label={accessibleName(props.channel)}
      onClick={() => props.onActivate(props.channel.id)}
      className={BUTTON_CLASSNAME}
    >
      <img data-icon src={props.channel.iconSrc} alt="" className={ICON_CLASSNAME} />
      <span data-label className="hidden sm:inline">{props.channel.label}</span>
    </button>
  );
};
