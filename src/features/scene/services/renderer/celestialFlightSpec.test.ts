import { describe, expect, it } from 'vitest';
import {
  buildFlightSchedule,
  defaultArchetypes,
  defaultLayers,
  recycleCompletedFlights,
} from './celestialFlightSpec';
import { sampleFlight } from './celestialFlightFrame';
import type { DepthLayer, Vec3 } from '../../types/celestial-flight';

const SEED = 42;
const TEST_CAMERA_FORWARD: Vec3 = [0, 0, 1];

const buildBaseline = (now: number): ReturnType<typeof buildFlightSchedule> =>
  buildFlightSchedule({
    seed: SEED,
    layers: defaultLayers(),
    archetypes: defaultArchetypes(),
    now,
    cameraForward: TEST_CAMERA_FORWARD,
  });

const flightLifetimeEnd = (
  flight: ReturnType<typeof buildFlightSchedule>['flights'][number],
): number => flight.startedAt + flight.duration + flight.kind.tailCoastSeconds;

const earliestEnd = (schedule: ReturnType<typeof buildFlightSchedule>): number => {
  let earliest = Infinity;
  for (const flight of schedule.flights) {
    const endedAt = flightLifetimeEnd(flight);
    if (endedAt < earliest) earliest = endedAt;
  }
  return earliest;
};

describe('recycleCompletedFlights', () => {
  it('returns the same schedule reference when no flight has completed', () => {
    const prev = buildBaseline(0);
    const safeNow = earliestEnd(prev) - 1e-6;
    const next = recycleCompletedFlights(prev, safeNow, defaultArchetypes(), TEST_CAMERA_FORWARD);
    expect(next).toBe(prev);
  });

  it('passes active flights through by reference when a single flight completes', () => {
    const prev = buildBaseline(0);
    const earliest = earliestEnd(prev);
    const now = earliest + 1e-6;
    const completedIds = new Set<number>();
    for (const flight of prev.flights) {
      if (flightLifetimeEnd(flight) <= earliest) completedIds.add(flight.id);
    }
    expect(completedIds.size).toBe(1);
    const next = recycleCompletedFlights(prev, now, defaultArchetypes(), TEST_CAMERA_FORWARD);
    expect(next).not.toBe(prev);
    expect(next.flights.length).toBe(prev.flights.length);
    expect(next.nextId).toBe(prev.nextId + 1);
    const prevById = new Map<number, (typeof prev.flights)[number]>();
    for (const flight of prev.flights) prevById.set(flight.id, flight);
    let recycledCount = 0;
    for (const after of next.flights) {
      const matched = prevById.get(after.id);
      if (matched === undefined) {
        recycledCount += 1;
        expect(after.id).toBe(prev.nextId);
        continue;
      }
      expect(after).toBe(matched);
      expect(completedIds.has(matched.id)).toBe(false);
    }
    expect(recycledCount).toBe(1);
  });

  it('is deterministic: same input and now produces structurally identical output', () => {
    const prev = buildBaseline(0);
    const a = recycleCompletedFlights(prev, 1_000, defaultArchetypes(), TEST_CAMERA_FORWARD);
    const b = recycleCompletedFlights(prev, 1_000, defaultArchetypes(), TEST_CAMERA_FORWARD);
    expect(a.rngState).toBe(b.rngState);
    expect(a.nextId).toBe(b.nextId);
    expect(a.flights).toEqual(b.flights);
  });

  it('does not recycle a flight whose arc has ended but whose tail-coast is still running', () => {
    const prev = buildBaseline(0);
    const pickShortestCoast = (
      flights: ReadonlyArray<(typeof prev.flights)[number]>,
    ): (typeof prev.flights)[number] => {
      let best: (typeof prev.flights)[number] | null = null;
      let smallest = Infinity;
      for (const flight of flights) {
        if (flight.kind.tailCoastSeconds < smallest) {
          smallest = flight.kind.tailCoastSeconds;
          best = flight;
        }
      }
      if (best === null) throw new Error('test: schedule has no flights');
      return best;
    };
    const target = pickShortestCoast(prev.flights);
    const arcEnd = target.startedAt + target.duration;
    const coastingNow = arcEnd + 0.1 * target.kind.tailCoastSeconds;
    const next = recycleCompletedFlights(
      prev,
      coastingNow,
      defaultArchetypes(),
      TEST_CAMERA_FORWARD,
    );
    let survivor: (typeof next.flights)[number] | null = null;
    for (const flight of next.flights) {
      if (flight.id === target.id) {
        survivor = flight;
        break;
      }
    }
    expect(survivor).toBe(target);
  });
});

const vecLen = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

const angleBetweenUnits = (a: Vec3, b: Vec3): number => {
  const aLen = vecLen(a);
  const bLen = vecLen(b);
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (aLen * bLen);
  const clamped = Math.max(-1, Math.min(1, cosine));
  return Math.acos(clamped);
};

const bezierAt = (p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 => {
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

const ENDPOINT_TOLERANCE = 1e-6;
const PATH_SAMPLES = 32;

const layerOfKind = (
  layers: ReadonlyArray<DepthLayer>,
  kind: DepthLayer['kind'],
): DepthLayer => {
  for (const layer of layers) {
    if (layer.kind === kind) return layer;
  }
  throw new Error(`test: missing layer ${kind}`);
};

describe('celestial flight geometry', () => {
  it('p0 and p2 both lie on the layer sphere of radius R', () => {
    const layers = defaultLayers();
    const schedule = buildBaseline(0);
    for (const flight of schedule.flights) {
      const layer = layerOfKind(layers, flight.layer);
      expect(vecLen(flight.p0)).toBeCloseTo(layer.radius, 5);
      expect(vecLen(flight.p2)).toBeCloseTo(layer.radius, 5);
    }
  });

  it('p2 sits at an angular distance from p0 within the layer arc-angle range', () => {
    const layers = defaultLayers();
    const schedule = buildBaseline(0);
    for (const flight of schedule.flights) {
      const layer = layerOfKind(layers, flight.layer);
      const theta = angleBetweenUnits(flight.p0, flight.p2);
      expect(theta).toBeGreaterThanOrEqual(layer.arcAngleMinRad - ENDPOINT_TOLERANCE);
      expect(theta).toBeLessThanOrEqual(layer.arcAngleMaxRad + ENDPOINT_TOLERANCE);
    }
  });

  it('the radial bulge control point |p1| lies in [R + bulgeMin, R + bulgeMax]', () => {
    const layers = defaultLayers();
    const schedule = buildBaseline(0);
    for (const flight of schedule.flights) {
      const layer = layerOfKind(layers, flight.layer);
      const len = vecLen(flight.p1);
      expect(len).toBeGreaterThanOrEqual(layer.radius + layer.bulgeMin - ENDPOINT_TOLERANCE);
      expect(len).toBeLessThanOrEqual(layer.radius + layer.bulgeMax + ENDPOINT_TOLERANCE);
    }
  });

  it('the path never approaches the anchor closer than R * cos(arcAngleMax / 2)', () => {
    const layers = defaultLayers();
    const schedule = buildBaseline(0);
    for (const flight of schedule.flights) {
      const layer = layerOfKind(layers, flight.layer);
      const bound = layer.radius * Math.cos(layer.arcAngleMaxRad / 2);
      for (let i = 0; i <= PATH_SAMPLES; i += 1) {
        const t = i / PATH_SAMPLES;
        const sample = bezierAt(flight.p0, flight.p1, flight.p2, t);
        const dist = vecLen(sample);
        expect(dist).toBeGreaterThanOrEqual(bound - ENDPOINT_TOLERANCE);
      }
    }
  });
});

describe('forward-bias arc placement', () => {
  it('aggregated across 50 seeds, the mean arc midpoint direction is biased toward cameraForward', () => {
    const cameraForward: Vec3 = [0, 0, 1];
    const denseLayer: DepthLayer = {
      kind: 'midground',
      parallax: 0.97,
      capacity: 1000,
      radius: 1500,
      bulgeMin: 90,
      bulgeMax: 260,
      arcAngleMinRad: (45 * Math.PI) / 180,
      arcAngleMaxRad: (95 * Math.PI) / 180,
      durationMin: 22,
      durationMax: 40,
      distribution: [{ archetype: 'comet_hero', weight: 1 }],
      palette: [[1, 1, 1]],
    };
    let sumZ = 0;
    let count = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const schedule = buildFlightSchedule({
        seed,
        layers: [denseLayer],
        archetypes: defaultArchetypes(),
        now: 0,
        cameraForward,
      });
      for (const flight of schedule.flights) {
        const mx = (flight.p0[0] + flight.p2[0]) * 0.5;
        const my = (flight.p0[1] + flight.p2[1]) * 0.5;
        const mz = (flight.p0[2] + flight.p2[2]) * 0.5;
        const mLen = Math.hypot(mx, my, mz);
        if (mLen === 0) continue;
        sumZ += mz / mLen;
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(45_000);
    const meanZ = sumZ / count;
    expect(meanZ).toBeGreaterThan(0.5);
  });
});

const firstFlight = (
  schedule: ReturnType<typeof buildFlightSchedule>,
): ReturnType<typeof buildFlightSchedule>['flights'][number] => {
  for (const flight of schedule.flights) return flight;
  throw new Error('test: schedule has no flights');
};

describe('sampleFlight tail-coast', () => {
  it('returns coasting with position pinned to p2 throughout the tail-coast window', () => {
    const flight = firstFlight(buildBaseline(0));
    const arcEnd = flight.startedAt + flight.duration;
    const coastFractions = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999];
    for (const fraction of coastFractions) {
      const now = arcEnd + fraction * flight.kind.tailCoastSeconds;
      const sample = sampleFlight(flight, now);
      expect(sample.kind).toBe('coasting');
      if (sample.kind !== 'coasting') continue;
      expect(sample.coastProgress01).toBeCloseTo(fraction, 6);
      expect(sample.position[0]).toBeCloseTo(flight.p2[0], 6);
      expect(sample.position[1]).toBeCloseTo(flight.p2[1], 6);
      expect(sample.position[2]).toBeCloseTo(flight.p2[2], 6);
    }
  });

  it('returns traversing strictly inside the arc window', () => {
    const flight = firstFlight(buildBaseline(0));
    const arcMid = flight.startedAt + 0.5 * flight.duration;
    const sample = sampleFlight(flight, arcMid);
    expect(sample.kind).toBe('traversing');
  });

  it('returns completed only after the tail-coast window has elapsed', () => {
    const flight = firstFlight(buildBaseline(0));
    const arcEnd = flight.startedAt + flight.duration;
    const coastEnd = arcEnd + flight.kind.tailCoastSeconds;
    const stillCoasting = sampleFlight(flight, coastEnd - 1e-6);
    expect(stillCoasting.kind).toBe('coasting');
    const justCompleted = sampleFlight(flight, coastEnd);
    expect(justCompleted.kind).toBe('completed');
    if (justCompleted.kind !== 'completed') return;
    expect(justCompleted.endedAt).toBeCloseTo(coastEnd, 6);
  });
});

describe('initial stagger window', () => {
  it('every flight has at least 55% of its arc remaining on frame 1', () => {
    const schedule = buildBaseline(0);
    for (const flight of schedule.flights) {
      const ageOnFrameOne = (0 - flight.startedAt) / flight.duration;
      expect(ageOnFrameOne).toBeGreaterThanOrEqual(0);
      expect(ageOnFrameOne).toBeLessThanOrEqual(0.45 + 1e-9);
    }
  });
});

const denseLayerForVariation = (capacity: number): DepthLayer => ({
  kind: 'midground',
  parallax: 0.97,
  capacity,
  radius: 1500,
  bulgeMin: 90,
  bulgeMax: 260,
  arcAngleMinRad: (45 * Math.PI) / 180,
  arcAngleMaxRad: (95 * Math.PI) / 180,
  durationMin: 22,
  durationMax: 40,
  distribution: [{ archetype: 'comet_hero', weight: 1 }],
  palette: [[1, 1, 1]],
});

const buildVariationSchedule = (
  capacity: number,
  seed: number,
): ReturnType<typeof buildFlightSchedule> =>
  buildFlightSchedule({
    seed,
    layers: [denseLayerForVariation(capacity)],
    archetypes: defaultArchetypes(),
    now: 0,
    cameraForward: TEST_CAMERA_FORWARD,
  });

describe('per-flight trail dimension jitter', () => {
  it('every flight has trailWidthScale in [0.55, 1.35]', () => {
    const schedule = buildVariationSchedule(1000, 7);
    for (const flight of schedule.flights) {
      expect(flight.trailWidthScale).toBeGreaterThanOrEqual(0.55);
      expect(flight.trailWidthScale).toBeLessThanOrEqual(1.35);
    }
  });

  it('every flight has trailLengthScale in [0.4, 2.0]', () => {
    const schedule = buildVariationSchedule(1000, 7);
    for (const flight of schedule.flights) {
      expect(flight.trailLengthScale).toBeGreaterThanOrEqual(0.4);
      expect(flight.trailLengthScale).toBeLessThanOrEqual(2.0);
    }
  });

  it('across 1000 flights the mean trailLengthScale is below 0.9 (short-bias)', () => {
    const schedule = buildVariationSchedule(1000, 7);
    let sum = 0;
    let count = 0;
    for (const flight of schedule.flights) {
      sum += flight.trailLengthScale;
      count += 1;
    }
    expect(count).toBe(1000);
    const mean = sum / count;
    expect(mean).toBeLessThan(0.9);
  });

  it('across 1000 flights fewer than 35% have trailLengthScale > 1.0', () => {
    const schedule = buildVariationSchedule(1000, 7);
    let longCount = 0;
    let total = 0;
    for (const flight of schedule.flights) {
      if (flight.trailLengthScale > 1.0) longCount += 1;
      total += 1;
    }
    expect(total).toBe(1000);
    expect(longCount / total).toBeLessThan(0.35);
  });
});

const midpointProxyOf = (flight: ReturnType<typeof buildFlightSchedule>['flights'][number]): Vec3 => {
  const sx = flight.p0[0] + flight.p2[0];
  const sy = flight.p0[1] + flight.p2[1];
  const sz = flight.p0[2] + flight.p2[2];
  const len = Math.hypot(sx, sy, sz);
  return [sx / len, sy / len, sz / len];
};

// The build path enforces angular separation across `SEPARATION_REJECTION_ATTEMPTS`
// (8) tries; the 8th sample is accepted unconditionally. cos(50°) is the upper
// bound on pairwise dot product when the fallback fires — a ~10° relaxation
// from the 60° hard target.
const FALLBACK_SEPARATION_COS = Math.cos((50 * Math.PI) / 180);

const midpointsForLayer = (
  schedule: ReturnType<typeof buildFlightSchedule>,
  kind: DepthLayer['kind'],
): Vec3[] => {
  const out: Vec3[] = [];
  for (const flight of schedule.flights) {
    if (flight.layer === kind) out.push(midpointProxyOf(flight));
  }
  return out;
};

const dot3 = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const forEachUnorderedPair = <T>(
  items: ReadonlyArray<T>,
  visit: (a: T, b: T) => void,
): void => {
  let index = 0;
  for (const a of items) {
    let j = 0;
    for (const b of items) {
      if (j > index) visit(a, b);
      j += 1;
    }
    index += 1;
  }
};

const pairwiseDotSum = (vectors: ReadonlyArray<Vec3>): { readonly sum: number; readonly pairs: number } => {
  let sum = 0;
  let pairs = 0;
  forEachUnorderedPair(vectors, (a, b) => {
    sum += dot3(a, b);
    pairs += 1;
  });
  return { sum, pairs };
};

const maxPairwiseDot = (vectors: ReadonlyArray<Vec3>): number => {
  let max = -Infinity;
  forEachUnorderedPair(vectors, (a, b) => {
    const d = dot3(a, b);
    if (d > max) max = d;
  });
  return max;
};

describe('midpoint angular separation', () => {
  it('within a single layer, every pair of flights satisfies the separation bound', () => {
    const schedule = buildBaseline(0);
    for (const layer of defaultLayers()) {
      const midpoints = midpointsForLayer(schedule, layer.kind);
      if (midpoints.length < 2) continue;
      expect(maxPairwiseDot(midpoints)).toBeLessThanOrEqual(FALLBACK_SEPARATION_COS);
    }
  });

  it('typical-case pairwise midground midpoint dot product across 50 seeds is well below the threshold', () => {
    let totalSum = 0;
    let totalPairs = 0;
    for (let s = 1; s <= 50; s += 1) {
      const schedule = buildFlightSchedule({
        seed: s,
        layers: defaultLayers(),
        archetypes: defaultArchetypes(),
        now: 0,
        cameraForward: TEST_CAMERA_FORWARD,
      });
      const midground = midpointsForLayer(schedule, 'midground');
      const { sum, pairs } = pairwiseDotSum(midground);
      totalSum += sum;
      totalPairs += pairs;
    }
    expect(totalPairs).toBeGreaterThan(0);
    expect(totalSum / totalPairs).toBeLessThan(0.7);
  });
});
