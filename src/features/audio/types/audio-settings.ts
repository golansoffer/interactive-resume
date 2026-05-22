export type AudioSettings = {
  readonly muted: boolean;
  readonly master: number;
  readonly music: number;
  readonly engine: number;
  readonly boost: number;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 1.0,
  music: 0.5,
  engine: 0.4,
  boost: 0.7,
};
