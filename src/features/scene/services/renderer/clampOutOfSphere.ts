import type { Vec3 } from './vec3';

export type Sphere = {
  readonly center: Vec3;
  readonly radius: number;
};

// Projects a point that lies inside a sphere outward onto the sphere's
// surface along the center→point ray. Outside-points and surface-points
// are returned unchanged. Radius-0 sphere is a no-op (used when the
// collider hasn't been measured yet — producer-reshape, no defensive
// guards at the call site).
//
// Degenerate input: when the point coincides with the center, the
// center→point ray is undefined; we return the +Y surface point as the
// arbitrary canonical choice.
export const clampOutOfSphere = (position: Vec3, sphere: Sphere): Vec3 => {
  if (sphere.radius === 0) return position;
  const dx = position.x - sphere.center.x;
  const dy = position.y - sphere.center.y;
  const dz = position.z - sphere.center.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance >= sphere.radius) return position;
  if (distance === 0) {
    return { x: sphere.center.x, y: sphere.center.y + sphere.radius, z: sphere.center.z };
  }
  const scale = sphere.radius / distance;
  return {
    x: sphere.center.x + dx * scale,
    y: sphere.center.y + dy * scale,
    z: sphere.center.z + dz * scale,
  };
};
