import type { JSX } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import {
  buildFlightSchedule,
  defaultArchetypes,
  defaultLayers,
  recycleCompletedFlights,
} from '../../services/renderer/celestialFlightSpec';
import type { DepthLayer, LayerKind, Vec3 } from '../../types/celestial-flight';
import { INITIAL_KINEMATICS } from '../../types/kinematics';
import { CelestialFlight } from './CelestialFlight';

const FLIGHT_SEED = 0xc0ffee;

const ROOT_RENDER_ORDER = -0.5;

// Convention matches applyHeadingLerp in shipFrame: targetHeading =
// atan2(vx, vz), so the forward unit vector for a given heading is
// [sin(h), 0, cos(h)].
const forwardFromHeading = (heading: number): Vec3 => [
  Math.sin(heading),
  0,
  Math.cos(heading),
];

const INITIAL_CAMERA_FORWARD: Vec3 = forwardFromHeading(INITIAL_KINEMATICS.heading);

type LayerTable = {
  readonly background: DepthLayer;
  readonly midground: DepthLayer;
};

const buildLayerTable = (layers: ReadonlyArray<DepthLayer>): LayerTable => {
  let background: DepthLayer | null = null;
  let midground: DepthLayer | null = null;
  for (const layer of layers) {
    if (layer.kind === 'background') background = layer;
    else midground = layer;
  }
  if (background === null || midground === null) {
    throw new Error(
      'CelestialTraffic: layers must include exactly one of background, midground',
    );
  }
  return { background, midground };
};

const layerOf = (table: LayerTable, kind: LayerKind): DepthLayer => {
  if (kind === 'background') return table.background;
  return table.midground;
};

const initRootGroup = (g: Group | null): void => {
  if (g === null) return;
  g.frustumCulled = false;
  g.raycast = () => null;
  g.renderOrder = ROOT_RENDER_ORDER;
};

export const CelestialTraffic = (): JSX.Element => {
  const layers = useMemo(defaultLayers, []);
  const archetypes = useMemo(defaultArchetypes, []);
  const layerTable = useMemo(() => buildLayerTable(layers), [layers]);

  const initialSchedule = useMemo(
    () =>
      buildFlightSchedule({
        seed: FLIGHT_SEED,
        layers,
        archetypes,
        now: 0,
        cameraForward: INITIAL_CAMERA_FORWARD,
      }),
    [layers, archetypes],
  );

  const [schedule, setSchedule] = useState(initialSchedule);
  const cameraForwardScratch = useRef<Vector3>(new Vector3());

  useFrame((state) => {
    const scratch = cameraForwardScratch.current;
    state.camera.getWorldDirection(scratch);
    const cameraForward: Vec3 = [scratch.x, scratch.y, scratch.z];
    const next = recycleCompletedFlights(
      schedule,
      state.clock.elapsedTime,
      archetypes,
      cameraForward,
    );
    if (next !== schedule) setSchedule(next);
  });

  return (
    <group ref={initRootGroup}>
      {schedule.flights.map((flight) => (
        <CelestialFlight
          key={flight.id}
          flight={flight}
          layer={layerOf(layerTable, flight.layer)}
        />
      ))}
    </group>
  );
};
