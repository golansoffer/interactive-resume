import type { JSX } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, PerspectiveCamera, useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import type { ShipEntry } from '../../types/ship';
import { tickRotation } from './tickRotation';

type ShipViewportProps = {
  readonly ship: ShipEntry;
  readonly isHovered: boolean;
};

export const ShipViewport = (props: ShipViewportProps): JSX.Element => {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(props.ship.glbPath);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (g === null) return;
    g.rotation.y = tickRotation(g.rotation.y, props.isHovered, delta);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.2, 4]} fov={35} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 5]} intensity={1.4} />
      <Center>
        <group ref={groupRef} scale={props.ship.scale}>
          <primitive object={scene} />
        </group>
      </Center>
    </>
  );
};
