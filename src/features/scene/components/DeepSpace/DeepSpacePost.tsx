import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { VignetteEffect } from 'postprocessing';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import { MAX_SPEED } from '../../services/renderer/integrateMotion';

const VIGNETTE_BASE = 0.5;
const VIGNETTE_SPEED_GAIN = 0.2;
const VIGNETTE_LERP = 0.05;
const VIGNETTE_OFFSET = 0.3;
const BLOOM_LUMINANCE_THRESHOLD = 0.4;
const BLOOM_LUMINANCE_SMOOTHING = 0.6;
const BLOOM_INTENSITY_SCALE = 0.8;
const CA_OFFSET_SCALE = 0.0003;

type DeepSpacePostProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly intensity: number;
  readonly motionResponse: number;
};

export const DeepSpacePost = (props: DeepSpacePostProps): JSX.Element => {
  const currentDarkness = useRef(VIGNETTE_BASE);
  const vignetteEffect = useMemo(
    () => new VignetteEffect({ offset: VIGNETTE_OFFSET, darkness: VIGNETTE_BASE }),
    [],
  );
  const caOffset = useMemo<[number, number]>(
    () => [CA_OFFSET_SCALE * props.intensity, CA_OFFSET_SCALE * props.intensity],
    [props.intensity],
  );

  useFrame(() => {
    const k = props.kinematicsRef.current;
    const speed = Math.hypot(k.velocity.x, k.velocity.z);
    const speedRatio = speed === 0 ? 0 : Math.min(1, speed / MAX_SPEED);
    const target = VIGNETTE_BASE + VIGNETTE_SPEED_GAIN * speedRatio * props.motionResponse;
    currentDarkness.current += (target - currentDarkness.current) * VIGNETTE_LERP;
    vignetteEffect.darkness = currentDarkness.current;
  });

  return (
    <EffectComposer>
      <Bloom
        intensity={BLOOM_INTENSITY_SCALE * props.intensity}
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
        mipmapBlur
      />
      <primitive object={vignetteEffect} />
      <ChromaticAberration offset={caOffset} />
    </EffectComposer>
  );
};
