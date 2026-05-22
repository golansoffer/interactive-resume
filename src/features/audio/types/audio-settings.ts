export type AudioSettings = {
  readonly muted: boolean;
  readonly master: number;
  readonly music: number;
  readonly engine: number;
  readonly boost: number;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 0.5,
  music: 1.0,
  engine: 0.3,
  boost: 0.4,
};
