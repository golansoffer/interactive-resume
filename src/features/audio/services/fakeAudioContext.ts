import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioParamLike,
  GainNodeLike,
} from '../types/audio-context';

const noop = (): void => {};

export type FakeAudioContext = AudioContextLike & {
  state: 'suspended' | 'running' | 'closed';
};

export type FakeAudioBufferSourceNode = AudioBufferSourceNodeLike & {
  started: boolean;
  stopped: boolean;
};

export type FakeContextHandle = {
  readonly ctx: FakeAudioContext;
  readonly advanceTime: (seconds: number) => void;
  readonly gains: ReadonlyArray<GainNodeLike>;
  readonly sources: ReadonlyArray<FakeAudioBufferSourceNode>;
};

const createParam = (initial: number): AudioParamLike => {
  const param: AudioParamLike = {
    value: initial,
    setValueAtTime(value: number): AudioParamLike {
      param.value = value;
      return param;
    },
    linearRampToValueAtTime(value: number): AudioParamLike {
      param.value = value;
      return param;
    },
    cancelScheduledValues(): AudioParamLike {
      return param;
    },
  };
  return param;
};

const createGainNode = (): GainNodeLike => ({
  gain: createParam(1),
  connect: (destination: unknown): unknown => destination,
  disconnect: noop,
});

const createBufferSource = (): FakeAudioBufferSourceNode => {
  const node: FakeAudioBufferSourceNode = {
    buffer: null,
    loop: false,
    started: false,
    stopped: false,
    connect: (destination: unknown): unknown => destination,
    disconnect: noop,
    start: (): void => {
      node.started = true;
    },
    stop: (): void => {
      node.stopped = true;
    },
  };
  return node;
};

const createBuffer = (): AudioBufferLike => ({
  duration: 1,
  numberOfChannels: 2,
  sampleRate: 44100,
});

export const createFakeAudioContext = (): FakeContextHandle => {
  const gains: GainNodeLike[] = [];
  const sources: FakeAudioBufferSourceNode[] = [];
  let currentTime = 0;
  const ctx: FakeAudioContext = {
    state: 'suspended',
    get currentTime(): number {
      return currentTime;
    },
    destination: { fake: true },
    resume(): Promise<void> {
      ctx.state = 'running';
      return Promise.resolve();
    },
    createGain(): GainNodeLike {
      const node = createGainNode();
      gains.push(node);
      return node;
    },
    createBufferSource(): AudioBufferSourceNodeLike {
      const node = createBufferSource();
      sources.push(node);
      return node;
    },
    decodeAudioData(): Promise<AudioBufferLike> {
      return Promise.resolve(createBuffer());
    },
  };
  return {
    ctx,
    advanceTime: (seconds: number): void => {
      currentTime += seconds;
    },
    gains,
    sources,
  };
};
