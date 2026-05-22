import { createNativeAudioContext } from './nativeAudioContext';
import { createSpaceshipAudio } from './createSpaceshipAudio';
import type { SpaceshipAudio } from '../types/audio-orchestrator';

export type BrowserAudio =
  | { readonly kind: 'audio'; readonly audio: SpaceshipAudio }
  | { readonly kind: 'unsupported' };

export const createBrowserSpaceshipAudio = (): BrowserAudio => {
  const ctx = createNativeAudioContext();
  if (ctx === null) return { kind: 'unsupported' };
  return {
    kind: 'audio',
    audio: createSpaceshipAudio({ createContext: () => ctx }),
  };
};
