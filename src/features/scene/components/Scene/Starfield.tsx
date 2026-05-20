import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  STAR_COUNT,
  STAR_RADIUS,
  STAR_SEED,
  buildStarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

const STAR_COLOR = '#cfd9ff';
const TWINKLE_SPEED = 1.6;

export const Starfield = (): JSX.Element => {
  const groupRef = useRef<Group | null>(null);

  const spec = useMemo(
    () => buildStarfieldSpec({ seed: STAR_SEED, count: STAR_COUNT, radius: STAR_RADIUS }),
    [],
  );

  const material = useMemo(
    () => buildStarfieldMaterial({ color: STAR_COLOR, twinkleSpeed: TWINKLE_SPEED }),
    [],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group === null) return;
    group.position.copy(state.camera.position);
    const uTime = material.uniforms['uTime'];
    if (uTime === undefined) return;
    uTime.value += delta;
  });

  return (
    <group ref={groupRef}>
      <points renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[spec.positions, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[spec.sizes, 1]} />
          <bufferAttribute attach="attributes-aBrightness" args={[spec.brightness, 1]} />
          <bufferAttribute attach="attributes-aTwinkleAmp" args={[spec.twinkleAmps, 1]} />
          <bufferAttribute attach="attributes-aTwinklePhase" args={[spec.twinklePhases, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
};
