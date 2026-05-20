import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import type { Object3D } from 'three';
import type { PlanetProjection } from '../../types/projections';
import {
  buildVisualPlan,
  cloneAndDress,
  extractBody,
  rotationRateFor,
} from '../../services/renderer/planetVisualPlan';
import type { PlanetVisualPlan, RingNormalAxis } from '../../services/renderer/planetTypes';
import { animatePlan } from '../../services/renderer/planetAnimation';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import type { PlanetActivations, PlanetRadii } from './useSceneRefs';

type PlanetProps = {
  readonly planet: PlanetProjection;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
};

const PLANET_BASE_SCALE = 1.5;
// Axial tilt applied as the final pose offset after the ring plane is rotated
// to horizontal. Direction of tilt is around local X.
const AXIAL_TILT_RAD = 0;
// Quarter-turn used to swing a vertical ring disc onto the horizontal plane
// before the axial tilt is layered on top.
const QUARTER_TURN = Math.PI / 2;
// Barely-perceptible sway, phase-offset per CompanyId so the five planets
// don't sway in unison.
const PLANET_SWAY_AMPLITUDE = Math.PI / 220;
const PLANET_SWAY_FREQ_HZ = 0.05;
// Volumetric breath — ~2.5% scale oscillation, slow. Only applies in active
// mode; idle planets hold their static scale. Phase-offset per planet so
// the ring doesn't breathe in unison.
const SCALE_BREATH_AMP = 0.025;
const SCALE_BREATH_FREQ_HZ = 0.05;
// Exponential smoothing rate for the activation fade. 1/rate ≈ 0.25 s time
// constant — proximity enter/exit translates to a smooth ~0.5 s ramp on the
// rim and scale-breath effects.
const ACTIVATION_LERP_RATE = 4.0;
// Active-radius multiplier on each planet's visible body radius. 2.5× visible
// radius = ~1.25× visible diameter, so the rim lights up about half a planet-
// diameter before the player reaches the surface.
const ACTIVATION_RADIUS_MULTIPLIER = 2.5;
const TWO_PI = Math.PI * 2;

const idEncoder = new TextEncoder();
const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

type BodyDerivations = {
  readonly activeRadius: number;
  readonly tiltEuler: readonly [number, number, number];
};

// Maps the auto-detected ring normal axis to the (rx, ry, rz) pose that puts
// the ring plane horizontal and adds the ~20° Saturn-style axial tilt.
// - 'y': ring already in local XZ plane → only tilt around X.
// - 'z': ring in local XY (normal toward viewer) → rotate +π/2 around X so
//   the normal points up, then tilt the result by 20° around X.
// - 'x': ring in local YZ (normal sideways) → rotate +π/2 around Z so the
//   normal points up, then tilt by 20° around X.
const tiltEulerFor = (
  axis: RingNormalAxis,
): readonly [number, number, number] => {
  if (axis === 'y') return [AXIAL_TILT_RAD, 0, 0];
  if (axis === 'z') return [QUARTER_TURN - AXIAL_TILT_RAD, 0, 0];
  return [AXIAL_TILT_RAD, 0, QUARTER_TURN];
};

const deriveBodyValues = (scene: Object3D): BodyDerivations => {
  const extraction = extractBody(scene);
  if (extraction.kind === 'no_body') return { activeRadius: 0, tiltEuler: [0, 0, 0] };
  const activeRadius =
    extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
  const tiltEuler: readonly [number, number, number] =
    extraction.kind === 'ringed_body' ? tiltEulerFor(extraction.ringNormalAxis) : [0, 0, 0];
  return { activeRadius, tiltEuler };
};

const usePlanetFrame = (
  props: PlanetProps,
  plan: PlanetVisualPlan,
  meshRef: RefObject<Object3D | null>,
  phase: number,
  rotationRate: number,
): void => {
  const activationFactorRef = useRef(0);
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh === null) return;
    mesh.rotation.y += rotationRate * delta;
    const time = state.clock.elapsedTime;
    mesh.rotation.z =
      Math.sin(time * PLANET_SWAY_FREQ_HZ * TWO_PI + phase * 1.3) * PLANET_SWAY_AMPLITUDE;
    const target = props.planetActivationsRef.current.isActive(props.planet.id) ? 1 : 0;
    const current = activationFactorRef.current;
    const blend = 1 - Math.exp(-ACTIVATION_LERP_RATE * delta);
    const factor = current + (target - current) * blend;
    activationFactorRef.current = factor;
    const scaleBreath = Math.sin(time * SCALE_BREATH_FREQ_HZ * TWO_PI + phase * 0.7);
    const s = PLANET_BASE_SCALE * (1 + scaleBreath * SCALE_BREATH_AMP * factor);
    mesh.scale.set(s, s, s);
    animatePlan(plan, time, phase, factor);
  });
};

export const Planet = (props: PlanetProps): JSX.Element => {
  const assetId = props.planet.planet.assetId;
  const { scene } = useGLTF(PLANET_PATHS[assetId]);
  const colorsheet = useTexture(COLORSHEET_PATH);
  const look = useMemo(() => resolvePlanetLook(assetId), [assetId]);
  const phase = useMemo(() => phaseFromId(props.planet.id), [props.planet.id]);
  const plan = useMemo<PlanetVisualPlan>(() => {
    configureColorsheet(colorsheet);
    return buildVisualPlan(look, cloneAndDress(scene, colorsheet, look), phase);
  }, [scene, colorsheet, look, phase]);
  const derived = useMemo(() => deriveBodyValues(scene), [scene]);
  props.planetRadiiRef.current.write(props.planet.id, derived.activeRadius);
  const meshRef = useRef<Object3D | null>(null);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);

  usePlanetFrame(props, plan, meshRef, phase, rotationRate);

  return (
    <group position={props.planet.planet.placement}>
      <group rotation={derived.tiltEuler}>
        <group ref={meshRef}>
          <Center>
            <primitive object={plan.scene} />
          </Center>
        </group>
      </group>
    </group>
  );
};

useTexture.preload(COLORSHEET_PATH);
for (const path of Object.values(PLANET_PATHS)) useGLTF.preload(path);
