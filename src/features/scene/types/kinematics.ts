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
  position: { x: 42.51, y: 0, z: -7.22 },
  velocity: { x: 0, y: 0, z: 0 },
  // Faces Saturn (the first career stop) from the spawn position.
  heading: Math.atan2(20, 45),
};

export const MAX_SPEED = 50;
