import { describe, expect, it } from 'vitest';
import { feedbackReducer } from './feedbackReducer';
import type { CopyFeedback } from '../../types/feedback';

const IDLE: CopyFeedback = { kind: 'idle' };

describe('feedbackReducer', () => {
  it('transitions from kind "idle" to kind "success" with channelId on copy_succeeded', () => {
    const result = feedbackReducer(IDLE, { kind: 'copy_succeeded', channelId: 'discord' });
    expect(result).toEqual({ kind: 'success', channelId: 'discord' });
  });

  it('transitions from kind "idle" to kind "failed" with channelId on copy_failed', () => {
    const result = feedbackReducer(IDLE, { kind: 'copy_failed', channelId: 'gmail' });
    expect(result).toEqual({ kind: 'failed', channelId: 'gmail' });
  });

  it('transitions from kind "success" back to kind "idle" on a clear event', () => {
    const state: CopyFeedback = { kind: 'success', channelId: 'discord' };
    expect(feedbackReducer(state, { kind: 'clear' })).toEqual({ kind: 'idle' });
  });

  it('transitions from kind "failed" back to kind "idle" on a clear event', () => {
    const state: CopyFeedback = { kind: 'failed', channelId: 'gmail' };
    expect(feedbackReducer(state, { kind: 'clear' })).toEqual({ kind: 'idle' });
  });

  it('replaces the active channelId when a second copy_succeeded event arrives for a different channel', () => {
    const initial: CopyFeedback = { kind: 'success', channelId: 'discord' };
    const next = feedbackReducer(initial, { kind: 'copy_succeeded', channelId: 'gmail' });
    expect(next).toEqual({ kind: 'success', channelId: 'gmail' });
  });

  it('re-enters kind "success" with the same channelId on a repeat copy_succeeded event (new state object — restart semantics)', () => {
    const initial: CopyFeedback = { kind: 'success', channelId: 'discord' };
    const next = feedbackReducer(initial, { kind: 'copy_succeeded', channelId: 'discord' });
    expect(next).toEqual({ kind: 'success', channelId: 'discord' });
    expect(next).not.toBe(initial);
  });

  it('transitions from kind "failed" to kind "success" when a copy_succeeded arrives for any channel', () => {
    const initial: CopyFeedback = { kind: 'failed', channelId: 'discord' };
    expect(feedbackReducer(initial, { kind: 'copy_succeeded', channelId: 'gmail' })).toEqual({
      kind: 'success',
      channelId: 'gmail',
    });
  });

  it('transitions from kind "success" to kind "failed" when a copy_failed arrives for any channel', () => {
    const initial: CopyFeedback = { kind: 'success', channelId: 'gmail' };
    expect(feedbackReducer(initial, { kind: 'copy_failed', channelId: 'discord' })).toEqual({
      kind: 'failed',
      channelId: 'discord',
    });
  });

  it('returns a fresh state object on copy_failed even when current state is already failed for the same channelId', () => {
    const initial: CopyFeedback = { kind: 'failed', channelId: 'discord' };
    const next = feedbackReducer(initial, { kind: 'copy_failed', channelId: 'discord' });
    expect(next).toEqual(initial);
    expect(next).not.toBe(initial);
  });
});
