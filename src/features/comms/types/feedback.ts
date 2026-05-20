import type { ChannelId } from './channel';

export type CopyFeedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'success'; readonly channelId: ChannelId }
  | { readonly kind: 'failed'; readonly channelId: ChannelId };

export type FeedbackEvent =
  | { readonly kind: 'copy_succeeded'; readonly channelId: ChannelId }
  | { readonly kind: 'copy_failed'; readonly channelId: ChannelId }
  | { readonly kind: 'clear' };
