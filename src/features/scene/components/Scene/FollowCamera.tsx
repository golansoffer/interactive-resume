import type { JSX, RefObject } from 'react';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import type { PerspectiveCamera as PerspectiveCameraImpl } from 'three';
import { Vector3 } from 'three';
import { MAX_SPEED } from '../../services/renderer/integrateMotion';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import type { Vec3 } from '../../services/renderer/vec3';

type FollowCameraProps = {
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
  followHeading: number;
  followAngularVelocity: number;
  snapped: boolean;
};

const CHASE_OFFSET = new Vector3(0, 6, -10);
const LOOK_HEIGHT = 2.5;

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

// Velocity-driven ship-local offsets on the chase target.
// Lateral: strafing right (in ship-frame) slides the camera right of the
// chase axis — reads as "leaning into the turn" after rotation.
// Longitudinal: moving forward (in ship-frame) drags the camera back so it
// lags on acceleration.
const LATERAL_OFFSET_FACTOR = 0.10;
const LONGITUDINAL_OFFSET_FACTOR = -0.07;

// Spring-damper follow — stiffness/damping tuned for damping ratio ~0.74
// (critical at stiffness 8 is 2*sqrt(8) ≈ 5.66). Visible glide on sudden
// direction changes, less overshoot on reverse-to-forward transitions.
const SPRING_STIFFNESS = 8;
const SPRING_DAMPING = 4.2;

// Heading-follow spring — camera rotates around the ship to stay behind
// its velocity direction. Softer than the position spring; damping ratio
// ~0.71 (critical at stiffness 6 is 2*sqrt(6) ≈ 4.9). Visible swing on
// hard turns, no oscillation. Below HEADING_THRESHOLD the heading is
// held — prevents jitter at near-zero speed when atan2 of tiny velocity
// would flip wildly.
const HEADING_STIFFNESS = 6;
const HEADING_DAMPING = 3.5;
const HEADING_THRESHOLD = 0.5;
const TWO_PI = Math.PI * 2;

const cameraInitial: readonly [number, number, number] = [0, 6, -10];

const wrapAngle = (delta: number): number => {
  let wrapped = delta;
  while (wrapped > Math.PI) {
    wrapped -= TWO_PI;
  }
  while (wrapped < -Math.PI) {
    wrapped += TWO_PI;
  }
  return wrapped;
};

// Steps the camera's follow-heading by one frame. Above the speed
// threshold the heading springs toward atan2(vx, vz); below it the
// angular velocity damps to zero so the camera settles cleanly when
// the ship stops, rather than drifting on residual momentum.
const advanceFollowHeading = (velocity: Vec3, memory: ChaseMemory, delta: number): void => {
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed > HEADING_THRESHOLD) {
    const desiredHeading = Math.atan2(velocity.x, velocity.z);
    const headingDelta = wrapAngle(desiredHeading - memory.followHeading);
    const angularAccel = headingDelta * HEADING_STIFFNESS - memory.followAngularVelocity * HEADING_DAMPING;
    memory.followAngularVelocity += angularAccel * delta;
    memory.followHeading += memory.followAngularVelocity * delta;
    return;
  }
  const damp = Math.max(0, 1 - HEADING_DAMPING * delta);
  memory.followAngularVelocity *= damp;
  memory.followHeading += memory.followAngularVelocity * delta;
};

// Writes memory.desired with the chase-cam target position: ship position
// plus CHASE_OFFSET rotated by followHeading, plus ship-local lateral and
// longitudinal offsets derived from the ship-frame velocity components.
// Returns the local-right velocity component so callers can drive the
// bank without recomputing the basis.
const writeDesiredChasePosition = (
  position: Vec3,
  velocity: Vec3,
  memory: ChaseMemory,
): number => {
  const cosH = Math.cos(memory.followHeading);
  const sinH = Math.sin(memory.followHeading);
  const rotatedX = CHASE_OFFSET.x * cosH + CHASE_OFFSET.z * sinH;
  const rotatedZ = -CHASE_OFFSET.x * sinH + CHASE_OFFSET.z * cosH;
  const shipForwardX = sinH;
  const shipForwardZ = cosH;
  const shipRightX = cosH;
  const shipRightZ = -sinH;
  const localForward = velocity.x * shipForwardX + velocity.z * shipForwardZ;
  const localRight = velocity.x * shipRightX + velocity.z * shipRightZ;
  const forwardComponent = Math.max(0, localForward) * LONGITUDINAL_OFFSET_FACTOR;
  const rightComponent = localRight * LATERAL_OFFSET_FACTOR;
  memory.desired.set(
    position.x + rotatedX + shipRightX * rightComponent + shipForwardX * forwardComponent,
    position.y + CHASE_OFFSET.y,
    position.z + rotatedZ + shipRightZ * rightComponent + shipForwardZ * forwardComponent,
  );
  return localRight;
};

// On the first frame, snaps the camera to memory.desired and zeroes spring
// velocity. Afterwards, advances camera.position via a spring-damper step
// toward memory.desired.
const stepPositionSpring = (
  camera: PerspectiveCameraImpl,
  memory: ChaseMemory,
  delta: number,
): void => {
  if (memory.snapped) {
    memory.springScratch.subVectors(memory.desired, camera.position).multiplyScalar(SPRING_STIFFNESS);
    memory.dragScratch.copy(memory.velocity).multiplyScalar(-SPRING_DAMPING);
    memory.springScratch.add(memory.dragScratch);
    memory.velocity.addScaledVector(memory.springScratch, delta);
    camera.position.addScaledVector(memory.velocity, delta);
    return;
  }
  camera.position.copy(memory.desired);
  memory.velocity.set(0, 0, 0);
  memory.snapped = true;
};

// Both chase target and look target read from the integrator position
// (kinematics.position), NOT from the rendered mesh. The mesh adds an
// idle-hover bob/sway on top of the integrator position; if the camera
// tracked the mesh, the bob would cancel itself in the camera frame and
// the world would appear to wobble instead of the ship. Reading kinematics
// directly keeps the camera glued to controlled motion only, so the bob
// reads as ship motion.
const updateChaseCamera = (
  camera: PerspectiveCameraImpl,
  kinematics: Kinematics,
  memory: ChaseMemory,
  delta: number,
): void => {
  const velocity = kinematics.velocity;
  const position = kinematics.position;
  const speed = Math.hypot(velocity.x, velocity.z);
  const speedRatio = speed === 0 ? 0 : Math.min(1, speed / MAX_SPEED);

  advanceFollowHeading(velocity, memory, delta);
  const localRight = writeDesiredChasePosition(position, velocity, memory);
  stepPositionSpring(camera, memory, delta);

  const directionScale = speed === 0 ? 0 : 1 / speed;
  const targetAheadX = velocity.x * directionScale * speedRatio * MAX_LOOK_AHEAD;
  const forwardVz = Math.max(0, velocity.z);
  const targetAheadZ = forwardVz * directionScale * speedRatio * MAX_LOOK_AHEAD;
  memory.lookAheadOffset.x += (targetAheadX - memory.lookAheadOffset.x) * LOOK_AHEAD_LERP;
  memory.lookAheadOffset.z += (targetAheadZ - memory.lookAheadOffset.z) * LOOK_AHEAD_LERP;

  const targetFov = BASE_FOV + (MAX_FOV - BASE_FOV) * speedRatio;
  camera.fov += (targetFov - camera.fov) * FOV_LERP;
  camera.updateProjectionMatrix();

  const targetBank = -(localRight / MAX_SPEED) * MAX_CAMERA_BANK;
  memory.bank += (targetBank - memory.bank) * BANK_LERP;
  memory.cameraUp.set(Math.sin(memory.bank), Math.cos(memory.bank), 0);
  camera.up.copy(memory.cameraUp);

  memory.lookTarget.copy(position);
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
  followHeading: 0,
  followAngularVelocity: 0,
  snapped: false,
});

export const FollowCamera = (props: FollowCameraProps): JSX.Element => {
  const cameraRef = useRef<PerspectiveCameraImpl | null>(null);
  const memoryRef = useRef<ChaseMemory>(createMemory());

  useFrame((_root, delta) => {
    const camera = cameraRef.current;
    if (camera === null) return;
    updateChaseCamera(camera, props.kinematicsRef.current, memoryRef.current, delta);
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
