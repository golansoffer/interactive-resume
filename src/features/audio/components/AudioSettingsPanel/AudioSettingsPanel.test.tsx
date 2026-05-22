import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { AudioSettingsPanel } from './AudioSettingsPanel';

const noop = (): void => {};

afterEach(() => {
  cleanup();
});

describe('AudioSettingsPanel', () => {
  const baseProps = {
    id: 'panel',
    settings: DEFAULT_AUDIO_SETTINGS,
    onSetVolume: noop,
    onReset: noop,
  };

  it('renders four labeled sliders: Master, Music, Engine, Boost', () => {
    render(<AudioSettingsPanel {...baseProps} />);
    expect(screen.getByRole('slider', { name: 'Master' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Music' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Engine' })).toBeDefined();
    expect(screen.getByRole('slider', { name: 'Boost' })).toBeDefined();
  });

  it('reflects the settings values on each slider', () => {
    const settings = { muted: false, master: 0.8, music: 0.5, engine: 0.4, boost: 0.7 };
    render(<AudioSettingsPanel {...baseProps} settings={settings} />);
    const master = screen.getByRole('slider', { name: 'Master' });
    const music = screen.getByRole('slider', { name: 'Music' });
    const engine = screen.getByRole('slider', { name: 'Engine' });
    const boost = screen.getByRole('slider', { name: 'Boost' });
    if (!(master instanceof HTMLInputElement)) throw new Error('master not input');
    if (!(music instanceof HTMLInputElement)) throw new Error('music not input');
    if (!(engine instanceof HTMLInputElement)) throw new Error('engine not input');
    if (!(boost instanceof HTMLInputElement)) throw new Error('boost not input');
    expect(master.value).toBe('80');
    expect(music.value).toBe('50');
    expect(engine.value).toBe('40');
    expect(boost.value).toBe('70');
  });

  it('fires onSetVolume with the master channel when the master slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '20' } });
    expect(onSetVolume).toHaveBeenCalledWith('master', 0.2);
  });

  it('fires onSetVolume with the music channel when the music slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Music' }), { target: { value: '33' } });
    expect(onSetVolume).toHaveBeenCalledWith('music', 0.33);
  });

  it('fires onSetVolume with the engine channel when the engine slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Engine' }), { target: { value: '15' } });
    expect(onSetVolume).toHaveBeenCalledWith('engine', 0.15);
  });

  it('fires onSetVolume with the boost channel when the boost slider changes', () => {
    const onSetVolume = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onSetVolume={onSetVolume} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Boost' }), { target: { value: '90' } });
    expect(onSetVolume).toHaveBeenCalledWith('boost', 0.9);
  });

  it('fires onReset when the reset button is clicked', () => {
    const onReset = vi.fn();
    render(<AudioSettingsPanel {...baseProps} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('sets the container id for aria-controls linkage', () => {
    const { container } = render(<AudioSettingsPanel {...baseProps} id="my-panel" />);
    expect(container.querySelector('#my-panel')).not.toBeNull();
  });
});
