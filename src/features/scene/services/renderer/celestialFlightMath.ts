import type { Rng, Vec3 } from '../../types/celestial-flight';

const TWO_PI = Math.PI * 2;

const FALLBACK_DIRECTION: Vec3 = [1, 0, 0];

const REFERENCE_AXIS_X: Vec3 = [1, 0, 0];
const REFERENCE_AXIS_Y: Vec3 = [0, 1, 0];
const REFERENCE_AXIS_Z: Vec3 = [0, 0, 1];

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const vecAdd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vecSub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vecScale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const vecDot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const vecCross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const vecLength = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export const vecNormalize = (v: Vec3): Vec3 => {
  const m = vecLength(v);
  if (m === 0) return FALLBACK_DIRECTION;
  return [v[0] / m, v[1] / m, v[2] / m];
};

const leastAlignedReferenceAxis = (direction: Vec3): Vec3 => {
  const ax = Math.abs(direction[0]);
  const ay = Math.abs(direction[1]);
  const az = Math.abs(direction[2]);
  if (ax <= ay && ax <= az) return REFERENCE_AXIS_X;
  if (ay <= az) return REFERENCE_AXIS_Y;
  return REFERENCE_AXIS_Z;
};

type Basis = { readonly e1: Vec3; readonly e2: Vec3 };

const orthonormalBasis = (unit: Vec3): Basis => {
  const reference = leastAlignedReferenceAxis(unit);
  const e1 = vecNormalize(vecCross(unit, reference));
  const e2 = vecCross(unit, e1);
  return { e1, e2 };
};

export const samplePointOnSphere = (radius: number, rng: Rng): Vec3 => {
  const u1 = rng.next();
  const u2 = rng.next();
  const theta = TWO_PI * u1;
  const phi = Math.acos(1 - 2 * u2);
  const sinPhi = Math.sin(phi);
  return [
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ];
};

export type ForwardBias = {
  // Cosine of the half-angle of the forward cap. capCosHalfAngle = 0.5 is a
  // 60° cap; 0.0 is the forward hemisphere; -1 is the full sphere.
  readonly capCosHalfAngle: number;
  // Probability that a sample falls inside the forward cap. The remaining
  // probability draws uniformly from the full sphere to keep peripheral
  // and behind-camera variety so the sky never feels scripted.
  readonly forwardProbability: number;
};

// Mixed-distribution biased sampling around `cameraForward`. With
// probability `forwardProbability` the direction lands inside the forward
// cap of half-angle acos(capCosHalfAngle); otherwise it is uniform on the
// full sphere. Both sub-distributions are closed-form (cos(theta) uniform
// on the appropriate interval), so the sampler is O(1) and deterministic.
export const sampleForwardBiasedDirection = (
  cameraForward: Vec3,
  bias: ForwardBias,
  rng: Rng,
): Vec3 => {
  const forwardUnit = vecNormalize(cameraForward);
  const selector = rng.next();
  const u = rng.next();
  const cosThetaMid =
    selector < bias.forwardProbability
      ? bias.capCosHalfAngle + (1 - bias.capCosHalfAngle) * u
      : -1 + 2 * u;
  const sinThetaMid = Math.sqrt(Math.max(0, 1 - cosThetaMid * cosThetaMid));
  const phi = TWO_PI * rng.next();
  const { e1, e2 } = orthonormalBasis(forwardUnit);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  return [
    cosThetaMid * forwardUnit[0] + sinThetaMid * (cosPhi * e1[0] + sinPhi * e2[0]),
    cosThetaMid * forwardUnit[1] + sinThetaMid * (cosPhi * e1[1] + sinPhi * e2[1]),
    cosThetaMid * forwardUnit[2] + sinThetaMid * (cosPhi * e1[2] + sinPhi * e2[2]),
  ];
};

// Pick a pair of arc endpoints on the sphere whose midpoint direction is
// `midpoint`. Endpoints are rotated symmetrically by ±theta/2 about a
// perpendicular axis derived from `midpoint`'s orthonormal basis. Since the
// rotation axis is perpendicular to `midpoint`, Rodrigues' formula reduces
// to `m̂·cos(angle) + (axis × m̂)·sin(angle)`.
export const pickArcAroundMidpoint = (
  midpoint: Vec3,
  radius: number,
  arcAngleMinRad: number,
  arcAngleMaxRad: number,
  rng: Rng,
): { readonly p0: Vec3; readonly p2: Vec3 } => {
  const midUnit = vecNormalize(midpoint);
  const theta = lerp(arcAngleMinRad, arcAngleMaxRad, rng.next());
  const phi = TWO_PI * rng.next();
  const { e1, e2 } = orthonormalBasis(midUnit);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const axis: Vec3 = [
    cosPhi * e1[0] + sinPhi * e2[0],
    cosPhi * e1[1] + sinPhi * e2[1],
    cosPhi * e1[2] + sinPhi * e2[2],
  ];
  const half = theta * 0.5;
  const cosHalf = Math.cos(half);
  const sinHalf = Math.sin(half);
  const cross = vecCross(axis, midUnit);
  const dirPositive: Vec3 = [
    midUnit[0] * cosHalf + cross[0] * sinHalf,
    midUnit[1] * cosHalf + cross[1] * sinHalf,
    midUnit[2] * cosHalf + cross[2] * sinHalf,
  ];
  const dirNegative: Vec3 = [
    midUnit[0] * cosHalf - cross[0] * sinHalf,
    midUnit[1] * cosHalf - cross[1] * sinHalf,
    midUnit[2] * cosHalf - cross[2] * sinHalf,
  ];
  return { p0: vecScale(dirNegative, radius), p2: vecScale(dirPositive, radius) };
};

export const pickRadialBulgeControlPoint = (
  p0: Vec3,
  p2: Vec3,
  radius: number,
  bulgeMin: number,
  bulgeMax: number,
  rng: Rng,
): Vec3 => {
  // Chord midpoint direction radiates outward from the anchor because both
  // endpoints sit on the same hemisphere (angular spread < π by construction).
  // The midpoint magnitude is therefore strictly > 0.
  const mid: Vec3 = [(p0[0] + p2[0]) * 0.5, (p0[1] + p2[1]) * 0.5, (p0[2] + p2[2]) * 0.5];
  const outward = vecNormalize(mid);
  const bulge = lerp(bulgeMin, bulgeMax, rng.next());
  const r = radius + bulge;
  return [outward[0] * r, outward[1] * r, outward[2] * r];
};
