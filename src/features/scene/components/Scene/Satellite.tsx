import { useMemo, useRef, type JSX } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import type { Group, Object3D } from 'three';
import type { SatelliteSpec } from '../../types/satellite';
import { phaseFromId } from '../../services/renderer/phaseFromId';
import { PLANET_BASE_SCALE } from '../../services/renderer/planetScale';
import { satelliteOffset } from '../../services/renderer/satelliteOffset';
import { rotationRateFor } from '../../services/renderer/planetVisualPlan';
import { usePlanetVisual } from './usePlanetVisual';

type SatelliteProps = {
  readonly spec: SatelliteSpec;
};

export const Satellite = (props: SatelliteProps): JSX.Element => {
  const phase = useMemo(() => phaseFromId(props.spec.id), [props.spec.id]);
  const { plan, pose } = usePlanetVisual(props.spec.assetId, phase);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);
  const groupRef = useRef<Group | null>(null);
  const meshRef = useRef<Object3D | null>(null);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (group === null || mesh === null) return;
    const [x, y, z] = satelliteOffset(props.spec.orbit, state.clock.elapsedTime);
    group.position.set(x, y, z);
    mesh.rotation.y += rotationRate * delta;
  });

  return (
    <group ref={groupRef}>
      <group ref={meshRef} scale={props.spec.scale * PLANET_BASE_SCALE}>
        <group quaternion={pose.alignQuaternion}>
          <Center>
            <primitive object={plan.scene} />
          </Center>
        </group>
      </group>
    </group>
  );
};
