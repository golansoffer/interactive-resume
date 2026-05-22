import { assetUrl } from '@/lib/assetUrl';
import type { AudioChannel, SpaceshipAudio } from '../types/audio-orchestrator';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audio-settings';
import type { AudioBufferLike, AudioContextLike } from './fakeAudioContext';

export type FetchLike = (url: string) => Promise<{
  readonly ok: boolean;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}>;

type SourceKey = 'engine' | 'boost' | 'music';

const SOURCE_KEYS: ReadonlyArray<SourceKey> = ['engine', 'boost', 'music'];

const ASSET_PATHS: Readonly<Record<SourceKey, string>> = {
  engine: '/audio/rocket_engine.mp3',
  boost: '/audio/rocket_boost.mp3',
  music: '/audio/theme.mp3',
};

type PendingState = {
  sceneAlive: boolean;
  boostFactor: number;
  settings: AudioSettings;
};

type CreateSpaceshipAudioDeps = {
  readonly fetch?: FetchLike;
  readonly createContext?: () => AudioContextLike;
};

const noop = (): void => {};

const NOOP_AUDIO: SpaceshipAudio = {
  setSceneAlive: noop,
  setBoost: noop,
  setMuted: noop,
  setVolume: noop,
  dispose: noop,
};

const defaultFetch: FetchLike = (url) => globalThis.fetch(url);

export const createSpaceshipAudio = (deps: CreateSpaceshipAudioDeps = {}): SpaceshipAudio => {
  const fetchImpl = deps.fetch ?? defaultFetch;
  if (deps.createContext === undefined) return NOOP_AUDIO;
  const ctx = deps.createContext();

  const pending: PendingState = {
    sceneAlive: false,
    boostFactor: 0,
    settings: DEFAULT_AUDIO_SETTINGS,
  };

  for (const key of SOURCE_KEYS) {
    const path = ASSET_PATHS[key];
    void fetchImpl(assetUrl(path))
      .then(async (response): Promise<AudioBufferLike | null> => {
        if (!response.ok) return null;
        const data = await response.arrayBuffer();
        return ctx.decodeAudioData(data);
      })
      .catch((): AudioBufferLike | null => null);
  }

  return {
    setSceneAlive: (alive: boolean): void => {
      pending.sceneAlive = alive;
    },
    setBoost: (_active: boolean, factor: number): void => {
      pending.boostFactor = factor;
    },
    setMuted: (muted: boolean): void => {
      pending.settings = { ...pending.settings, muted };
    },
    setVolume: (channel: AudioChannel, value: number): void => {
      pending.settings = { ...pending.settings, [channel]: value };
    },
    dispose: noop,
  };
};
