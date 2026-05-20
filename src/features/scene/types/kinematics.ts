export type Vec3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type Kinematics = {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly heading: number;
};

export const INITIAL_KINEMATICS: Kinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
};

export const MAX_SPEED = 14;
