import type { JSX } from 'react';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

const BLOOM_INTENSITY = 0.6;
const BLOOM_LUMINANCE_THRESHOLD = 0.5;
const BLOOM_LUMINANCE_SMOOTHING = 0.6;
const VIGNETTE_OFFSET = 0.4;
const VIGNETTE_DARKNESS = 0.5;

export const DeepSpacePost = (): JSX.Element => (
  <EffectComposer multisampling={0}>
    <Bloom
      intensity={BLOOM_INTENSITY}
      luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
      luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
    />
    <Vignette offset={VIGNETTE_OFFSET} darkness={VIGNETTE_DARKNESS} />
  </EffectComposer>
);
