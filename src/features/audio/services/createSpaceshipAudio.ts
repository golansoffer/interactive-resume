import { assetUrl } from '@/lib/assetUrl';
import type { AudioChannel, SpaceshipAudio } from '../types/audio-orchestrator';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audio-settings';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from './fakeAudioContext';

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

const CHANNEL_RAMP_SECONDS = 0.3;
const MUTE_RAMP_SECONDS = 0.15;

type State =
  | { readonly kind: 'pre_gesture' }
  | { readonly kind: 'ready'; readonly graph: ReadyGraph }
  | { readonly kind: 'disposed' };

type ReadyGraph = {
  readonly ctx: AudioContextLike;
  readonly muteGain: GainNodeLike;
  readonly masterGain: GainNodeLike;
  readonly channels: Readonly<Record<SourceKey, GainNodeLike>>;
  readonly sources: {
    engine: AudioBufferSourceNodeLike | null;
    boost: AudioBufferSourceNodeLike | null;
    music: AudioBufferSourceNodeLike | null;
  };
};

type Buffers = {
  engine: AudioBufferLike | null;
  boost: AudioBufferLike | null;
  music: AudioBufferLike | null;
};

type Pending = {
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

const startSource = (
  ctx: AudioContextLike,
  buffer: AudioBufferLike,
  channelGain: GainNodeLike,
): AudioBufferSourceNodeLike => {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(channelGain);
  src.start(0);
  return src;
};

const buildGraph = (ctx: AudioContextLike): ReadyGraph => {
  const muteGain = ctx.createGain();
  const masterGain = ctx.createGain();
  const musicChannel = ctx.createGain();
  const engineChannel = ctx.createGain();
  const boostChannel = ctx.createGain();
  masterGain.connect(muteGain);
  muteGain.connect(ctx.destination);
  musicChannel.connect(masterGain);
  engineChannel.connect(masterGain);
  boostChannel.connect(masterGain);
  return {
    ctx,
    muteGain,
    masterGain,
    channels: { engine: engineChannel, boost: boostChannel, music: musicChannel },
    sources: { engine: null, boost: null, music: null },
  };
};

const applyChannelGains = (graph: ReadyGraph, pending: Pending): void => {
  const now = graph.ctx.currentTime;
  const musicTarget = pending.sceneAlive ? pending.settings.music : 0;
  const engineTarget = pending.sceneAlive ? pending.settings.engine : 0;
  const boostTarget = pending.settings.boost * pending.boostFactor;
  graph.channels.music.gain.linearRampToValueAtTime(musicTarget, now + CHANNEL_RAMP_SECONDS);
  graph.channels.engine.gain.linearRampToValueAtTime(engineTarget, now + CHANNEL_RAMP_SECONDS);
  graph.channels.boost.gain.setValueAtTime(boostTarget, now);
};

const applyMasterAndMute = (graph: ReadyGraph, pending: Pending): void => {
  const now = graph.ctx.currentTime;
  graph.masterGain.gain.setValueAtTime(pending.settings.master, now);
  const muteTarget = pending.settings.muted ? 0 : 1;
  graph.muteGain.gain.linearRampToValueAtTime(muteTarget, now + MUTE_RAMP_SECONDS);
};

const tryStartSourceFor = (
  ctx: AudioContextLike,
  buffers: Buffers,
  getState: () => State,
  key: SourceKey,
): void => {
  const live = getState();
  if (live.kind !== 'ready') return;
  if (live.graph.sources[key] !== null) return;
  const buffer = buffers[key];
  if (buffer === null) return;
  const src = startSource(ctx, buffer, live.graph.channels[key]);
  live.graph.sources[key] = src;
};

// Single async IIFE per key keeps the microtask chain flat: the load flows
// inside one async frame, so a buffer can land and start its source within
// the same microtask cycle the consumer awaits on. Splitting into chained
// `.then(...)` calls extends the chain past what tests can flush.
const beginBufferLoads = (
  ctx: AudioContextLike,
  fetchImpl: FetchLike,
  buffers: Buffers,
  onBufferReady: (key: SourceKey) => void,
): void => {
  for (const key of SOURCE_KEYS) {
    void (async (): Promise<void> => {
      try {
        const response = await fetchImpl(assetUrl(ASSET_PATHS[key]));
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        buffers[key] = buffer;
        onBufferReady(key);
      } catch {
        // Asset load failure: the channel stays silent. Other channels are unaffected.
      }
    })();
  }
};

type PublicApiDeps = {
  readonly pending: Pending;
  readonly getState: () => State;
  readonly onDispose: () => void;
};

const buildPublicApi = (api: PublicApiDeps): SpaceshipAudio => ({
  setSceneAlive: (alive: boolean): void => {
    api.pending.sceneAlive = alive;
    const live = api.getState();
    if (live.kind === 'ready') applyChannelGains(live.graph, api.pending);
  },
  setBoost: (_active: boolean, factor: number): void => {
    api.pending.boostFactor = factor;
  },
  setMuted: (muted: boolean): void => {
    api.pending.settings = { ...api.pending.settings, muted };
  },
  setVolume: (channel: AudioChannel, value: number): void => {
    api.pending.settings = { ...api.pending.settings, [channel]: value };
  },
  dispose: api.onDispose,
});

type GestureWiring = {
  readonly teardown: () => void;
};

const installGestureUnlock = (run: () => Promise<void>): GestureWiring => {
  const onGesture = (): void => {
    void run();
  };
  const teardown = (): void => {
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('pointerdown', onGesture);
  };
  window.addEventListener('keydown', onGesture);
  window.addEventListener('pointerdown', onGesture);
  return { teardown };
};

export const createSpaceshipAudio = (deps: CreateSpaceshipAudioDeps = {}): SpaceshipAudio => {
  const fetchImpl = deps.fetch ?? defaultFetch;
  if (deps.createContext === undefined) return NOOP_AUDIO;
  const ctx = deps.createContext();

  let state: State = { kind: 'pre_gesture' };
  const pending: Pending = {
    sceneAlive: false,
    boostFactor: 0,
    settings: DEFAULT_AUDIO_SETTINGS,
  };
  const buffers: Buffers = { engine: null, boost: null, music: null };
  const tryStartSource = (key: SourceKey): void =>
    tryStartSourceFor(ctx, buffers, () => state, key);

  beginBufferLoads(ctx, fetchImpl, buffers, tryStartSource);

  const unlock = async (): Promise<void> => {
    if (state.kind !== 'pre_gesture') return;
    gesture.teardown();
    await ctx.resume();
    const after: State = state;
    if (after.kind !== 'pre_gesture') return;
    const graph = buildGraph(ctx);
    state = { kind: 'ready', graph };
    applyMasterAndMute(graph, pending);
    applyChannelGains(graph, pending);
    for (const key of SOURCE_KEYS) tryStartSource(key);
  };

  const gesture = installGestureUnlock(unlock);

  return buildPublicApi({
    pending,
    getState: () => state,
    onDispose: (): void => {
      gesture.teardown();
      state = { kind: 'disposed' };
    },
  });
};
