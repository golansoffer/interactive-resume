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
import type { PlanetVisualPlan } from '../../services/renderer/planetTypes';
import { animatePlan } from '../../services/renderer/planetAnimation';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import { planetPoseFor } from '../../services/renderer/planetPose';
import type { PlanetPose } from '../../services/renderer/planetPose';
import type { PlanetActivations, PlanetRadii } from './useSceneRefs';

type PlanetProps = {
  readonly planet: PlanetProjection;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
};

const PLANET_BASE_SCALE = 1.5;
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
// Active-radius multiplier on each planet's visible body radius. With body
// radius now computed as min(dx,dy,dz)/2 — the true ring-normal half-thickness
// for merged ringed bodies — this lands the activation zone at ~32 world
// units from each planet's center (calibrated against Mars's feel),
// consistent across spherical and ringed planets where the old loose
// half-diagonal sphere radius inflated Saturn and Uranus by 1.6×–2×.
const ACTIVATION_RADIUS_MULTIPLIER = 4.5;
const TWO_PI = Math.PI * 2;

const idEncoder = new TextEncoder();
const phaseFromId = (id: string): number => {
  let hash = 0;
  for (const byte of idEncoder.encode(id)) hash = (hash * 31 + byte) % 1000;
  return (hash / 1000) * TWO_PI;
};

type BodyDerivations = {
  readonly activeRadius: number;
  readonly pose: PlanetPose;
};

const deriveBodyValues = (scene: Object3D): BodyDerivations => {
  const extraction = extractBody(scene);
  const pose = planetPoseFor(extraction);
  if (extraction.kind === 'no_body') return { activeRadius: 0, pose };
  const activeRadius = extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
  return { activeRadius, pose };
};

// The alignment quaternion (inner group) puts the model's visual pole on
// world +y, so spin is always around world y and sway around world x — both
// from the outer group's perspective, which is unrotated (its parent is a
// position-only group).
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
    mesh.rotation.x =
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
      <group ref={meshRef}>
        <group quaternion={derived.pose.alignQuaternion}>
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
