import type { Vec3 } from './kinematics';

// Pure port shape for sphere colliders. Crosses layers as parsed data —
// services/renderer functions consume it, components/Scene registries
// publish it. The geometry/collision logic lives in services/renderer.
export type Sphere = {
  readonly center: Vec3;
  readonly radius: number;
};
