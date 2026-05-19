import type { JSX } from 'react';
import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { EquirectangularReflectionMapping, SRGBColorSpace } from 'three';

type SkyTextureProps = {
  readonly path: string;
};

export const SkyTexture = (props: SkyTextureProps): JSX.Element => {
  const texture = useTexture(props.path);
  const sky = useMemo(() => {
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [texture]);
  return <primitive object={sky} attach="background" />;
};
