import type { Vec3 } from './vec3';

type Placed = { readonly placement: readonly [number, number, number] };

export const proximityCheck = <T extends Placed>(
  playerPosition: Vec3,
  targets: ReadonlyArray<T>,
  radius: number,
): ReadonlyArray<T> => {
  const result: T[] = [];
  const limitSquared = radius * radius;
  for (const target of targets) {
    const [cx, cy, cz] = target.placement;
    const dx = cx - playerPosition.x;
    const dy = cy - playerPosition.y;
    const dz = cz - playerPosition.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared <= limitSquared) {
      result.push(target);
    }
  }
  return result;
};
