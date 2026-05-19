import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import {
  DEFAULT_PALETTE,
  type NebulaPalette,
} from '../../services/renderer/deepSpacePalette';
import { AmbientDust } from './AmbientDust';
import { DeepSpacePost } from './DeepSpacePost';
import { NebulaClouds } from './NebulaClouds';
import { NebulaSky } from './NebulaSky';
import { StarParallax } from './StarParallax';

export type DeepSpaceProps = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly palette?: NebulaPalette;
  readonly intensity?: number;
  readonly starDensity?: number;
  readonly motionResponse?: number;
};

export const DeepSpace = (props: DeepSpaceProps): JSX.Element => {
  const palette = props.palette ?? DEFAULT_PALETTE;
  const intensity = props.intensity ?? 1;
  const starDensity = props.starDensity ?? 1;
  const motionResponse = props.motionResponse ?? 1;

  const camera = useThree((s) => s.camera);
  const anchorRef = useRef<Group>(null);

  useFrame(() => {
    const g = anchorRef.current;
    if (g === null) return;
    g.position.copy(camera.position);
  }, 1);

  return (
    <>
      <group ref={anchorRef}>
        <NebulaSky palette={palette} intensity={intensity} />
        <NebulaClouds palette={palette} intensity={intensity} />
        <StarParallax starDensity={starDensity} motionResponse={motionResponse} />
        <AmbientDust />
      </group>
      <DeepSpacePost
        kinematicsRef={props.kinematicsRef}
        intensity={intensity}
        motionResponse={motionResponse}
      />
    </>
  );
};
