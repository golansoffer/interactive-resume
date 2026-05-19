import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import type { Object3D, PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { Vector3 } from 'three';
import { MAX_SPEED } from '../../services/renderer/integrateMotion';
import type { Kinematics } from '../../services/renderer/integrateMotion';

type FollowCameraProps = {
  readonly targetMeshRef: RefObject<Object3D | null>;
  readonly kinematicsRef: RefObject<Kinematics>;
};

type ChaseMemory = {
  readonly desired: Vector3;
  readonly lookTarget: Vector3;
  readonly lookAheadOffset: Vector3;
  readonly cameraUp: Vector3;
  bank: number;
  snapped: boolean;
};

const CHASE_OFFSET = new Vector3(0, 6, -10);
const POSITION_LERP = 0.32;
const LOOK_HEIGHT = 0;

// Chase-cam dynamics — three layered effects, each with its own time constant
// so they don't move in lockstep.

// Look-ahead — target shifts in direction of motion at speed.
const MAX_LOOK_AHEAD = 2.5;
const LOOK_AHEAD_LERP = 0.10;

// Speed-FOV — wider FOV at full speed gives the sense of speed.
const BASE_FOV = 60;
const MAX_FOV = 68;
const FOV_LERP = 0.06;

// Camera bank — subtle roll in strafe direction (~5°).
// Much milder than the ship's bank so they layer rather than compete.
const MAX_CAMERA_BANK = Math.PI / 36;
const BANK_LERP = 0.12;

const cameraInitial: readonly [number, number, number] = [0, 6, -10];

const updateChaseCamera = (
  camera: PerspectiveCameraImpl,
  target: Object3D,
  kinematics: Kinematics,
  memory: ChaseMemory,
): void => {
  const velocity = kinematics.velocity;
  const speed = Math.hypot(velocity.x, velocity.z);
  const speedRatio = speed === 0 ? 0 : Math.min(1, speed / MAX_SPEED);

  memory.desired.copy(target.position).add(CHASE_OFFSET);
  if (memory.snapped) {
    camera.position.lerp(memory.desired, POSITION_LERP);
  } else {
    camera.position.copy(memory.desired);
    memory.snapped = true;
  }

  const directionScale = speed === 0 ? 0 : 1 / speed;
  const targetAheadX = velocity.x * directionScale * speedRatio * MAX_LOOK_AHEAD;
  const targetAheadZ = velocity.z * directionScale * speedRatio * MAX_LOOK_AHEAD;
  memory.lookAheadOffset.x += (targetAheadX - memory.lookAheadOffset.x) * LOOK_AHEAD_LERP;
  memory.lookAheadOffset.z += (targetAheadZ - memory.lookAheadOffset.z) * LOOK_AHEAD_LERP;

  const targetFov = BASE_FOV + (MAX_FOV - BASE_FOV) * speedRatio;
  camera.fov += (targetFov - camera.fov) * FOV_LERP;
  camera.updateProjectionMatrix();

  const targetBank = -(velocity.x / MAX_SPEED) * MAX_CAMERA_BANK;
  memory.bank += (targetBank - memory.bank) * BANK_LERP;
  memory.cameraUp.set(Math.sin(memory.bank), Math.cos(memory.bank), 0);
  camera.up.copy(memory.cameraUp);

  memory.lookTarget.copy(target.position);
  memory.lookTarget.y += LOOK_HEIGHT;
  memory.lookTarget.x += memory.lookAheadOffset.x;
  memory.lookTarget.z += memory.lookAheadOffset.z;
  camera.lookAt(memory.lookTarget);
};

const createMemory = (): ChaseMemory => ({
  desired: new Vector3(),
  lookTarget: new Vector3(),
  lookAheadOffset: new Vector3(),
  cameraUp: new Vector3(0, 1, 0),
  bank: 0,
  snapped: false,
});

export const FollowCamera = (props: FollowCameraProps): JSX.Element => {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const memoryRef = useRef<ChaseMemory>(createMemory());

  useFrame(() => {
    const camera = cameraRef.current;
    const target = props.targetMeshRef.current;
    if (camera === null || target === null) return;
    updateChaseCamera(camera, target, props.kinematicsRef.current, memoryRef.current);
  });

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={cameraInitial}
      fov={BASE_FOV}
      near={0.1}
      far={500}
    />
  );
};
