import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '../../types/channel';
import type { VelocityReadout } from '../../types/velocity-readout';
import type { DockVisibility } from '../../types/visibility';
import type { MotionPreference } from '../../types/motion-preference';
import { CommsDock } from './CommsDock';

const CHANNELS: ReadonlyArray<Channel> = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    iconSrc: '/icons/LinkedIn.svg',
    href: 'https://www.linkedin.com/in/golansofer/',
  },
  {
    id: 'github',
    label: 'GitHub',
    iconSrc: '/icons/Github.svg',
    href: 'https://github.com/golansoffer',
  },
  {
    id: 'gmail',
    label: 'Gmail',
    iconSrc: '/icons/Gmail.svg',
    href: 'mailto:Gsoffer550@gmail.com',
  },
];

const READOUT: VelocityReadout = { kind: 'readout', metersPerSecond: 7, ratio: 0.5 };
const VISIBLE: DockVisibility = { kind: 'visible' };
const HIDDEN: DockVisibility = { kind: 'hidden' };
const NORMAL_MOTION: MotionPreference = { kind: 'normal' };
const REDUCED_MOTION: MotionPreference = { kind: 'reduced' };

const baseProps = {
  channels: CHANNELS,
  readout: READOUT,
  visibility: VISIBLE,
  motion: NORMAL_MOTION,
  onActivate: (): void => {},
};

const channelButtons = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('button').filter((b) => b.dataset['channelButton'] !== undefined);

const buttonForId = (id: string): HTMLElement | undefined =>
  channelButtons().find((b) => b.dataset['channelId'] === id);

afterEach(() => {
  cleanup();
});

describe('CommsDock — visibility', () => {
  it('renders nothing when visibility.kind === "hidden"', () => {
    const { container } = render(<CommsDock {...baseProps} visibility={HIDDEN} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the dock section when visibility.kind === "visible"', () => {
    render(<CommsDock {...baseProps} visibility={VISIBLE} />);
    expect(screen.getByLabelText('Communications')).toBeDefined();
  });
});

describe('CommsDock — rendering', () => {
  it('renders one channel button per channel', () => {
    render(<CommsDock {...baseProps} />);
    expect(channelButtons()).toHaveLength(3);
  });

  it('renders each channel button with an accessible name including its label', () => {
    render(<CommsDock {...baseProps} />);
    for (const channel of CHANNELS) {
      const btn = buttonForId(channel.id);
      expect(btn).toBeDefined();
      expect(btn?.getAttribute('aria-label')).toContain(channel.label);
    }
  });

  it('renders the velocity readout metersPerSecond as displayed text (rounded, zero-padded)', () => {
    render(<CommsDock {...baseProps} readout={{ kind: 'readout', metersPerSecond: 7, ratio: 0.5 }} />);
    expect(screen.getByText('007')).toBeDefined();
  });

  it('zero-pads the readout value to 3 characters at low speeds', () => {
    render(<CommsDock {...baseProps} readout={{ kind: 'readout', metersPerSecond: 0, ratio: 0 }} />);
    expect(screen.getByText('000')).toBeDefined();
  });

  it('renders the readout ratio as the speed bar aria-valuenow', () => {
    render(<CommsDock {...baseProps} readout={{ kind: 'readout', metersPerSecond: 7, ratio: 0.5 }} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0.5');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('1');
    expect(bar.getAttribute('aria-label')).toBe('Ship velocity');
  });
});

describe('CommsDock — events out', () => {
  it('emits onActivate with the channel id when a channel button is clicked', () => {
    const onActivate = vi.fn();
    render(<CommsDock {...baseProps} onActivate={onActivate} />);
    const linkedin = buttonForId('linkedin');
    expect(linkedin).toBeDefined();
    if (linkedin) fireEvent.click(linkedin);
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('linkedin');
  });

  it('emits exactly one onActivate per click (no duplicate-fire path)', () => {
    const onActivate = vi.fn();
    render(<CommsDock {...baseProps} onActivate={onActivate} />);
    const gmail = buttonForId('gmail');
    expect(gmail).toBeDefined();
    if (gmail) {
      fireEvent.keyDown(gmail, { key: 'Enter', code: 'Enter' });
      fireEvent.click(gmail);
    }
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith('gmail');
  });

  it('does not emit onActivate on Tab key', () => {
    const onActivate = vi.fn();
    render(<CommsDock {...baseProps} onActivate={onActivate} />);
    const github = buttonForId('github');
    expect(github).toBeDefined();
    if (github) fireEvent.keyDown(github, { key: 'Tab', code: 'Tab' });
    expect(onActivate).toHaveBeenCalledTimes(0);
  });
});

describe('CommsDock — motion preference', () => {
  it('passes through motion preference "normal" without altering rendered state', () => {
    render(<CommsDock {...baseProps} motion={NORMAL_MOTION} />);
    const dock = screen.getByLabelText('Communications');
    expect(dock.dataset['motion']).toBe('normal');
    for (const btn of channelButtons()) {
      expect(btn.dataset['motion']).toBe('normal');
    }
  });

  it('propagates motion preference "reduced" through to channel buttons', () => {
    render(<CommsDock {...baseProps} motion={REDUCED_MOTION} />);
    const dock = screen.getByLabelText('Communications');
    expect(dock.dataset['motion']).toBe('reduced');
    for (const btn of channelButtons()) {
      expect(btn.dataset['motion']).toBe('reduced');
    }
  });
});
