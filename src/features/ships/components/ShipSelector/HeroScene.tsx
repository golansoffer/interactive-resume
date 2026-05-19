import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Material, Mesh } from 'three';
import type { Group } from 'three';
import type { ShipEntry } from '../../types/ship';
import { KEY_INTENSITY_HERO, StudioLights } from './StudioLights';
import { tickRotation, transitionOpacity } from './tickRotation';

const HERO_CAMERA_POSITION: readonly [number, number, number] = [0, 0.4, 5.6];
const HERO_CAMERA_ROTATION: readonly [number, number, number] = [-0.07, 0, 0];
const HERO_CAMERA_FOV = 28;

// HeroSceneSetup mounts the camera + lights ONCE per View. Two
// HeroShipMesh instances may coexist during a crossfade, but
// PerspectiveCamera makeDefault and the light rig must not be duplicated.
export const HeroSceneSetup = (): JSX.Element => (
  <>
    <PerspectiveCamera
      makeDefault
      position={HERO_CAMERA_POSITION}
      rotation={HERO_CAMERA_ROTATION}
      fov={HERO_CAMERA_FOV}
    />
    <StudioLights keyIntensity={KEY_INTENSITY_HERO} />
  </>
);

export type HeroOpacityPolicy =
  | { readonly kind: 'opaque' }
  | { readonly kind: 'fading_in'; readonly startedAt: number }
  | { readonly kind: 'fading_out'; readonly startedAt: number };

type HeroShipMeshProps = {
  readonly ship: ShipEntry;
  readonly opacityPolicy: HeroOpacityPolicy;
};

// Drei's useGLTF returns a Three.js scene that is *shared* across every
// consumer of the same path. Two `<primitive>` mounts of the same scene
// re-parent the object and one of them renders empty. Clone per instance.
const useClonedScene = (glbPath: string): Group => {
  const { scene } = useGLTF(glbPath);
  return useMemo(() => scene.clone(true), [scene]);
};

// Collect every Material in the cloned scene's mesh tree and flip them
// to transparent. The collected list is mutated each frame from the
// opacity policy; the scene is cloned so we never affect other ship
// instances. Mesh.material is Material | Material[]; both branches.
const useCrossfadeMaterials = (root: Group): ReadonlyArray<Material> =>
  useMemo(() => {
    const collected: Array<Material> = [];
    root.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const m = obj.material;
      if (m instanceof Material) {
        m.transparent = true;
        collected.push(m);
        return;
      }
      if (Array.isArray(m)) {
        for (const mat of m) {
          if (mat instanceof Material) {
            mat.transparent = true;
            collected.push(mat);
          }
        }
      }
    });
    return collected;
  }, [root]);

const opacityFor = (policy: HeroOpacityPolicy, nowMs: number): number => {
  switch (policy.kind) {
    case 'opaque':
      return 1;
    case 'fading_in':
      return transitionOpacity('fading_in', nowMs - policy.startedAt);
    case 'fading_out':
      return transitionOpacity('fading_out', nowMs - policy.startedAt);
  }
};

export const HeroShipMesh = (props: HeroShipMeshProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const clonedScene = useClonedScene(props.ship.glbPath);
  const materials = useCrossfadeMaterials(clonedScene);
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = tickRotation(g.rotation.y, true, delta);
    const opacity = opacityFor(props.opacityPolicy, performance.now());
    for (const mat of materials) mat.opacity = opacity;
  });
  return (
    <group ref={groupRef} scale={props.ship.scale}>
      <Center>
        <primitive object={clonedScene} />
      </Center>
    </group>
  );
};

