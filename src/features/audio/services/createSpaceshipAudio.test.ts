import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSpaceshipAudio, type FetchLike } from './createSpaceshipAudio';
import {
  createFakeAudioContext,
  type AudioContextLike,
  type FakeContextHandle,
} from './fakeAudioContext';

type Deps = {
  readonly fetch: FetchLike;
  readonly fetchMock: ReturnType<typeof vi.fn>;
  readonly createContext: () => AudioContextLike;
  readonly handle: FakeContextHandle;
};

const setupDeps = (): Deps => {
  const handle = createFakeAudioContext();
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8)),
    }),
  );
  const fetch: FetchLike = fetchMock;
  return {
    fetch,
    fetchMock,
    createContext: (): AudioContextLike => handle.ctx,
    handle,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createSpaceshipAudio — pre-gesture', () => {
  it('initiates a fetch for each of the three audio files', () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    expect(deps.fetchMock).toHaveBeenCalledTimes(3);
    const calls = deps.fetchMock.mock.calls.map((args) => String(args[0]));
    expect(calls.some((url) => url.endsWith('/audio/rocket_engine.mp3'))).toBe(true);
    expect(calls.some((url) => url.endsWith('/audio/rocket_boost.mp3'))).toBe(true);
    expect(calls.some((url) => url.endsWith('/audio/theme.mp3'))).toBe(true);
  });

  it('does not create any gain nodes or sources before a gesture', () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setBoost(true, 0.5);
    audio.setMuted(true);
    audio.setVolume('master', 0.5);
    expect(deps.handle.gains.length).toBe(0);
    expect(deps.handle.sources.length).toBe(0);
  });

  it('leaves the AudioContext in suspended state before a gesture', () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    expect(deps.handle.ctx.state).toBe('suspended');
  });
});

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('createSpaceshipAudio — gesture unlock', () => {
  it('keydown anywhere on window triggers ctx.resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('running');
  });

  it('pointerdown anywhere on window triggers ctx.resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new PointerEvent('pointerdown'));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('running');
  });

  it('after gesture, builds the gain graph (muteGain, masterGain, 3 channel gains)', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.gains.length).toBe(5);
  });

  it('after gesture, starts the engine and boost sources (music starts when its buffer arrives)', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = deps.handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBeGreaterThanOrEqual(2);
  });

  it('subsequent keydown events do not re-trigger resume', async () => {
    const deps = setupDeps();
    createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    const resumeSpy = vi.spyOn(deps.handle.ctx, 'resume');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    await flushMicrotasks();
    expect(resumeSpy).toHaveBeenCalledTimes(1);
  });
});

const findChannelGains = (
  handle: FakeContextHandle,
): { music: number; engine: number; boost: number; master: number; mute: number } => {
  // Graph build order in the service: muteGain, masterGain, music, engine, boost.
  const [mute, master, music, engine, boost] = handle.gains;
  return {
    mute: mute?.gain.value ?? -1,
    master: master?.gain.value ?? -1,
    music: music?.gain.value ?? -1,
    engine: engine?.gain.value ?? -1,
    boost: boost?.gain.value ?? -1,
  };
};

describe('createSpaceshipAudio — setSceneAlive', () => {
  it('after unlock with sceneAlive=true, engine and music channel gains equal their settings values', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setVolume('engine', 0.4);
    audio.setVolume('music', 0.5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0.4, 5);
    expect(gains.music).toBeCloseTo(0.5, 5);
  });

  it('after unlock with sceneAlive=false, engine and music channel gains are 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0, 5);
    expect(gains.music).toBeCloseTo(0, 5);
  });

  it('setSceneAlive(false) after ready ramps engine and music to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setSceneAlive(false);
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0, 5);
    expect(gains.music).toBeCloseTo(0, 5);
  });

  it('setSceneAlive(true) after a previous false re-raises engine and music to settings values', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('engine', 0.4);
    audio.setVolume('music', 0.5);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setSceneAlive(false);
    audio.setSceneAlive(true);
    const gains = findChannelGains(deps.handle);
    expect(gains.engine).toBeCloseTo(0.4, 5);
    expect(gains.music).toBeCloseTo(0.5, 5);
  });
});

describe('createSpaceshipAudio — setBoost', () => {
  it('setBoost(true, 0.5) with settings.boost=0.7 sets boost gain to 0.35', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('boost', 0.7);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 0.5);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.35, 5);
  });

  it('setBoost(false, 0) sets boost gain to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 1);
    audio.setBoost(false, 0);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0, 5);
  });

  it('setBoost called before gesture is applied at unlock', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setVolume('boost', 0.7);
    audio.setBoost(true, 0.8);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.7 * 0.8, 5);
  });
});

describe('createSpaceshipAudio — setMuted', () => {
  it('setMuted(true) after ready ramps muteGain to 0', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    expect(findChannelGains(deps.handle).mute).toBeCloseTo(0, 5);
  });

  it('setMuted(false) after ready ramps muteGain to 1', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    audio.setMuted(false);
    expect(findChannelGains(deps.handle).mute).toBeCloseTo(1, 5);
  });

  it('setMuted does not change master, engine, music, or boost gains', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    audio.setVolume('master', 0.5);
    audio.setVolume('music', 0.4);
    audio.setVolume('engine', 0.3);
    audio.setVolume('boost', 0.6);
    audio.setBoost(true, 1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setMuted(true);
    const gains = findChannelGains(deps.handle);
    expect(gains.master).toBeCloseTo(0.5, 5);
    expect(gains.music).toBeCloseTo(0.4, 5);
    expect(gains.engine).toBeCloseTo(0.3, 5);
    expect(gains.boost).toBeCloseTo(0.6, 5);
  });
});

describe('createSpaceshipAudio — setVolume', () => {
  it("setVolume('master', 0.5) sets masterGain to 0.5", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('master', 0.5);
    expect(findChannelGains(deps.handle).master).toBeCloseTo(0.5, 5);
  });

  it("setVolume('music', 0.3) while sceneAlive=true sets musicChannel to 0.3", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('music', 0.3);
    expect(findChannelGains(deps.handle).music).toBeCloseTo(0.3, 5);
  });

  it("setVolume('music', 0.3) while sceneAlive=false leaves musicChannel at 0", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('music', 0.3);
    expect(findChannelGains(deps.handle).music).toBeCloseTo(0, 5);
  });

  it("setVolume('engine', 0.2) while sceneAlive=true sets engineChannel to 0.2", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.setSceneAlive(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setVolume('engine', 0.2);
    expect(findChannelGains(deps.handle).engine).toBeCloseTo(0.2, 5);
  });

  it("setVolume('boost', 0.4) with boostFactor=0.6 sets boostChannel to 0.24", async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.setBoost(true, 0.6);
    audio.setVolume('boost', 0.4);
    expect(findChannelGains(deps.handle).boost).toBeCloseTo(0.24, 5);
  });
});

type FetchResponse = { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> };

const noopResolve = (_response: FetchResponse): void => {};

describe('createSpaceshipAudio — late buffer arrival', () => {
  it('starts the music source after the gesture if the music buffer decodes later', async () => {
    const handle = createFakeAudioContext();
    let resolveMusic: (response: FetchResponse) => void = noopResolve;
    const musicPromise = new Promise<FetchResponse>((resolve) => {
      resolveMusic = resolve;
    });
    const fetchStub: FetchLike = (url) => {
      if (url.endsWith('/audio/theme.mp3')) return musicPromise;
      return Promise.resolve({
        ok: true,
        arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8)),
      });
    };
    createSpaceshipAudio({ fetch: fetchStub, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedBeforeMusic = handle.sources.filter((src) => src.started).length;
    expect(startedBeforeMusic).toBe(2);
    resolveMusic({
      ok: true,
      arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8)),
    });
    await flushMicrotasks();
    const startedAfterMusic = handle.sources.filter((src) => src.started).length;
    expect(startedAfterMusic).toBe(3);
  });
});

describe('createSpaceshipAudio — dispose', () => {
  it('dispose() before gesture: subsequent gesture is a no-op (state stays suspended)', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    audio.dispose();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    expect(deps.handle.ctx.state).toBe('suspended');
    expect(deps.handle.gains.length).toBe(0);
    expect(deps.handle.sources.length).toBe(0);
  });

  it('dispose() after ready: stops all started sources', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.dispose();
    const stoppedCount = deps.handle.sources.filter((src) => src.stopped).length;
    expect(stoppedCount).toBe(deps.handle.sources.length);
  });

  it('setters after dispose do not throw and do not affect gains', async () => {
    const deps = setupDeps();
    const audio = createSpaceshipAudio({ fetch: deps.fetch, createContext: deps.createContext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    audio.dispose();
    const before = findChannelGains(deps.handle);
    audio.setSceneAlive(true);
    audio.setBoost(true, 1);
    audio.setMuted(true);
    audio.setVolume('master', 0.123);
    const after = findChannelGains(deps.handle);
    expect(after).toEqual(before);
  });
});

const fetchStubBoostNotOk: FetchLike = (url) => {
  if (url.endsWith('/audio/rocket_boost.mp3')) {
    return Promise.resolve({
      ok: false,
      arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(0)),
    });
  }
  return Promise.resolve({
    ok: true,
    arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8)),
  });
};

const fetchStubAllOk: FetchLike = () =>
  Promise.resolve({
    ok: true,
    arrayBuffer: (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8)),
  });

describe('createSpaceshipAudio — asset failure', () => {
  it('per-file fetch failure: that channel stays silent; others start', async () => {
    const handle = createFakeAudioContext();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    createSpaceshipAudio({ fetch: fetchStubBoostNotOk, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('per-file decode rejection: that channel stays silent; others start', async () => {
    const handle = createFakeAudioContext();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    const originalDecode = handle.ctx.decodeAudioData.bind(handle.ctx);
    let decodeCallCount = 0;
    Object.defineProperty(handle.ctx, 'decodeAudioData', {
      value: (data: ArrayBuffer): ReturnType<typeof handle.ctx.decodeAudioData> => {
        decodeCallCount += 1;
        if (decodeCallCount === 1) return Promise.reject(new Error('decode failed'));
        return originalDecode(data);
      },
    });
    createSpaceshipAudio({ fetch: fetchStubAllOk, createContext: () => handle.ctx });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await flushMicrotasks();
    const startedCount = handle.sources.filter((src) => src.started).length;
    expect(startedCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
