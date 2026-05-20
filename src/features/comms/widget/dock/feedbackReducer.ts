import type { CopyFeedback, FeedbackEvent } from '../../types/feedback';

export const feedbackReducer = (_state: CopyFeedback, event: FeedbackEvent): CopyFeedback => {
  switch (event.kind) {
    case 'clear':
      return { kind: 'idle' };
    case 'copy_succeeded':
      return { kind: 'success', channelId: event.channelId };
    case 'copy_failed':
      return { kind: 'failed', channelId: event.channelId };
  }
};
