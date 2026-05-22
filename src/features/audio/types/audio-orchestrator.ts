export type AudioChannel = 'master' | 'music' | 'engine' | 'boost';

export type SpaceshipAudio = {
  readonly setSceneAlive: (alive: boolean) => void;
  readonly setBoost: (active: boolean, factor: number) => void;
  readonly setMuted: (muted: boolean) => void;
  readonly setVolume: (channel: AudioChannel, value: number) => void;
  readonly dispose: () => void;
};
