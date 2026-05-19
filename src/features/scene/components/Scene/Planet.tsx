import type { JSX } from 'react';
import { useTexture } from '@react-three/drei';
import type { PlanetProjection } from '../../types/projections';

type PlanetProps = {
  readonly planet: PlanetProjection;
};

const PLANET_SCALE: readonly [number, number, number] = [2.5, 2.5, 1];

export const Planet = (props: PlanetProps): JSX.Element => {
  const texture = useTexture(`/sprites/kenney-planets/${props.planet.planet.assetId}.png`);

  return (
    <sprite position={props.planet.planet.placement} scale={PLANET_SCALE}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
};
