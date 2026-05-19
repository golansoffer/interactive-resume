import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds } from '@react-three/drei';
import { MeshBasicMaterial } from 'three';
import type { Group } from 'three';
import type { NebulaPalette } from '../../services/renderer/deepSpacePalette';

const RING_RADIUS = 300;
const ROTATION_RATE = 0.01;

type TintSelector = 'base' | 'accent' | 'highlight';

type CloudSlot = {
  readonly y: number;
  readonly tint: TintSelector;
};

const CLOUD_LAYOUT: ReadonlyArray<CloudSlot> = [
  { y: -10, tint: 'accent' },
  { y: 10,  tint: 'highlight' },
];

type CloudPlacement = {
  readonly position: readonly [number, number, number];
  readonly color: readonly [number, number, number];
};

type NebulaCloudsProps = {
  readonly palette: NebulaPalette;
  readonly intensity: number;
};

const buildPlacements = (palette: NebulaPalette): ReadonlyArray<CloudPlacement> =>
  CLOUD_LAYOUT.map((slot, i) => {
    const angle = (i / CLOUD_LAYOUT.length) * Math.PI * 2;
    return {
      position: [Math.cos(angle) * RING_RADIUS, slot.y, Math.sin(angle) * RING_RADIUS],
      color: palette[slot.tint],
    };
  });

const clamp01 = (c: number): number => Math.min(1, Math.max(0, c));
const channelHex = (c: number): string => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0');

const toHexColor = ([r, g, b]: readonly [number, number, number]): string =>
  `#${channelHex(r)}${channelHex(g)}${channelHex(b)}`;

export const NebulaClouds = (props: NebulaCloudsProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const placements = useMemo(() => buildPlacements(props.palette), [props.palette]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y += ROTATION_RATE * delta;
  });

  return (
    <group ref={groupRef}>
      <Clouds material={MeshBasicMaterial}>
        {placements.map((p, i) => (
          <Cloud
            key={i}
            position={p.position}
            seed={i + 1}
            segments={30}
            bounds={[120, 40, 120]}
            volume={140}
            color={toHexColor(p.color)}
            opacity={0.32 * props.intensity}
            growth={6}
            speed={0.04}
            concentrate="outside"
          />
        ))}
      </Clouds>
    </group>
  );
};
