import type { Vec3 } from '../../types/kinematics';
import type { Sphere } from '../../types/sphere';
import { clampOutOfSphere } from './clampOutOfSphere';

// Folds clampOutOfSphere across a list of colliders. Empty list returns
// the input position unchanged — the reduce's initial value carries that
// identity by construction; no defensive guard required.
export const clampToColliders = (
  position: Vec3,
  colliders: ReadonlyArray<Sphere>,
): Vec3 => colliders.reduce((pos, sphere) => clampOutOfSphere(pos, sphere), position);
