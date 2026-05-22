export type AudioParamLike = {
  value: number;
  setValueAtTime: (value: number, startTime: number) => unknown;
  linearRampToValueAtTime: (value: number, endTime: number) => unknown;
  cancelScheduledValues: (cancelTime: number) => unknown;
};

export type GainNodeLike = {
  readonly gain: AudioParamLike;
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
};

export type AudioBufferLike = {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
};

export type AudioBufferSourceNodeLike = {
  buffer: AudioBufferLike | null;
  loop: boolean;
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};

export type AudioContextLike = {
  readonly currentTime: number;
  readonly destination: unknown;
  resume: () => Promise<void>;
  createGain: () => GainNodeLike;
  createBufferSource: () => AudioBufferSourceNodeLike;
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBufferLike>;
};
