import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import type { Mesh, PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { Vector3 } from 'three';

type FollowCameraProps = {
  readonly targetMeshRef: RefObject<Mesh | null>;
};

const CHASE_OFFSET = new Vector3(0, 6, -10);
const LERP_FACTOR = 0.08;
const LOOK_HEIGHT = 1;

const cameraInitial: readonly [number, number, number] = [0, 6, -10];

export const FollowCamera = (props: FollowCameraProps): JSX.Element => {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const desired = useRef(new Vector3());
  const lookTarget = useRef(new Vector3());

  useFrame(() => {
    const camera = cameraRef.current;
    const target = props.targetMeshRef.current;
    if (camera === null || target === null) return;
    desired.current.copy(target.position).add(CHASE_OFFSET);
    camera.position.lerp(desired.current, LERP_FACTOR);
    lookTarget.current.copy(target.position);
    lookTarget.current.y += LOOK_HEIGHT;
    camera.lookAt(lookTarget.current);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={cameraInitial}
      fov={60}
      near={0.1}
      far={500}
    />
  );
};
