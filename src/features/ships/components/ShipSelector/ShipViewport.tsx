import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import type { ShipEntry } from '../../types/ship';
import { heroSwayY, tickRotation } from './tickRotation';

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

type ThumbnailFraming = {
  readonly cameraZ: number;
  readonly cameraY: number;
  readonly fov: number;
};
type HeroFraming = ThumbnailFraming;

const THUMB_FRAMING: ThumbnailFraming = { cameraZ: 4, cameraY: 1.2, fov: 35 };
const HERO_FRAMING: HeroFraming = { cameraZ: 5.6, cameraY: 1.4, fov: 28 };

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

const useHeroFrame = (groupRef: RefObject<Group | null>): void => {
  useFrame((state) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = heroSwayY(state.clock.elapsedTime);
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

const ThumbnailViewport = (props: {
  readonly ship: ShipEntry;
  readonly isHovered: boolean;
}): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(props.ship.glbPath);
  useThumbnailFrame(groupRef, props.isHovered);
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, THUMB_FRAMING.cameraY, THUMB_FRAMING.cameraZ]}
        fov={THUMB_FRAMING.fov}
      />
      <StudioLights keyIntensity={KEY_INTENSITY_THUMB} />
      <group ref={groupRef} scale={props.ship.scale}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </>
  );
};

const HeroViewport = (props: { readonly ship: ShipEntry }): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(props.ship.glbPath);
  useHeroFrame(groupRef);
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, HERO_FRAMING.cameraY, HERO_FRAMING.cameraZ]}
        fov={HERO_FRAMING.fov}
      />
      <StudioLights keyIntensity={KEY_INTENSITY_HERO} />
      <group ref={groupRef} scale={props.ship.scale}>
        <Center>
          <primitive object={scene} />
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
