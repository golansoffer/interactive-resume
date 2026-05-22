export type AudioSettings = {
  readonly muted: boolean;
  readonly master: number;
  readonly music: number;
  readonly engine: number;
  readonly boost: number;
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  master: 0.3,
  music: 0.25,
  engine: 0.1,
  boost: 0.15,
};
