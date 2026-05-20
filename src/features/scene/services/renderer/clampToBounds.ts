import type { Vec3 } from '../../types/kinematics';

export type Bounds = {
  readonly min: Vec3;
  readonly max: Vec3;
};

const clamp = (value: number, lo: number, hi: number): number => {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
};

export const clampToBounds = (position: Vec3, bounds: Bounds): Vec3 => ({
  x: clamp(position.x, bounds.min.x, bounds.max.x),
  y: clamp(position.y, bounds.min.y, bounds.max.y),
  z: clamp(position.z, bounds.min.z, bounds.max.z),
});
