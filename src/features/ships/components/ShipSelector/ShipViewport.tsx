import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import type { ShipEntry, ShipId } from '../../types/ship';
import { tickRotation, transitionScale } from './tickRotation';

// Studio lighting — 3-point + hemisphere rig. Key (warm), fill (cool),
// rim (cyan accent matching the engine wake), ground bounce.
// Hero amps the key for theatrical depth; thumbnails share the same
// rig at base intensity so they read consistently in the strip.
const KEY_COLOR = '#fff5e8';
const FILL_COLOR = '#a8d4ff';
const RIM_COLOR = '#5fd6ff';
const HEMI_TOP = '#7aa8ff';
const HEMI_BOTTOM = '#08111e';

const KEY_INTENSITY_THUMB = 2.2;
const KEY_INTENSITY_HERO = 4.4;
const FILL_INTENSITY = 1.0;
const RIM_INTENSITY = 1.8;
const AMBIENT_INTENSITY = 0.6;
const HEMI_INTENSITY = 0.3;

type CameraFraming = {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly fov: number;
};

// Camera is mounted slightly above the model and tilted down ~4° so the
// ship sits centered (or slightly above center) in frame. Pure forward
// (default lookAt -Z) would put the ship visibly low because the camera
// eye is above origin.
const THUMB_FRAMING: CameraFraming = {
  position: [0, 0.4, 4],
  rotation: [-0.07, 0, 0],
  fov: 35,
};
const HERO_FRAMING: CameraFraming = {
  position: [0, 0.4, 5.6],
  rotation: [-0.07, 0, 0],
  fov: 28,
};

export type ShipViewportProps =
  | {
      readonly kind: 'thumbnail';
      readonly ship: ShipEntry;
      readonly isHovered: boolean;
    }
  | {
      readonly kind: 'hero';
      readonly ship: ShipEntry;
    };

const useThumbnailFrame = (
  groupRef: RefObject<Group | null>,
  isHovered: boolean,
): void => {
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = tickRotation(g.rotation.y, isHovered, delta);
  });
};

const StudioLights = ({ keyIntensity }: { readonly keyIntensity: number }): JSX.Element => (
  <>
    <ambientLight intensity={AMBIENT_INTENSITY} />
    <directionalLight position={[6, 8, 5]} intensity={keyIntensity} color={KEY_COLOR} />
    <directionalLight position={[-5, 4, 3]} intensity={FILL_INTENSITY} color={FILL_COLOR} />
    <directionalLight position={[0, 3, -6]} intensity={RIM_INTENSITY} color={RIM_COLOR} />
    <hemisphereLight args={[HEMI_TOP, HEMI_BOTTOM, HEMI_INTENSITY]} />
  </>
);

// useGLTF returns a Three.js scene that is *shared* across every consumer
// of the same path. Object3D has a single parent, so two `<primitive
// object={scene}>` mounts re-parent the object and one of them renders
// empty. Clone per instance — static Kenney meshes need no skinning
// fixup; `clone(true)` is the correct recursive clone.
const useClonedScene = (glbPath: string): Group => {
  const { scene } = useGLTF(glbPath);
  return useMemo(() => scene.clone(true), [scene]);
};

const ThumbnailViewport = (props: {
  readonly ship: ShipEntry;
  readonly isHovered: boolean;
}): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const clonedScene = useClonedScene(props.ship.glbPath);
  useThumbnailFrame(groupRef, props.isHovered);
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={THUMB_FRAMING.position}
        rotation={THUMB_FRAMING.rotation}
        fov={THUMB_FRAMING.fov}
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

type HeroTransition = { readonly shipId: ShipId; readonly startedAt: number };

const useHeroSwapTransition = (
  groupRef: RefObject<Group | null>,
  ship: ShipEntry,
): void => {
  const transition = useRef<HeroTransition>({
    shipId: ship.id,
    startedAt: performance.now(),
  });
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    if (transition.current.shipId !== ship.id) {
      transition.current = { shipId: ship.id, startedAt: performance.now() };
    }
    g.rotation.y = tickRotation(g.rotation.y, true, delta);
    const elapsed = performance.now() - transition.current.startedAt;
    const s = transitionScale(ship.scale, elapsed);
    g.scale.setScalar(s);
  });
};

const HeroViewport = (props: { readonly ship: ShipEntry }): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const clonedScene = useClonedScene(props.ship.glbPath);
  useHeroSwapTransition(groupRef, props.ship);
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={HERO_FRAMING.position}
        rotation={HERO_FRAMING.rotation}
        fov={HERO_FRAMING.fov}
      />
      <StudioLights keyIntensity={KEY_INTENSITY_HERO} />
      <group ref={groupRef}>
        <Center>
          <primitive object={clonedScene} />
        </Center>
      </group>
    </>
  );
};

export const ShipViewport = (props: ShipViewportProps): JSX.Element => {
  switch (props.kind) {
    case 'thumbnail':
      return <ThumbnailViewport ship={props.ship} isHovered={props.isHovered} />;
    case 'hero':
      return <HeroViewport ship={props.ship} />;
  }
};
