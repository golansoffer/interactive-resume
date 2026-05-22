import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioParamLike,
  GainNodeLike,
} from '../types/audio-context';

// Wrappers carry a hidden reference to the native node they wrap so that a
// downstream wrapper.connect(otherWrapper) can resolve to the native graph
// edge. Without this, every wrapper-to-wrapper connect would no-op (since
// the wrapper object is not an `instanceof AudioNode`), leaving the only
// working edge to be the one terminating at `ctx.destination` — the rest of
// the graph would be silently disconnected.
const NATIVE_NODE = '__nativeNode__' as const;

type NativeRef<T extends AudioNode> = { readonly [NATIVE_NODE]: T };

const nativeOf = (value: unknown): AudioNode | null => {
  if (value instanceof AudioNode) return value;
  if (typeof value !== 'object' || value === null) return null;
  if (!(NATIVE_NODE in value)) return null;
  const inner = (value as Record<string, unknown>)[NATIVE_NODE];
  return inner instanceof AudioNode ? inner : null;
};

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

const wrapNativeGain = (node: GainNode): GainNodeLike & NativeRef<GainNode> => ({
  [NATIVE_NODE]: node,
  gain: wrapNativeParam(node.gain),
  connect: (destination: unknown): unknown => {
    const target = nativeOf(destination);
    if (target === null) return node;
    return node.connect(target);
  },
  disconnect: (): void => node.disconnect(),
});

const wrapNativeBufferSource = (
  node: AudioBufferSourceNode,
): AudioBufferSourceNodeLike & NativeRef<AudioBufferSourceNode> => ({
  [NATIVE_NODE]: node,
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
    const target = nativeOf(destination);
    if (target === null) return node;
    return node.connect(target);
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
