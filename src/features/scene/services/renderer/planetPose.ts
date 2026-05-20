import type { BodyExtraction, PoleDirection } from './planetTypes';

// Quaternion (x, y, z, w) that rotates the mesh's pole direction onto world
// +y, so the planet's visible pole stands exactly vertical regardless of
// how the modeller authored the mesh.
export type PoleAlignQuaternion = readonly [number, number, number, number];

export type PlanetPose = {
  // Rotation applied to the mesh before any spin/sway. Carries the model's
  // pole direction onto world +y.
  readonly alignQuaternion: PoleAlignQuaternion;
};

const IDENTITY_QUATERNION: PoleAlignQuaternion = [0, 0, 0, 1];

const IDENTITY_POSE: PlanetPose = { alignQuaternion: IDENTITY_QUATERNION };

// Quaternion that rotates the unit vector `from` onto the unit vector `to`.
// Uses the cross-product / dot-product formula. Handles the anti-parallel
// case (where there is no unique rotation axis) by picking an arbitrary
// perpendicular and returning a 180° rotation.
const quaternionFromVectors = (
  from: PoleDirection,
  to: PoleDirection,
): PoleAlignQuaternion => {
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;
  const dot = fx * tx + fy * ty + fz * tz;
  // Already aligned.
  if (dot >= 0.999999) return IDENTITY_QUATERNION;
  // Anti-parallel: rotate 180° around any axis perpendicular to `from`. Pick
  // the axis with the smallest component of `from` to maximise stability.
  if (dot <= -0.999999) {
    const ax = Math.abs(fx);
    const ay = Math.abs(fy);
    const az = Math.abs(fz);
    // Cross `from` with the world axis it's least aligned with — gives a
    // non-degenerate perpendicular.
    const ortho: PoleDirection =
      ax <= ay && ax <= az ? [0, -fz, fy]
      : ay <= ax && ay <= az ? [-fz, 0, fx]
      : [-fy, fx, 0];
    const [ox, oy, oz] = ortho;
    const olen = Math.sqrt(ox * ox + oy * oy + oz * oz);
    return [ox / olen, oy / olen, oz / olen, 0];
  }
  // General case. Quaternion = (cross, 1 + dot), then normalise.
  const cx = fy * tz - fz * ty;
  const cy = fz * tx - fx * tz;
  const cz = fx * ty - fy * tx;
  const w = 1 + dot;
  const len = Math.sqrt(cx * cx + cy * cy + cz * cz + w * w);
  return [cx / len, cy / len, cz / len, w / len];
};

export const planetPoseFor = (extraction: BodyExtraction): PlanetPose => {
  if (extraction.kind === 'no_body') return IDENTITY_POSE;
  // Normalise the pole direction; downstream rotation maths assumes a unit
  // vector. The producer (band-normal aggregation) already normalises but
  // the multi-mesh fallback returns a literal cardinal unit — both paths
  // are length-1, the explicit normalise is a guard against future producers.
  const [px, py, pz] = extraction.poleDirection;
  const len = Math.sqrt(px * px + py * py + pz * pz);
  if (len === 0) return IDENTITY_POSE;
  const normalised: PoleDirection = [px / len, py / len, pz / len];
  const alignQuaternion = quaternionFromVectors(normalised, [0, 1, 0]);
  return { alignQuaternion };
};
