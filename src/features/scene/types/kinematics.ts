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
  // Pulled back along the facing line (heading direction is (20, 45) in xz,
  // reduced to (4, 9)) so the player flies in toward Saturn from farther out.
  position: { x: 56, y: 0, z: 26 },
  velocity: { x: 0, y: 0, z: 0 },
  // Faces Saturn (the first career stop) from the spawn position.
  heading: Math.atan2(20, 45),
};

export const MAX_SPEED = 14;
