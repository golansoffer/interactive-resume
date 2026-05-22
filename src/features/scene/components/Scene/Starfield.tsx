import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  PARALLAX_FACTOR_NEAR,
  STAR_COUNT_FAR,
  STAR_COUNT_NEAR,
  STAR_RADIUS_FAR,
  STAR_RADIUS_NEAR,
  STAR_SEED,
  STAR_SEED_NEAR,
  buildStarfieldSpec,
  type StarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

// White uniform tint so per-vertex palette colors (cool blue-white, neutral,
// warm white, orange, hot blue) render at their true hue. A coloured tint
// here multiplies into every star and dulls warm tones — keep this neutral.
const STAR_COLOR = '#ffffff';

type StarLayerProps = {
  readonly spec: StarfieldSpec;
  readonly groupRef: RefObject<Group | null>;
  readonly material: ReturnType<typeof buildStarfieldMaterial>;
};

const StarLayer = ({ spec, groupRef, material }: StarLayerProps): JSX.Element => (
  <group ref={groupRef}>
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[spec.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[spec.sizes, 1]} />
        <bufferAttribute attach="attributes-aBrightness" args={[spec.brightness, 1]} />
        <bufferAttribute attach="attributes-aColor" args={[spec.colors, 3]} />
        <bufferAttribute attach="attributes-aLuminous" args={[spec.luminous, 1]} />
        <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
        <bufferAttribute attach="attributes-aTwinkleSpeed" args={[spec.twinkleSpeeds, 1]} />
        <bufferAttribute attach="attributes-aTwinkleSharp" args={[spec.twinkleSharps, 1]} />
        <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  </group>
);

export const Starfield = (): JSX.Element => {
  const farGroupRef = useRef<Group | null>(null);
  const nearGroupRef = useRef<Group | null>(null);

  const farSpec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'far',
        seed: STAR_SEED,
        count: STAR_COUNT_FAR,
        radius: STAR_RADIUS_FAR,
      }),
    [],
  );
  const nearSpec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'near',
        seed: STAR_SEED_NEAR,
        count: STAR_COUNT_NEAR,
        radius: STAR_RADIUS_NEAR,
      }),
    [],
  );

  const material = useMemo(() => buildStarfieldMaterial({ color: STAR_COLOR }), []);

  useFrame((state, delta) => {
    const farGroup = farGroupRef.current;
    const nearGroup = nearGroupRef.current;
    if (farGroup !== null) farGroup.position.copy(state.camera.position);
    if (nearGroup !== null)
      nearGroup.position.copy(state.camera.position).multiplyScalar(PARALLAX_FACTOR_NEAR);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) return;
    uTime.value += delta;
  });

  return (
    <>
      <StarLayer spec={farSpec} groupRef={farGroupRef} material={material} />
      <StarLayer spec={nearSpec} groupRef={nearGroupRef} material={material} />
    </>
  );
};
