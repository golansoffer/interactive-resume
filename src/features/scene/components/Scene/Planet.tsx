import type { JSX } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { PlanetProjection } from '../../types/projections';

type PlanetProps = {
  readonly planet: PlanetProjection;
};

const PLANET_RADIUS = 1.2;
const PLANET_SEGMENTS_LON = 32;
const PLANET_SEGMENTS_LAT = 24;
const ROTATION_RAD_PER_SEC = 0.18;

export const Planet = (props: PlanetProps): JSX.Element => {
  const meshRef = useRef<Mesh | null>(null);

  useFrame((_root, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    mesh.rotation.y += ROTATION_RAD_PER_SEC * delta;
  });

  return (
    <mesh ref={meshRef} position={props.planet.planet.placement}>
      <sphereGeometry args={[PLANET_RADIUS, PLANET_SEGMENTS_LON, PLANET_SEGMENTS_LAT]} />
      <meshStandardMaterial color={props.planet.planet.color} roughness={0.55} metalness={0.15} />
    </mesh>
  );
};
