import type { JSX } from 'react';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

const BLOOM_INTENSITY = 0.7;
const BLOOM_LUMINANCE_THRESHOLD = 0.4;
const BLOOM_LUMINANCE_SMOOTHING = 0.6;
const VIGNETTE_OFFSET = 0.3;
const VIGNETTE_DARKNESS = 0.55;

export const DeepSpacePost = (): JSX.Element => (
  <EffectComposer>
    <Bloom
      intensity={BLOOM_INTENSITY}
      luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
      luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
      mipmapBlur
    />
    <Vignette offset={VIGNETTE_OFFSET} darkness={VIGNETTE_DARKNESS} />
  </EffectComposer>
);
