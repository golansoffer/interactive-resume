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
