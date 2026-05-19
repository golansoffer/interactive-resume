import type { Vec3 } from './vec3';

export const starParallaxOffset = (cameraPosition: Vec3, factor: number): Vec3 => ({
  x: -cameraPosition.x * factor,
  y: -cameraPosition.y * factor,
  z: -cameraPosition.z * factor,
});
