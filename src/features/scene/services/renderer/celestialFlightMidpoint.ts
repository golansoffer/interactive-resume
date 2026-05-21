import type { Flight, Rng, Vec3 } from '../../types/celestial-flight';
import {
  sampleForwardBiasedDirection,
  vecDot,
  vecNormalize,
  type ForwardBias,
} from './celestialFlightMath';

// Two arcs in the same layer whose midpoint directions are closer than ~60°
// appear to the camera as overlapping streaks — the visible separation comes
// from the midpoint direction, not the arc shape. cos(60°) is the dot-product
// threshold for "this candidate is too close to one already placed".
const MIN_MIDPOINT_SEPARATION_COS = Math.cos((60 * Math.PI) / 180);
const SEPARATION_REJECTION_ATTEMPTS = 8;

const tooCloseToAny = (candidate: Vec3, existing: ReadonlyArray<Vec3>): boolean => {
  for (const placed of existing) {
    if (vecDot(candidate, placed) > MIN_MIDPOINT_SEPARATION_COS) return true;
  }
  return false;
};

export const pickSeparatedMidpoint = (
  cameraForward: Vec3,
  bias: ForwardBias,
  existing: ReadonlyArray<Vec3>,
  rng: Rng,
): Vec3 => {
  let chosen: Vec3 = sampleForwardBiasedDirection(cameraForward, bias, rng);
  for (let attempt = 1; attempt < SEPARATION_REJECTION_ATTEMPTS; attempt += 1) {
    if (!tooCloseToAny(chosen, existing)) return chosen;
    chosen = sampleForwardBiasedDirection(cameraForward, bias, rng);
  }
  return chosen;
};

// Bias direction `m̂` is rotated ±theta/2 to form p0/p2; the chord-midpoint
// proxy `normalize(p0 + p2)` lies along `m̂` (rotation axis is perpendicular
// to `m̂`, so the two rotated endpoints' sum lies in the `m̂` direction), so
// it is the correct separation key for an already-placed flight.
export const midpointProxyOf = (flight: Flight): Vec3 =>
  vecNormalize([
    flight.p0[0] + flight.p2[0],
    flight.p0[1] + flight.p2[1],
    flight.p0[2] + flight.p2[2],
  ]);
