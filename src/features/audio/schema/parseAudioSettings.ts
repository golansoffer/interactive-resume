import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audio-settings';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseVolume = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const parseAudioSettings = (raw: unknown): AudioSettings => {
  if (!isRecord(raw)) return DEFAULT_AUDIO_SETTINGS;
  if (typeof raw['muted'] !== 'boolean') return DEFAULT_AUDIO_SETTINGS;
  const master = parseVolume(raw['master']);
  const music = parseVolume(raw['music']);
  const engine = parseVolume(raw['engine']);
  const boost = parseVolume(raw['boost']);
  if (master === null || music === null || engine === null || boost === null) {
    return DEFAULT_AUDIO_SETTINGS;
  }
  return { muted: raw['muted'], master, music, engine, boost };
};
