import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MuteToggle } from './MuteToggle';

const noop = (): void => {};

afterEach(() => {
  cleanup();
});

describe('MuteToggle', () => {
  it('renders a button with the unmuted aria-label when muted=false', () => {
    render(<MuteToggle muted={false} onToggle={noop} />);
    expect(screen.getByRole('button', { name: 'Mute audio' })).toBeDefined();
  });

  it('renders a button with the muted aria-label when muted=true', () => {
    render(<MuteToggle muted={true} onToggle={noop} />);
    expect(screen.getByRole('button', { name: 'Unmute audio' })).toBeDefined();
  });

  it('sets aria-pressed to match muted', () => {
    const { rerender } = render(<MuteToggle muted={false} onToggle={noop} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    rerender(<MuteToggle muted={true} onToggle={noop} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('fires onToggle exactly once when clicked', () => {
    const onToggle = vi.fn();
    render(<MuteToggle muted={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
