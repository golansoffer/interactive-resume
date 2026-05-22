import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioParamLike,
  GainNodeLike,
} from '../types/audio-context';

const wrapNativeParam = (param: AudioParam): AudioParamLike => ({
  get value(): number {
    return param.value;
  },
  set value(next: number) {
    param.value = next;
  },
  setValueAtTime: (value: number, startTime: number): unknown =>
    param.setValueAtTime(value, startTime),
  linearRampToValueAtTime: (value: number, endTime: number): unknown =>
    param.linearRampToValueAtTime(value, endTime),
  cancelScheduledValues: (cancelTime: number): unknown => param.cancelScheduledValues(cancelTime),
});

const wrapNativeGain = (node: GainNode): GainNodeLike => ({
  gain: wrapNativeParam(node.gain),
  connect: (destination: unknown): unknown => {
    if (destination instanceof AudioNode) return node.connect(destination);
    return node;
  },
  disconnect: (): void => node.disconnect(),
});

const wrapNativeBufferSource = (node: AudioBufferSourceNode): AudioBufferSourceNodeLike => ({
  get buffer(): AudioBufferLike | null {
    return node.buffer;
  },
  set buffer(next: AudioBufferLike | null) {
    node.buffer = next instanceof AudioBuffer ? next : null;
  },
  get loop(): boolean {
    return node.loop;
  },
  set loop(next: boolean) {
    node.loop = next;
  },
  connect: (destination: unknown): unknown => {
    if (destination instanceof AudioNode) return node.connect(destination);
    return node;
  },
  disconnect: (): void => node.disconnect(),
  start: (when?: number): void => node.start(when),
  stop: (when?: number): void => node.stop(when),
});

export const createNativeAudioContext = (): AudioContextLike | null => {
  if (typeof window === 'undefined') return null;
  const ctor = window.AudioContext;
  if (ctor === undefined) return null;
  const native = new ctor();
  return {
    get currentTime(): number {
      return native.currentTime;
    },
    destination: native.destination,
    resume: (): Promise<void> => native.resume(),
    createGain: (): GainNodeLike => wrapNativeGain(native.createGain()),
    createBufferSource: (): AudioBufferSourceNodeLike =>
      wrapNativeBufferSource(native.createBufferSource()),
    decodeAudioData: (data: ArrayBuffer): Promise<AudioBufferLike> => native.decodeAudioData(data),
  };
};
