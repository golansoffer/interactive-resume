import type { Vec3 } from './vec3';

// Each target carries its own activation radius — planets vary in visible
// size (Saturn with rings is larger than Mars), so a single global radius
// can't keep the activation zone "synced" with each planet's actual extent.
type Placed = {
  readonly placement: readonly [number, number, number];
  readonly radius: number;
};

export const proximityCheck = <T extends Placed>(
  playerPosition: Vec3,
  targets: ReadonlyArray<T>,
): ReadonlyArray<T> => {
  const result: T[] = [];
  for (const target of targets) {
    const [cx, cy, cz] = target.placement;
    const dx = cx - playerPosition.x;
    const dy = cy - playerPosition.y;
    const dz = cz - playerPosition.z;
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    const limitSquared = target.radius * target.radius;
    if (distanceSquared <= limitSquared) {
      result.push(target);
    }
  }
  return result;
};
