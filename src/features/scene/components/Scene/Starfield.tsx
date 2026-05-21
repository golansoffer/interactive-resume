import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  STAR_COUNT_FAR,
  STAR_RADIUS_FAR,
  STAR_SEED,
  buildStarfieldSpec,
} from '../../services/renderer/starfieldSpec';
import { buildStarfieldMaterial } from '../../services/renderer/starfieldMaterial';

const STAR_COLOR = '#cfd9ff';

export const Starfield = (): JSX.Element => {
  const groupRef = useRef<Group | null>(null);

  const spec = useMemo(
    () =>
      buildStarfieldSpec({
        layer: 'far',
        seed: STAR_SEED,
        count: STAR_COUNT_FAR,
        radius: STAR_RADIUS_FAR,
      }),
    [],
  );

  const material = useMemo(() => buildStarfieldMaterial({ color: STAR_COLOR }), []);

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
};
