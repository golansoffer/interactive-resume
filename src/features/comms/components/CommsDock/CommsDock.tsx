import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { Channel, ChannelId } from '../../types/channel';
import type { CopyFeedback } from '../../types/feedback';
import type { VelocityReadout as VelocityReadoutValue } from '../../types/velocity-readout';
import type { DockVisibility } from '../../types/visibility';
import type { MotionPreference } from '../../types/motion-preference';
import { VelocityReadout } from './VelocityReadout';
import { ChannelButton } from './ChannelButton';

type CommsDockProps = {
  readonly channels: ReadonlyArray<Channel>;
  readonly readout: VelocityReadoutValue;
  readonly feedback: CopyFeedback;
  readonly visibility: DockVisibility;
  readonly motion: MotionPreference;
  readonly onActivate: (channelId: ChannelId) => void;
};

const announcementText = (
  channels: ReadonlyArray<Channel>,
  feedback: CopyFeedback,
): string =>
  channels.reduce<string>((acc, channel) => {
    switch (feedback.kind) {
      case 'idle':
        return acc;
      case 'success':
        return channel.id === feedback.channelId ? `Copied ${channel.label}` : acc;
      case 'failed':
        return channel.id === feedback.channelId ? `Copy failed for ${channel.label}` : acc;
    }
  }, '');

const DOCK_CLASSNAME = cn(
  'pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2',
  'flex items-center gap-5 rounded-xl px-5 py-3',
  'bg-card/85 ring-1 ring-foreground/10 shadow-2xl backdrop-blur-md',
  'text-card-foreground',
);

export const CommsDock = (props: CommsDockProps): JSX.Element | null => {
  if (props.visibility.kind === 'hidden') return null;

  const announcement = announcementText(props.channels, props.feedback);

  return (
    <section
      className={DOCK_CLASSNAME}
      data-comms-dock
      data-motion={props.motion.kind}
      aria-label="Communications"
    >
      <VelocityReadout readout={props.readout} motion={props.motion} />
      <div
        data-divider
        aria-hidden="true"
        className="h-9 w-px shrink-0 bg-foreground/15"
      />
      <div data-zone="channels" className="pointer-events-auto flex items-center gap-1.5">
        {props.channels.map((channel) => (
          <ChannelButton
            key={channel.id}
            channel={channel}
            feedback={props.feedback}
            motion={props.motion}
            onActivate={props.onActivate}
          />
        ))}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-announcement
      >
        {announcement}
      </div>
    </section>
  );
};
