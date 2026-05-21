import type {
  ArchetypeKind,
  ArchetypeTable,
  DepthLayer,
  DistributionEntry,
  Flight,
  FlightKind,
  Rgb,
  Rng,
  Vec3,
} from '../../types/celestial-flight';
import {
  lerp,
  pickArcAroundMidpoint,
  pickRadialBulgeControlPoint,
  type ForwardBias,
} from './celestialFlightMath';

export type ValidatedLayer = {
  readonly source: DepthLayer;
  readonly distribution: readonly [DistributionEntry, ...DistributionEntry[]];
  readonly palette: readonly [Rgb, ...Rgb[]];
  readonly distributionTotal: number;
};

export const validateLayer = (layer: DepthLayer): ValidatedLayer => {
  if (layer.palette.length === 0) {
    throw new Error(`celestial-flight: layer ${layer.kind} has empty palette`);
  }
  if (layer.distribution.length === 0) {
    throw new Error(`celestial-flight: layer ${layer.kind} has empty distribution`);
  }
  let total = 0;
  for (const entry of layer.distribution) total += entry.weight;
  if (total <= 0) {
    throw new Error(`celestial-flight: layer ${layer.kind} has zero-sum distribution`);
  }
  if (layer.radius <= 0) {
    throw new Error(`celestial-flight: layer ${layer.kind} has non-positive radius`);
  }
  if (layer.bulgeMin <= 0 || layer.bulgeMax < layer.bulgeMin) {
    throw new Error(`celestial-flight: layer ${layer.kind} has invalid bulge range`);
  }
  if (
    layer.arcAngleMinRad <= 0 ||
    layer.arcAngleMaxRad >= Math.PI ||
    layer.arcAngleMaxRad <= layer.arcAngleMinRad
  ) {
    throw new Error(`celestial-flight: layer ${layer.kind} has invalid arc angle range`);
  }
  return {
    source: layer,
    distribution: layer.distribution as readonly [DistributionEntry, ...DistributionEntry[]],
    palette: layer.palette as readonly [Rgb, ...Rgb[]],
    distributionTotal: total,
  };
};

const pickArchetypeKind = (validated: ValidatedLayer, rng: Rng): ArchetypeKind => {
  const u = rng.next() * validated.distributionTotal;
  let acc = 0;
  let last = validated.distribution[0];
  for (const entry of validated.distribution) {
    last = entry;
    acc += entry.weight;
    if (u <= acc) return entry.archetype;
  }
  return last.archetype;
};

const pickColor = (validated: ValidatedLayer, rng: Rng): Rgb => {
  const palette = validated.palette;
  const index = Math.min(palette.length - 1, Math.floor(rng.next() * palette.length));
  let i = 0;
  for (const rgb of palette) {
    if (i === index) return rgb;
    i += 1;
  }
  return palette[0];
};

const archetypeFor = (kind: ArchetypeKind, archetypes: ArchetypeTable): FlightKind => {
  if (kind === 'comet_hero') return archetypes.comet_hero;
  if (kind === 'comet_distant') return archetypes.comet_distant;
  return archetypes.asteroid_drift;
};

// Forward-cap of half-angle acos(0.5) = 60° around cameraForward. 70% of
// flights land inside that cone (so most cross the player's visible frustum
// at some point in their arc); the other 30% sample uniformly on the full
// sphere so peripheral and behind-camera flights still appear and the sky
// doesn't feel scripted. Population mean of cos(theta_mid) is
// 0.7 * 0.75 + 0.3 * 0 = 0.525 — well above the geometric "in-front-of-camera"
// threshold of 0.
export const FORWARD_BIAS: ForwardBias = {
  capCosHalfAngle: 0.5,
  forwardProbability: 0.7,
};

// Initial-stagger factor: the maximum fraction of a flight's actual duration
// already elapsed when the schedule is built. 0.45 guarantees every flight
// has at least 55% of its arc + full tail-coast remaining on frame 1, so
// nothing pops out of existence within seconds of the scene loading.
export const INITIAL_STAGGER_FRACTION = 0.45;

export const composeFlight = (
  validated: ValidatedLayer,
  archetypes: ArchetypeTable,
  midpoint: Vec3,
  rng: Rng,
  id: number,
  nowReference: number,
  staggerFraction: number,
): Flight => {
  const layer = validated.source;
  const archetypeKind = pickArchetypeKind(validated, rng);
  const kind = archetypeFor(archetypeKind, archetypes);
  const color = pickColor(validated, rng);
  const duration = lerp(layer.durationMin, layer.durationMax, rng.next());
  const { p0, p2 } = pickArcAroundMidpoint(
    midpoint,
    layer.radius,
    layer.arcAngleMinRad,
    layer.arcAngleMaxRad,
    rng,
  );
  const p1 = pickRadialBulgeControlPoint(
    p0,
    p2,
    layer.radius,
    layer.bulgeMin,
    layer.bulgeMax,
    rng,
  );
  const startedAt = nowReference - duration * rng.next() * staggerFraction;
  const trailWidthScale = 0.55 + rng.next() * 0.8;
  // Cube power biases the distribution toward shorter trails so long streaks
  // are a rare visual event (~25% above baseline, ~5% truly dramatic).
  const trailLengthScale = 0.4 + Math.pow(rng.next(), 3) * 1.6;
  return {
    id,
    kind,
    layer: layer.kind,
    p0,
    p1,
    p2,
    duration,
    startedAt,
    color,
    trailWidthScale,
    trailLengthScale,
  };
};
