import type { Intent } from '../../types/intent';
import type { Vec3 } from './vec3';

export const MAX_SPEED = 14;
export const ACCELERATION = 120;
export const DECELERATION = 140;

export type Kinematics = {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly heading: number;
};

export type CameraBasis = {
  readonly forward: Vec3;
  readonly right: Vec3;
};

const ZERO_VEC: Vec3 = { x: 0, y: 0, z: 0 };

const desiredDirection = (
  intents: ReadonlySet<Intent['kind']>,
  basis: CameraBasis,
): Vec3 => {
  const f = (intents.has('move_forward') ? 1 : 0) - (intents.has('move_backward') ? 1 : 0);
  const r = (intents.has('strafe_right') ? 1 : 0) - (intents.has('strafe_left') ? 1 : 0);
  const x = basis.forward.x * f + basis.right.x * r;
  const y = basis.forward.y * f + basis.right.y * r;
  const z = basis.forward.z * f + basis.right.z * r;
  const magnitude = Math.hypot(x, y, z);
  if (magnitude === 0) return ZERO_VEC;
  return { x: x / magnitude, y: y / magnitude, z: z / magnitude };
};

const stepToward = (current: number, target: number, maxStep: number): number => {
  const delta = target - current;
  if (delta > maxStep) return current + maxStep;
  if (delta < -maxStep) return current - maxStep;
  return target;
};

const snapVelocity = (
  velocity: Vec3,
  target: Vec3,
  rate: number,
  dt: number,
): Vec3 => {
  const maxStep = rate * dt;
  return {
    x: stepToward(velocity.x, target.x, maxStep),
    y: stepToward(velocity.y, target.y, maxStep),
    z: stepToward(velocity.z, target.z, maxStep),
  };
};

export const integrateMotion = (
  state: Kinematics,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
  basis: CameraBasis,
): Kinematics => {
  const direction = desiredDirection(intents, basis);
  const targetVelocity: Vec3 = {
    x: direction.x * MAX_SPEED,
    y: direction.y * MAX_SPEED,
    z: direction.z * MAX_SPEED,
  };
  const pushing = intents.size > 0 && (direction.x !== 0 || direction.y !== 0 || direction.z !== 0);
  const rate = pushing ? ACCELERATION : DECELERATION;
  const velocity = snapVelocity(state.velocity, targetVelocity, rate, dt);
  const position: Vec3 = {
    x: state.position.x + velocity.x * dt,
    y: state.position.y + velocity.y * dt,
    z: state.position.z + velocity.z * dt,
  };
  return { position, velocity, heading: state.heading };
};
