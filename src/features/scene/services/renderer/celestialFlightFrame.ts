import type { Flight, FlightKind, FlightSample, Vec3 } from '../../types/celestial-flight';

const easeLinear = (t: number): number => t;
const easeSmoothS = (t: number): number => t * t * (3 - 2 * t);

const easedTime = (curve: FlightKind['ease'], t: number): number => {
  if (curve === 'linear') return easeLinear(t);
  return easeSmoothS(t);
};

const bezierPosition = (p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 => {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const a = 2 * u * t;
  return [
    uu * p0[0] + a * p1[0] + tt * p2[0],
    uu * p0[1] + a * p1[1] + tt * p2[1],
    uu * p0[2] + a * p1[2] + tt * p2[2],
  ];
};

const bezierDerivative = (p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 => {
  const u = 1 - t;
  return [
    2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
    2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]),
    2 * u * (p1[2] - p0[2]) + 2 * t * (p2[2] - p1[2]),
  ];
};

const SAFE_TANGENT: Vec3 = [1, 0, 0];

const normalize = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (m === 0) return SAFE_TANGENT;
  return [v[0] / m, v[1] / m, v[2] / m];
};

export const sampleFlight = (flight: Flight, now: number): FlightSample => {
  const arcEndsAt = flight.startedAt + flight.duration;
  const coastEndsAt = arcEndsAt + flight.kind.tailCoastSeconds;
  if (now >= coastEndsAt) return { kind: 'completed', endedAt: coastEndsAt };
  if (now <= flight.startedAt) {
    return {
      kind: 'traversing',
      position: flight.p0,
      tangent: normalize(bezierDerivative(flight.p0, flight.p1, flight.p2, 0)),
      age01: 0,
    };
  }
  if (now >= arcEndsAt) {
    const coastSeconds = now - arcEndsAt;
    // Head stays pinned at p2 during coast. Holding still is the cleanest
    // handoff visually — the fading head reads as a dying ember, not as a
    // body still in motion. drei <Trail> continues to emit samples on top
    // of the stationary head; its `decay` shortens the tail naturally while
    // material opacity fades linearly to zero over `tailCoastSeconds`.
    return {
      kind: 'coasting',
      position: flight.p2,
      tangent: normalize(bezierDerivative(flight.p0, flight.p1, flight.p2, 1)),
      coastProgress01: coastSeconds / flight.kind.tailCoastSeconds,
    };
  }
  const rawT = (now - flight.startedAt) / flight.duration;
  const easedT = easedTime(flight.kind.ease, rawT);
  return {
    kind: 'traversing',
    position: bezierPosition(flight.p0, flight.p1, flight.p2, easedT),
    tangent: normalize(bezierDerivative(flight.p0, flight.p1, flight.p2, easedT)),
    age01: rawT,
  };
};
