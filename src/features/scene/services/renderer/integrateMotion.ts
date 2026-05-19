import type { Intent } from '../../types/intent';
import type { Vec3 } from './vec3';

export const MAX_SPEED = 20;
export const ACCELERATION = 12;
export const BRAKE_RATE = 8;
export const TURN_RATE = Math.PI;

export type Kinematics = {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly heading: number;
};

const forward = (heading: number): Vec3 => ({
  x: Math.sin(heading),
  y: 0,
  z: Math.cos(heading),
});

const accelerationFromIntents = (
  intents: ReadonlySet<Intent['kind']>,
  heading: number,
): Vec3 => {
  const fwd = forward(heading);
  const thrustForward = intents.has('thrust_forward') ? 1 : 0;
  const thrustBackward = intents.has('thrust_backward') ? 1 : 0;
  const net = thrustForward - thrustBackward;
  return {
    x: fwd.x * ACCELERATION * net,
    y: fwd.y * ACCELERATION * net,
    z: fwd.z * ACCELERATION * net,
  };
};

const applyBrake = (
  velocity: Vec3,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
): Vec3 => {
  if (!intents.has('brake')) return velocity;
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (speed === 0) return velocity;
  const reduced = speed - BRAKE_RATE * dt;
  const factor = reduced > 0 ? reduced / speed : 0;
  return {
    x: velocity.x * factor,
    y: velocity.y * factor,
    z: velocity.z * factor,
  };
};

const clampSpeed = (velocity: Vec3): Vec3 => {
  const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
  if (speed <= MAX_SPEED) return velocity;
  const factor = MAX_SPEED / speed;
  return {
    x: velocity.x * factor,
    y: velocity.y * factor,
    z: velocity.z * factor,
  };
};

const turnDelta = (intents: ReadonlySet<Intent['kind']>, dt: number): number => {
  const left = intents.has('turn_left') ? 1 : 0;
  const right = intents.has('turn_right') ? 1 : 0;
  return (left - right) * TURN_RATE * dt;
};

export const integrateMotion = (
  state: Kinematics,
  intents: ReadonlySet<Intent['kind']>,
  dt: number,
): Kinematics => {
  const accel = accelerationFromIntents(intents, state.heading);
  const integrated: Vec3 = {
    x: state.velocity.x + accel.x * dt,
    y: state.velocity.y + accel.y * dt,
    z: state.velocity.z + accel.z * dt,
  };
  const braked = applyBrake(integrated, intents, dt);
  const velocity = clampSpeed(braked);
  const position: Vec3 = {
    x: state.position.x + velocity.x * dt,
    y: state.position.y + velocity.y * dt,
    z: state.position.z + velocity.z * dt,
  };
  const heading = state.heading + turnDelta(intents, dt);
  return { position, velocity, heading };
};
