import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import {
  ClampToEdgeWrapping,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  SRGBColorSpace,
} from 'three';
import type { Object3D, Texture } from 'three';
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

const COLORSHEET_PATH = '/models/planets/Texture/Planet_Colorsheet_v1.jpg';

// Apply the GLB/palette-correct settings to the colorsheet texture.
// GLB convention is flipY=false; useTexture defaults to flipY=true
// (browser image-loading convention). Mismatch causes UVs to sample the
// vertically-mirrored row of the palette — Saturn's narrow UV band landed
// on green instead of yellow/tan. The other settings: never blur between
// palette cells, never wrap past edges, skip mipmaps (a 96×96 palette has
// nothing to gain from them and mipmap blurring would mush discrete colors).
const configureColorsheet = (texture: Texture): void => {
  texture.flipY = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
};

// Clones the GLB scene tree and, per mesh whose material is a
// MeshStandardMaterial, clones that material and assigns the colorsheet
// texture. Per-instance material clones prevent two <Planet>s of the same
// asset id from sharing material mutations through the drei useGLTF cache.
const applyColorsheet = (sourceScene: Object3D, texture: Texture): Object3D => {
  const cloned = sourceScene.clone();
  cloned.traverse((obj) => {
    if (obj instanceof Mesh && obj.material instanceof MeshStandardMaterial) {
      const newMaterial = obj.material.clone();
      newMaterial.map = texture;
      newMaterial.roughness = 0.45;
      newMaterial.metalness = 0.05;
      newMaterial.needsUpdate = true;
      obj.material = newMaterial;
    }
  });
  return cloned;
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
  const colorsheet = useTexture(COLORSHEET_PATH);
  // drei's useGLTF caches one THREE.Group per path. `<primitive object={...}>`
  // mounts the actual Object3D, so two <Planet>s sharing the same assetId would
  // otherwise mount the same node twice. Cloning per instance keeps them isolated.
  // Texture configuration lives inside the useMemo: the writes are idempotent
  // across all Planet instances (drei's useTexture singleton-caches), and
  // Planet is a component — useEffect is banned outside widget composition roots.
  const clonedScene = useMemo(() => {
    configureColorsheet(colorsheet);
    return applyColorsheet(scene, colorsheet);
  }, [scene, colorsheet]);
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
useTexture.preload(COLORSHEET_PATH);
for (const path of Object.values(PLANET_PATHS)) {
  useGLTF.preload(path);
}
