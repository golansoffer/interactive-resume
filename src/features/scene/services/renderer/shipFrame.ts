import type { Object3D, Vector3 as Vector3Impl } from 'three';
import type { Intent } from '../../types/intent';
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

// Top reference speed for idle damping — widened to MAX_SPEED * 4.5 so the
// idle bob/sway still trends toward zero at full boost. Pitch/roll targets
// stay clamped at the baseline MAX_SPEED inside computeRotationTargets so
// the ship's tilt envelope never exceeds normal-flight max during boost.
export const BOOST_TOP_SPEED = MAX_SPEED * 4.5;

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

// Intent-driven heading — outer yaw lerps toward the direction implied by
// forward + strafe intents in the camera basis. The lerp factor scales
// with forward speed (HEADING_LERP_AT_REST → HEADING_LERP_AT_SPEED) so a
// pure strafe input at rest does not snap-rotate the ship 90° in a few
// frames; turning in coupled motion stays as responsive as before.
// Pressing back NEVER yaws the ship: reverse is straight reverse, not a
// 180° spin-then-drive.
const HEADING_LERP_AT_SPEED = 0.06;
const HEADING_LERP_AT_REST = 0.022;
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

// Derives the ship's target facing heading from the current intent set in
// the camera basis. The backward intent is intentionally NOT mapped into
// any direction here — pressing back is pure reverse and must not rotate
// the ship or the chase camera. When no forward/strafe intent is held the
// previous heading is returned unchanged so coasting (including coasting
// in reverse) preserves orientation.
export const computeIntentHeading = (
  intents: ReadonlySet<Intent['kind']>,
  basis: CameraBasis,
  previousHeading: number,
): number => {
  const forward = intents.has('move_forward') && !intents.has('move_backward') ? 1 : 0;
  const right =
    (intents.has('strafe_right') ? 1 : 0) - (intents.has('strafe_left') ? 1 : 0);
  if (forward === 0 && right === 0) return previousHeading;
  const x = basis.forward.x * forward + basis.right.x * right;
  const z = basis.forward.z * forward + basis.right.z * right;
  return Math.atan2(x, z);
};

export const applyHeadingLerp = (
  mesh: Object3D,
  targetHeading: number,
  speed: number,
): void => {
  let headingDelta = targetHeading - mesh.rotation.y;
  while (headingDelta > Math.PI) {
    headingDelta -= TWO_PI;
  }
  while (headingDelta < -Math.PI) {
    headingDelta += TWO_PI;
  }
  const speedRatio = speed <= 0 ? 0 : Math.min(1, speed / MAX_SPEED);
  const lerpFactor =
    HEADING_LERP_AT_REST + (HEADING_LERP_AT_SPEED - HEADING_LERP_AT_REST) * speedRatio;
  mesh.rotation.y += headingDelta * lerpFactor;
};

