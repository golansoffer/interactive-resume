import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import { ChannelButton } from './ChannelButton';

const LINK_CHANNEL: Channel = {
  kind: 'link',
  id: 'linkedin',
  label: 'LinkedIn',
  iconSrc: '/icons/LinkedIn.svg',
  href: 'https://www.linkedin.com/in/golansofer/',
};

const COPY_CHANNEL: Channel = {
  kind: 'copy',
  id: 'discord',
  label: 'Discord',
  iconSrc: '/icons/Discord.svg',
  value: 'golan618',
};

const GMAIL_CHANNEL: Channel = {
  kind: 'copy',
  id: 'gmail',
  label: 'Gmail',
  iconSrc: '/icons/Gmail.svg',
  value: 'Gsoffer550@gmail.com',
};

const baseProps = {
  channel: COPY_CHANNEL,
  feedback: { kind: 'idle' } as const,
  motion: { kind: 'normal' } as const,
  onActivate: (): void => {},
};

afterEach(() => {
  cleanup();
});

describe('ChannelButton', () => {
  it('renders a button with type="button"', () => {
    render(<ChannelButton {...baseProps} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('accessible name includes the channel label (link channel)', () => {
    render(<ChannelButton {...baseProps} channel={LINK_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('LinkedIn');
  });

  it('accessible name includes the channel label (copy channel)', () => {
    render(<ChannelButton {...baseProps} channel={COPY_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('Discord');
  });

  it('accessible name hints at the link action ("new tab")', () => {
    render(<ChannelButton {...baseProps} channel={LINK_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/new tab/iu);
  });

  it('accessible name hints at the copy action ("Copy")', () => {
    render(<ChannelButton {...baseProps} channel={COPY_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/copy/iu);
  });

  it('calls onActivate(id) on click', () => {
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('discord');
  });

  it('does not register a manual keyDown handler — keyDown(Enter) alone does not fire onActivate', () => {
    // The native <button> element converts Enter/Space into a click in real
    // browsers. JSDOM does not synthesize that click, so a keydown event in
    // isolation must not call onActivate — otherwise a real browser would
    // double-fire (manual handler + native click).
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    expect(onActivate).toHaveBeenCalledTimes(0);
  });

  it('does not register a manual keyDown handler — keyDown(Space) alone does not fire onActivate', () => {
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: ' ', code: 'Space' });
    expect(onActivate).toHaveBeenCalledTimes(0);
  });

  it('does not call onActivate on Tab key', () => {
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Tab', code: 'Tab' });
    expect(onActivate).toHaveBeenCalledTimes(0);
  });

  it('emits exactly one onActivate per click (no duplicate-fire path)', () => {
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(btn);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('data-feedback is "idle" when feedback.kind === idle', () => {
    render(<ChannelButton {...baseProps} feedback={{ kind: 'idle' }} />);
    expect(screen.getByRole('button').dataset['feedback']).toBe('idle');
  });

  it('data-feedback is "success" when feedback matches this channel', () => {
    render(
      <ChannelButton
        {...baseProps}
        feedback={{ kind: 'success', channelId: 'discord' }}
      />,
    );
    expect(screen.getByRole('button').dataset['feedback']).toBe('success');
  });

  it('data-feedback is "failed" when feedback matches this channel', () => {
    render(
      <ChannelButton
        {...baseProps}
        feedback={{ kind: 'failed', channelId: 'discord' }}
      />,
    );
    expect(screen.getByRole('button').dataset['feedback']).toBe('failed');
  });

  it('data-feedback is "idle" when feedback targets a different channel', () => {
    render(
      <ChannelButton
        {...baseProps}
        channel={GMAIL_CHANNEL}
        feedback={{ kind: 'success', channelId: 'discord' }}
      />,
    );
    expect(screen.getByRole('button').dataset['feedback']).toBe('idle');
  });

  it('data-kind reflects the channel kind', () => {
    const { rerender } = render(<ChannelButton {...baseProps} channel={LINK_CHANNEL} />);
    expect(screen.getByRole('button').dataset['kind']).toBe('link');
    rerender(<ChannelButton {...baseProps} channel={COPY_CHANNEL} />);
    expect(screen.getByRole('button').dataset['kind']).toBe('copy');
  });

  it('data-motion propagates the motion preference', () => {
    const { rerender } = render(
      <ChannelButton {...baseProps} motion={{ kind: 'normal' }} />,
    );
    expect(screen.getByRole('button').dataset['motion']).toBe('normal');
    rerender(<ChannelButton {...baseProps} motion={{ kind: 'reduced' }} />);
    expect(screen.getByRole('button').dataset['motion']).toBe('reduced');
  });

  it('icon image has empty alt (aria-label owns the accessible name)', () => {
    const { container } = render(<ChannelButton {...baseProps} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0]?.getAttribute('alt')).toBe('');
  });
});
