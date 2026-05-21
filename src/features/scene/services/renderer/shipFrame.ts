import type { Object3D, Vector3 as Vector3Impl } from 'three';
import { MAX_SPEED } from '../../types/kinematics';
import type { SceneState } from '../../types/scene-state';
import type { CameraBasis } from './integrateMotion';

// Visual feel — banking and pitch derived from velocity in the camera basis.
// Heading is held at the JSX-set base yaw (no input-driven yaw — camera-relative motion).
// MAX_PITCH ≈ 12° nose-down at full forward thrust.
export const MAX_PITCH = Math.PI / 15;
// MAX_ROLL ≈ 26° wing-dip at full strafe.
export const MAX_ROLL = Math.PI / 7;
// ORIENT_LERP — ~300ms time-to-target; floaty and weighty.
export const ORIENT_LERP = 0.1;

// Top reference speed for idle damping — widened to MAX_SPEED * 3 so the
// idle bob/sway still trends toward zero at full boost. Pitch/roll targets
// stay clamped at the baseline MAX_SPEED inside computeRotationTargets so
// the ship's tilt envelope never exceeds normal-flight max during boost.
export const BOOST_TOP_SPEED = MAX_SPEED * 3;

// Idle motion — sine oscillations always present, scaled down with speed
// (see IDLE_RATIO_FLOOR in computeIdleMotion). The aircraft is the LIGHT
// object in the scene, so its flutter should always be visible — contrast
// against the heavier, slower-bobbing planets. Two distinct frequencies
// so bob and sway never lock into a single rhythm.
const IDLE_BOB_AMPLITUDE = 0.12;
const IDLE_BOB_FREQ_HZ = 0.7;
// IDLE_SWAY_AMPLITUDE ≈ 3.3° applied to rotation.z = roll (wing dip), not lateral position.
const IDLE_SWAY_AMPLITUDE = Math.PI / 55;
const IDLE_SWAY_FREQ_HZ = 0.55;
const IDLE_RATIO_FLOOR = 0.4;

// Velocity-derived heading — outer yaw lerps toward atan2(vx, vz) so the
// ship faces its motion direction on diagonal moves. Held below threshold
// to avoid jitter at near-zero speed.
const HEADING_LERP = 0.06;
const HEADING_THRESHOLD = 0.5;
const TWO_PI = Math.PI * 2;

const FORWARD_EPSILON = 1e-6;

const DEFAULT_BASIS: CameraBasis = {
  forward: { x: 0, y: 0, z: -1 },
  right: { x: 1, y: 0, z: 0 },
};

export const integratesIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

export const deriveBasis = (
  cameraForward: Vector3Impl,
  forwardScratch: Vector3Impl,
  rightScratch: Vector3Impl,
  upScratch: Vector3Impl,
): CameraBasis => {
  forwardScratch.copy(cameraForward);
  forwardScratch.y = 0;
  const forwardLength = forwardScratch.length();
  if (forwardLength < FORWARD_EPSILON) return DEFAULT_BASIS;
  forwardScratch.divideScalar(forwardLength);
  rightScratch.crossVectors(forwardScratch, upScratch);
  return {
    forward: { x: forwardScratch.x, y: forwardScratch.y, z: forwardScratch.z },
    right: { x: rightScratch.x, y: rightScratch.y, z: rightScratch.z },
  };
};

export type IdleMotion = { readonly bobY: number; readonly swayZ: number };

export const computeIdleMotion = (speedRatio: number, time: number): IdleMotion => {
  // Floor at IDLE_RATIO_FLOOR so the ship keeps fluttering during flight,
  // not just at rest. Lighter object = always-visible micro-motion.
  const idleRatio = IDLE_RATIO_FLOOR + (1 - IDLE_RATIO_FLOOR) * (1 - speedRatio);
  return {
    bobY: Math.sin(time * IDLE_BOB_FREQ_HZ * 2 * Math.PI) * IDLE_BOB_AMPLITUDE * idleRatio,
    swayZ: Math.sin(time * IDLE_SWAY_FREQ_HZ * 2 * Math.PI) * IDLE_SWAY_AMPLITUDE * idleRatio,
  };
};

export type RotationTargets = { readonly pitch: number; readonly roll: number };

export const computeRotationTargets = (
  velocity: { readonly x: number; readonly z: number },
  basis: CameraBasis,
): RotationTargets => {
  const forwardSpeed = velocity.x * basis.forward.x + velocity.z * basis.forward.z;
  const rightSpeed = velocity.x * basis.right.x + velocity.z * basis.right.z;
  return {
    pitch: -(forwardSpeed / MAX_SPEED) * MAX_PITCH,
    roll: -(rightSpeed / MAX_SPEED) * MAX_ROLL,
  };
};

export const applyHeadingLerp = (
  mesh: Object3D,
  velocity: { readonly x: number; readonly z: number },
  speed: number,
): void => {
  if (speed <= HEADING_THRESHOLD) return;
  const targetHeading = Math.atan2(velocity.x, velocity.z);
  let headingDelta = targetHeading - mesh.rotation.y;
  while (headingDelta > Math.PI) {
    headingDelta -= TWO_PI;
  }
  while (headingDelta < -Math.PI) {
    headingDelta += TWO_PI;
  }
  mesh.rotation.y += headingDelta * HEADING_LERP;
};

