import { describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from './audio-settings';
import { parseAudioSettings } from './parseAudioSettings';

describe('parseAudioSettings', () => {
  it('returns defaults when input is null', () => {
    expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when input is undefined', () => {
    const absent: unknown = undefined;
    expect(parseAudioSettings(absent)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when input is a non-object primitive', () => {
    expect(parseAudioSettings(42)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings('hello')).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(parseAudioSettings(true)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when fields are missing', () => {
    expect(parseAudioSettings({ muted: true })).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('parses a fully-valid settings object', () => {
    const input = { muted: true, master: 0.5, music: 0.3, engine: 0.2, boost: 0.9 };
    expect(parseAudioSettings(input)).toEqual(input);
  });

  it('clamps a volume above 1 to 1', () => {
    const input = { muted: false, master: 5.0, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input).master).toBe(1.0);
  });

  it('clamps a negative volume to 0', () => {
    const input = { muted: false, master: -0.3, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input).master).toBe(0);
  });

  it('returns defaults when a volume is not a finite number', () => {
    const input = { muted: false, master: NaN, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('returns defaults when muted is not a boolean', () => {
    const input = { muted: 'yes', master: 0.5, music: 0.5, engine: 0.5, boost: 0.5 };
    expect(parseAudioSettings(input)).toEqual(DEFAULT_AUDIO_SETTINGS);
  });
});
