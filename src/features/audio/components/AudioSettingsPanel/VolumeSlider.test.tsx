import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VolumeSlider } from './VolumeSlider';

const noop = (): void => {};

afterEach(() => {
  cleanup();
});

describe('VolumeSlider', () => {
  it('renders the label', () => {
    render(<VolumeSlider label="Master" value={0.8} onChange={noop} />);
    expect(screen.getByText('Master')).toBeDefined();
  });

  it('renders the percentage readout rounded to nearest integer', () => {
    render(<VolumeSlider label="Music" value={0.456} onChange={noop} />);
    expect(screen.getByText('46%')).toBeDefined();
  });

  it('renders 0% for value 0', () => {
    render(<VolumeSlider label="Engine" value={0} onChange={noop} />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders 100% for value 1', () => {
    render(<VolumeSlider label="Boost" value={1} onChange={noop} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('range input has value matching value * 100', () => {
    render(<VolumeSlider label="Master" value={0.8} onChange={noop} />);
    const input = screen.getByRole('slider');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('slider is not an HTMLInputElement');
    }
    expect(input.value).toBe('80');
  });

  it('fires onChange with value / 100 when input changes', () => {
    const onChange = vi.fn();
    render(<VolumeSlider label="Master" value={0.5} onChange={onChange} />);
    const input = screen.getByRole('slider');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('slider is not an HTMLInputElement');
    }
    fireEvent.change(input, { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.65);
  });

  it('has aria attributes for screen readers', () => {
    render(<VolumeSlider label="Music" value={0.3} onChange={noop} />);
    const input = screen.getByRole('slider');
    expect(input.getAttribute('aria-label')).toBe('Music');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('100');
    expect(input.getAttribute('aria-valuenow')).toBe('30');
  });
});
