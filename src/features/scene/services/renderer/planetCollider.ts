import type { Sphere } from './clampOutOfSphere';
import type { BodyExtraction } from './planetTypes';

// Builds the collision sphere for a planet from its extracted body and
// scene-graph placement. Rings are excluded because `extractBody` already
// reports body-only radius (minDim/2 — the ring-normal half-thickness for
// merged ringed meshes). A `no_body` extraction folds into a radius-0
// sphere — `clampOutOfSphere` treats radius 0 as a no-op, so unmeasured
// planets are observationally absent from the collider list.
export const planetCollider = (
  extraction: BodyExtraction,
  placement: readonly [number, number, number],
  scale: number,
): Sphere => {
  const bodyRadius = extraction.kind === 'no_body' ? 0 : extraction.radius;
  return {
    center: { x: placement[0], y: placement[1], z: placement[2] },
    radius: bodyRadius * scale,
  };
};
