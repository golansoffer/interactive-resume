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
  readonly velocity: Vector3;
  readonly springScratch: Vector3;
  readonly dragScratch: Vector3;
  bank: number;
  snapped: boolean;
};

const CHASE_OFFSET = new Vector3(0, 6, -10);
const LOOK_HEIGHT = 0;

// Chase-cam dynamics — four layered effects, each with its own time constant
// so they don't move in lockstep.

// Look-ahead — target shifts in direction of motion at speed.
const MAX_LOOK_AHEAD = 1.8;
const LOOK_AHEAD_LERP = 0.07;

// Speed-FOV — wider FOV at full speed gives the sense of speed.
const BASE_FOV = 60;
const MAX_FOV = 64;
const FOV_LERP = 0.04;

// Camera bank — subtle roll in strafe direction (~3°).
// Much milder than the ship's bank so they layer rather than compete.
const MAX_CAMERA_BANK = Math.PI / 60;
const BANK_LERP = 0.08;

// Velocity-driven world-space offsets on the chase target.
// Lateral: strafing right slides the camera right of the chase axis.
// Longitudinal: moving forward drags the camera back so it lags on acceleration.
const LATERAL_OFFSET_FACTOR = 0.10;
const LONGITUDINAL_OFFSET_FACTOR = -0.07;

// Spring-damper follow — stiffness/damping tuned for damping ratio ~0.65
// (critical at stiffness 8 is 2*sqrt(8) ≈ 5.66). Visible glide on sudden
// direction changes, no oscillation.
const SPRING_STIFFNESS = 8;
const SPRING_DAMPING = 3.7;

const cameraInitial: readonly [number, number, number] = [0, 6, -10];

const updateChaseCamera = (
  camera: PerspectiveCameraImpl,
  target: Object3D,
  kinematics: Kinematics,
  memory: ChaseMemory,
  delta: number,
): void => {
  const velocity = kinematics.velocity;
  const speed = Math.hypot(velocity.x, velocity.z);
  const speedRatio = speed === 0 ? 0 : Math.min(1, speed / MAX_SPEED);

  memory.desired.copy(target.position).add(CHASE_OFFSET);
  memory.desired.x += velocity.x * LATERAL_OFFSET_FACTOR;
  memory.desired.z += velocity.z * LONGITUDINAL_OFFSET_FACTOR;
  if (memory.snapped) {
    memory.springScratch.subVectors(memory.desired, camera.position).multiplyScalar(SPRING_STIFFNESS);
    memory.dragScratch.copy(memory.velocity).multiplyScalar(-SPRING_DAMPING);
    memory.springScratch.add(memory.dragScratch);
    memory.velocity.addScaledVector(memory.springScratch, delta);
    camera.position.addScaledVector(memory.velocity, delta);
  } else {
    camera.position.copy(memory.desired);
    memory.velocity.set(0, 0, 0);
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
  velocity: new Vector3(),
  springScratch: new Vector3(),
  dragScratch: new Vector3(),
  bank: 0,
  snapped: false,
});

export const FollowCamera = (props: FollowCameraProps): JSX.Element => {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const memoryRef = useRef<ChaseMemory>(createMemory());

  useFrame((_root, delta) => {
    const camera = cameraRef.current;
    const target = props.targetMeshRef.current;
    if (camera === null || target === null) return;
    updateChaseCamera(camera, target, props.kinematicsRef.current, memoryRef.current, delta);
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
