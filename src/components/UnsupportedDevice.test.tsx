import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UnsupportedDevice } from './UnsupportedDevice';

afterEach(() => {
  cleanup();
});

describe('UnsupportedDevice', () => {
  it('renders the SIGNAL · DESKTOP REQUIRED eyebrow', () => {
    render(<UnsupportedDevice />);
    expect(screen.getByText(/SIGNAL\s+·\s+DESKTOP REQUIRED/u)).toBeDefined();
  });

  it('renders exactly one level-1 heading with the canonical title', () => {
    render(<UnsupportedDevice />);
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Open this on desktop.',
    });
    expect(heading.textContent).toBe('Open this on desktop.');
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBe(1);
  });

  it('renders body copy mentioning mouse, keyboard, and desktop browser', () => {
    render(<UnsupportedDevice />);
    expect(screen.getByText(/mouse/u)).toBeDefined();
    expect(screen.getByText(/keyboard/u)).toBeDefined();
    expect(screen.getByText(/desktop browser/u)).toBeDefined();
  });

  it('renders exactly four [data-hud-corner] elements, each aria-hidden', () => {
    const { container } = render(<UnsupportedDevice />);
    const corners = container.querySelectorAll('[data-hud-corner]');
    expect(corners.length).toBe(4);
    for (const corner of corners) {
      expect(corner.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
