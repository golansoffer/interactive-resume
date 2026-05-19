import type { JSX } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ShaderMaterial } from 'three';
import { createNebulaSkyMaterial } from '../../services/renderer/nebulaSkyMaterial';
import type { NebulaPalette } from '../../services/renderer/deepSpacePalette';

const SKY_RADIUS = 480;
const SKY_SEGMENTS = 32;

type NebulaSkyProps = {
  readonly palette: NebulaPalette;
  readonly intensity: number;
};

export const NebulaSky = (props: NebulaSkyProps): JSX.Element => {
  const material = useMemo(() => createNebulaSkyMaterial(props.palette), [props.palette]);
  const materialRef = useRef<ShaderMaterial>(material);
  materialRef.current = material;

  useFrame((state) => {
    const m = materialRef.current;
    const uTime = m.uniforms['uTime'];
    const uIntensity = m.uniforms['uIntensity'];
    if (uTime === undefined || uIntensity === undefined) return;
    uTime.value = state.clock.elapsedTime;
    uIntensity.value = props.intensity;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[SKY_RADIUS, SKY_SEGMENTS, SKY_SEGMENTS]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};
