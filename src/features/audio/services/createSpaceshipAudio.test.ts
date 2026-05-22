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
