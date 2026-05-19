import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF } from '@react-three/drei';
import type { Object3D } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetProjection } from '../../types/projections';

type PlanetProps = {
  readonly planet: PlanetProjection;
};

const PLANET_SCALE: readonly [number, number, number] = [1.5, 1.5, 1.5];
const ROTATION_RAD_PER_SEC = 0.18;

// Idle wobble — planets are always "at rest" (no acceleration), so the
// wobble runs at full amplitude. Slower than the ship's idle for a
// heavier feel. Phase derived from CompanyId so planets don't bob in unison.
const PLANET_BOB_AMPLITUDE = 0.08;
const PLANET_BOB_FREQ_HZ = 0.22;
const PLANET_SWAY_AMPLITUDE = Math.PI / 180;
const PLANET_SWAY_FREQ_HZ = 0.13;
const TWO_PI = Math.PI * 2;

// Exhaustive: PlanetAssetId is a closed literal union, so the TS checker
// verifies every asset id maps to a GLB path. No fallback, no `??` default.
const PLANET_PATHS: Record<PlanetAssetId, string> = {
  earth_a: '/models/planets/EA05_Planets_Earth_01a.glb',
  earth_b: '/models/planets/EA05_Planets_Earth_01b.glb',
  jupiter_a: '/models/planets/EA05_Planets_Jowisz_01a.glb',
  jupiter_b: '/models/planets/EA05_Planets_Jowisz_01b.glb',
  mars_a: '/models/planets/EA05_Planets_Mars_01a.glb',
  mars_b: '/models/planets/EA05_Planets_Mars_01b.glb',
  mercury_a: '/models/planets/EA05_Planets_Mercury_01a.glb',
  mercury_b: '/models/planets/EA05_Planets_Mercury_01b.glb',
  moon_a: '/models/planets/EA05_Planets_Moon_01a.glb',
  moon_b: '/models/planets/EA05_Planets_Moon_01b.glb',
  neptune_a: '/models/planets/EA05_Planets_Neptun_01a.glb',
  neptune_b: '/models/planets/EA05_Planets_Neptun_01b.glb',
  pluto_a: '/models/planets/EA05_Planets_Pluton_01a.glb',
  pluto_b: '/models/planets/EA05_Planets_Pluton_01b.glb',
  saturn_a: '/models/planets/EA05_Planets_Saturn_01a.glb',
  saturn_b: '/models/planets/EA05_Planets_Saturn_01b.glb',
  sun_a: '/models/planets/EA05_Planets_Sun_01a.glb',
  sun_b: '/models/planets/EA05_Planets_Sun_01b.glb',
  uranus_a: '/models/planets/EA05_Planets_Uran_01a.glb',
  uranus_b: '/models/planets/EA05_Planets_Uran_01b.glb',
  venus_a: '/models/planets/EA05_Planets_Venus_01a.glb',
  venus_b: '/models/planets/EA05_Planets_Venus_01b.glb',
};

const idEncoder = new TextEncoder();

const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) {
    hash = (hash * 31 + byte) % 1000;
  }
  return (hash / 1000) * TWO_PI;
};

export const Planet = (props: PlanetProps): JSX.Element => {
  const path = PLANET_PATHS[props.planet.planet.assetId];
  const { scene } = useGLTF(path);
  // drei's useGLTF caches one THREE.Group per path. `<primitive object={...}>`
  // mounts the actual Object3D, so two <Planet>s sharing the same assetId would
  // otherwise mount the same node twice. Cloning per instance keeps them isolated.
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const meshRef = useRef<Object3D | null>(null);
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
    <group ref={meshRef} position={props.planet.planet.placement} scale={PLANET_SCALE}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
};

// Preload all 22 planet GLBs at module import so fetches start before
// the first <Planet> mounts.
for (const path of Object.values(PLANET_PATHS)) {
  useGLTF.preload(path);
}
