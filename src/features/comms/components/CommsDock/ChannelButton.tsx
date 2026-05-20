import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Channel, ChannelId } from '../../types/channel';
import type { CopyFeedback } from '../../types/feedback';
import type { MotionPreference } from '../../types/motion-preference';

type ChannelButtonProps = {
  readonly channel: Channel;
  readonly feedback: CopyFeedback;
  readonly motion: MotionPreference;
  readonly onActivate: (channelId: ChannelId) => void;
};

type PerChannelState = 'idle' | 'success' | 'failed';

const perChannelState = (channel: Channel, feedback: CopyFeedback): PerChannelState => {
  switch (feedback.kind) {
    case 'idle':
      return 'idle';
    case 'success':
      return feedback.channelId === channel.id ? 'success' : 'idle';
    case 'failed':
      return feedback.channelId === channel.id ? 'failed' : 'idle';
  }
};

const accessibleName = (channel: Channel): string => {
  switch (channel.kind) {
    case 'link':
      return channel.href.startsWith('mailto:')
        ? `Email ${channel.label}`
        : `Open ${channel.label} in a new tab`;
    case 'copy':
      return `Copy ${channel.label} username`;
  }
};

const BUTTON_CLASSNAME = cn(
  'group inline-flex shrink-0 items-center gap-2 rounded-md',
  'px-2.5 py-1.5 text-xs font-medium tracking-wide',
  'text-foreground/75 ring-1 ring-transparent',
  'transition-[background-color,color,box-shadow,transform] duration-200',
  'hover:bg-foreground/[0.06] hover:text-foreground hover:ring-foreground/15',
  'focus-visible:outline-none focus-visible:bg-foreground/[0.08]',
  'focus-visible:text-foreground focus-visible:ring-[--color-accent]/40',
  'active:translate-y-px',
  'data-[feedback=success]:bg-[--color-accent]/10',
  'data-[feedback=success]:text-[--color-accent]',
  'data-[feedback=success]:ring-[--color-accent]/35',
  'data-[feedback=failed]:bg-amber-500/10',
  'data-[feedback=failed]:text-amber-300',
  'data-[feedback=failed]:ring-amber-400/40',
  'data-[motion=reduced]:transition-none',
);

const ICON_CLASSNAME = cn(
  'h-3.5 w-3.5 shrink-0 opacity-80',
  'transition-opacity duration-200',
  'group-hover:opacity-100 group-focus-visible:opacity-100',
  'group-data-[feedback=success]:opacity-100',
  'group-data-[motion=reduced]:transition-none',
);

export const ChannelButton = (props: ChannelButtonProps): JSX.Element => {
  const state = perChannelState(props.channel, props.feedback);
  return (
    <button
      type="button"
      data-channel-button
      data-channel-id={props.channel.id}
      data-feedback={state}
      data-kind={props.channel.kind}
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
