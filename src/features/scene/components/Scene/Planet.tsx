import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
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

// Idle wobble — planets are always "at rest" (no acceleration), so the
// wobble runs at full amplitude. Slower than the ship's idle for a
// heavier feel. Phase derived from CompanyId so planets don't bob in unison.
const PLANET_BOB_AMPLITUDE = 0.08;
const PLANET_BOB_FREQ_HZ = 0.22;
const PLANET_SWAY_AMPLITUDE = Math.PI / 180;
const PLANET_SWAY_FREQ_HZ = 0.13;
const TWO_PI = Math.PI * 2;

const idEncoder = new TextEncoder();

const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) {
    hash = (hash * 31 + byte) % 1000;
  }
  return (hash / 1000) * TWO_PI;
};

export const Planet = (props: PlanetProps): JSX.Element => {
  const meshRef = useRef<Mesh | null>(null);
  const phase = useMemo(() => phaseFromId(props.planet.id), [props.planet.id]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    mesh.rotation.y += ROTATION_RAD_PER_SEC * delta;
    const time = state.clock.elapsedTime;
    const bobY = Math.sin(time * PLANET_BOB_FREQ_HZ * TWO_PI + phase) * PLANET_BOB_AMPLITUDE;
    const swayZ =
      Math.sin(time * PLANET_SWAY_FREQ_HZ * TWO_PI + phase * 1.3) * PLANET_SWAY_AMPLITUDE;
    mesh.position.y = props.planet.planet.placement[1] + bobY;
    mesh.rotation.z = swayZ;
  });

  return (
    <mesh ref={meshRef} position={props.planet.planet.placement}>
      <sphereGeometry args={[PLANET_RADIUS, PLANET_SEGMENTS_LON, PLANET_SEGMENTS_LAT]} />
      <meshStandardMaterial color={props.planet.planet.color} roughness={0.55} metalness={0.15} />
    </mesh>
  );
};
