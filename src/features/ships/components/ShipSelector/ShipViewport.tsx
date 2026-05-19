import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import type { ShipEntry } from '../../types/ship';
import { KEY_INTENSITY_THUMB, StudioLights } from './StudioLights';
import { tickRotation } from './tickRotation';

// Camera mounted slightly above origin and tilted down ~4° so the ship
// sits centered (or slightly above center) in frame. Pure forward (the
// default lookAt -Z) would put the ship visibly low since the eye is
// above origin.
const THUMB_CAMERA_POSITION: readonly [number, number, number] = [0, 0.4, 4];
const THUMB_CAMERA_ROTATION: readonly [number, number, number] = [-0.07, 0, 0];
const THUMB_CAMERA_FOV = 35;

type ShipViewportProps = {
  readonly ship: ShipEntry;
  readonly isHovered: boolean;
};

// useGLTF returns a Three.js scene that is *shared* across every consumer
// of the same path. Object3D has a single parent, so two `<primitive
// object={scene}>` mounts re-parent the object and one of them renders
// empty. Clone per instance — static Kenney meshes need no skinning
// fixup; `clone(true)` is the correct recursive clone.
const useClonedScene = (glbPath: string): Group => {
  const { scene } = useGLTF(glbPath);
  return useMemo(() => scene.clone(true), [scene]);
};

export const ShipViewport = (props: ShipViewportProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const clonedScene = useClonedScene(props.ship.glbPath);
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = tickRotation(g.rotation.y, props.isHovered, delta);
  });
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={THUMB_CAMERA_POSITION}
        rotation={THUMB_CAMERA_ROTATION}
        fov={THUMB_CAMERA_FOV}
      />
      <StudioLights keyIntensity={KEY_INTENSITY_THUMB} />
      <group ref={groupRef} scale={props.ship.scale}>
        <Center>
          <primitive object={clonedScene} />
        </Center>
      </group>
    </>
  );
};
