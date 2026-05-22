import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAudioSettings } from '../../schema/parseAudioSettings';
import { DEFAULT_AUDIO_SETTINGS } from '../../types/audio-settings';
import { AudioControlsWidget } from './AudioControlsWidget';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('AudioControlsWidget', () => {
  it('mounts the mute toggle and settings trigger', () => {
    render(<AudioControlsWidget />);
    expect(screen.getByRole('button', { name: 'Mute audio' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Audio settings' })).toBeDefined();
  });

  it('does not render the panel by default', () => {
    render(<AudioControlsWidget />);
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('clicking the settings trigger opens the panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    expect(screen.getByRole('group', { name: 'Audio settings' })).toBeDefined();
  });

  it('clicking the settings trigger again closes the panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('pressing Escape closes an open panel', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Audio settings' })).toBeNull();
  });

  it('clicking the mute button flips the mute state and re-renders with the unmute label', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute audio' }));
    expect(screen.getByRole('button', { name: 'Unmute audio' })).toBeDefined();
  });

  it('changing the master slider persists to localStorage', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '25' } });
    const raw = window.localStorage.getItem('audio.settings');
    if (raw === null) throw new Error('expected stored settings');
    const stored = parseAudioSettings(JSON.parse(raw));
    expect(stored.master).toBe(0.25);
  });

  it('clicking Reset to defaults restores all sliders', () => {
    render(<AudioControlsWidget />);
    fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const master = screen.getByRole('slider', { name: 'Master' });
    if (!(master instanceof HTMLInputElement)) throw new Error('master not input');
    expect(master.value).toBe(String(Math.round(DEFAULT_AUDIO_SETTINGS.master * 100)));
  });
});
