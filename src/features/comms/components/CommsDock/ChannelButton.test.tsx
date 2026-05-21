import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import { ChannelButton } from './ChannelButton';

const LINKEDIN_CHANNEL: Channel = {
  id: 'linkedin',
  label: 'LinkedIn',
  iconSrc: '/icons/LinkedIn.svg',
  href: 'https://www.linkedin.com/in/golansofer/',
};

const GMAIL_CHANNEL: Channel = {
  id: 'gmail',
  label: 'Gmail',
  iconSrc: '/icons/Gmail.svg',
  href: 'mailto:Gsoffer550@gmail.com',
};

const baseProps = {
  channel: LINKEDIN_CHANNEL,
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

  it('accessible name includes the channel label', () => {
    render(<ChannelButton {...baseProps} channel={LINKEDIN_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('LinkedIn');
  });

  it('accessible name hints at the link action ("new tab") for http(s) hrefs', () => {
    render(<ChannelButton {...baseProps} channel={LINKEDIN_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/new tab/iu);
  });

  it('accessible name hints at the email action for mailto hrefs', () => {
    render(<ChannelButton {...baseProps} channel={GMAIL_CHANNEL} />);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toMatch(/email/iu);
  });

  it('calls onActivate(id) on click', () => {
    const onActivate = vi.fn();
    render(<ChannelButton {...baseProps} onActivate={onActivate} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('linkedin');
  });

  it('does not register a manual keyDown handler — keyDown(Enter) alone does not fire onActivate', () => {
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
