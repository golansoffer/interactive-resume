import type {
  ArchetypeTable,
  DepthLayer,
  Flight,
  FlightSchedule,
  LayerKind,
  Rng,
  Vec3,
} from '../../types/celestial-flight';
import {
  FORWARD_BIAS,
  INITIAL_STAGGER_FRACTION,
  composeFlight,
  validateLayer,
  type ValidatedLayer,
} from './celestialFlightCompose';
import { defaultArchetypes, defaultLayers } from './celestialFlightDefaults';
import { midpointProxyOf, pickSeparatedMidpoint } from './celestialFlightMidpoint';

export { defaultArchetypes, defaultLayers };

const stepMulberry32 = (state: number): { readonly state: number; readonly value: number } => {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { state: next, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
};

type RngCell = { readonly rng: Rng; readonly readState: () => number };

const createRngCell = (seed: number): RngCell => {
  let state = seed | 0;
  const next = (): number => {
    const stepped = stepMulberry32(state);
    state = stepped.state;
    return stepped.value;
  };
  return { rng: { next }, readState: (): number => state };
};

export const mulberry32 = (seed: number): Rng => createRngCell(seed).rng;

export type BuildScheduleInput = {
  readonly seed: number;
  readonly layers: ReadonlyArray<DepthLayer>;
  readonly archetypes: ArchetypeTable;
  readonly now: number;
  readonly cameraForward: Vec3;
};

export const buildFlightSchedule = (input: BuildScheduleInput): FlightSchedule => {
  const validated = input.layers.map(validateLayer);
  const cell = createRngCell(input.seed);
  const flights: Flight[] = [];
  let nextId = 1;
  for (const layer of validated) {
    const layerMidpoints: Vec3[] = [];
    for (let i = 0; i < layer.source.capacity; i += 1) {
      const midpoint = pickSeparatedMidpoint(
        input.cameraForward,
        FORWARD_BIAS,
        layerMidpoints,
        cell.rng,
      );
      layerMidpoints.push(midpoint);
      flights.push(
        composeFlight(
          layer,
          input.archetypes,
          midpoint,
          cell.rng,
          nextId,
          input.now,
          INITIAL_STAGGER_FRACTION,
        ),
      );
      nextId += 1;
    }
  }
  return {
    kind: 'flight_schedule',
    seed: input.seed,
    rngState: cell.readState(),
    nextId,
    layers: input.layers,
    flights,
  };
};

const flightLifetimeEnd = (flight: Flight): number =>
  flight.startedAt + flight.duration + flight.kind.tailCoastSeconds;

type LayerWorkspace = {
  readonly validated: ValidatedLayer;
  readonly midpoints: Vec3[];
};

const lookupWorkspace = (
  workspaces: ReadonlyArray<LayerWorkspace>,
  layerKind: LayerKind,
): LayerWorkspace => {
  for (const candidate of workspaces) {
    if (candidate.validated.source.kind === layerKind) return candidate;
  }
  throw new Error(`celestial-flight: schedule references layer ${layerKind} not in layers`);
};

const buildSurvivorWorkspaces = (
  prev: FlightSchedule,
  now: number,
): ReadonlyArray<LayerWorkspace> => {
  const workspaces: LayerWorkspace[] = prev.layers.map((layer) => ({
    validated: validateLayer(layer),
    midpoints: [],
  }));
  for (const flight of prev.flights) {
    if (now >= flightLifetimeEnd(flight)) continue;
    const workspace = lookupWorkspace(workspaces, flight.layer);
    workspace.midpoints.push(midpointProxyOf(flight));
  }
  return workspaces;
};

export const recycleCompletedFlights = (
  prev: FlightSchedule,
  now: number,
  archetypes: ArchetypeTable,
  cameraForward: Vec3,
): FlightSchedule => {
  let hasCompletion = false;
  for (const flight of prev.flights) {
    if (now >= flightLifetimeEnd(flight)) {
      hasCompletion = true;
      break;
    }
  }
  if (!hasCompletion) return prev;
  const cell = createRngCell(prev.rngState);
  const workspaces = buildSurvivorWorkspaces(prev, now);
  const flights: Flight[] = [];
  let nextId = prev.nextId;
  for (const flight of prev.flights) {
    if (now < flightLifetimeEnd(flight)) {
      flights.push(flight);
      continue;
    }
    const workspace = lookupWorkspace(workspaces, flight.layer);
    const midpoint = pickSeparatedMidpoint(
      cameraForward,
      FORWARD_BIAS,
      workspace.midpoints,
      cell.rng,
    );
    workspace.midpoints.push(midpoint);
    // Recycled flights start fresh at `now` with no stagger — they enter the
    // sky head-on, not partway through their arc.
    flights.push(
      composeFlight(workspace.validated, archetypes, midpoint, cell.rng, nextId, now, 0),
    );
    nextId += 1;
  }
  return {
    kind: 'flight_schedule',
    seed: prev.seed,
    rngState: cell.readState(),
    nextId,
    layers: prev.layers,
    flights,
  };
};

export const parallaxAnchor = (camera: Vec3, parallaxFactor: number): Vec3 => [
  camera[0] * parallaxFactor,
  camera[1] * parallaxFactor,
  camera[2] * parallaxFactor,
];
