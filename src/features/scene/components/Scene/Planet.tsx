import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import type { Object3D } from 'three';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetRole } from '../../types/planet-role';
import {
  buildVisualPlan,
  cloneAndDress,
  extractBody,
  rotationRateFor,
} from '../../services/renderer/planetVisualPlan';
import type { BodyExtraction, PlanetVisualPlan } from '../../services/renderer/planetTypes';
import { planetCollider } from '../../services/renderer/planetCollider';
import { animatePlan } from '../../services/renderer/planetAnimation';
import {
  COLORSHEET_PATH,
  PLANET_PATHS,
  configureColorsheet,
  resolvePlanetLook,
} from '../../services/renderer/planetAssets';
import { planetPoseFor } from '../../services/renderer/planetPose';
import type { PlanetPose } from '../../services/renderer/planetPose';
import type { CompanyInfo } from '../../types/company-info';
import type { PlanetActivations, PlanetRadii, SphereColliders } from '../../types/scene-refs';

// Component-local wiring shape — pairs the pure PlanetRole with the React refs
// that only 'active' planets need plus the descriptor data the planet pushes
// into the proximity registry. Lives next to the component that consumes it;
// `types/` stays data-only (Iron Law 1, no framework leak into `types/`).
// The discriminant matches PlanetRole's so the wiring IS a structural
// superset — same domain shape, plus refs and target descriptor on the
// 'active' branch.
type PlanetWiring =
  | (Extract<PlanetRole, { kind: 'active' }> & {
      readonly info: CompanyInfo;
      readonly placement: readonly [number, number, number];
      readonly planetRadiiRef: RefObject<PlanetRadii>;
      readonly planetActivationsRef: RefObject<PlanetActivations>;
    })
  | Extract<PlanetRole, { kind: 'filler' }>;

type PlanetProps = {
  readonly assetId: PlanetAssetId;
  readonly placement: readonly [number, number, number];
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly wiring: PlanetWiring;
};

export type { PlanetWiring };

const PLANET_BASE_SCALE = 1.5;
const PLANET_SWAY_AMPLITUDE = Math.PI / 220;
const PLANET_SWAY_FREQ_HZ = 0.05;
const SCALE_BREATH_AMP = 0.025;
const SCALE_BREATH_FREQ_HZ = 0.05;
const ACTIVATION_LERP_RATE = 4.0;
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
  readonly extraction: BodyExtraction;
};

const deriveBodyValues = (scene: Object3D): BodyDerivations => {
  const extraction = extractBody(scene);
  const pose = planetPoseFor(extraction);
  if (extraction.kind === 'no_body') return { activeRadius: 0, pose, extraction };
  const activeRadius = extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
  return { activeRadius, pose, extraction };
};

const usePlanetFrame = (
  wiring: PlanetWiring,
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
    const target =
      wiring.kind === 'active' && wiring.planetActivationsRef.current.isActive(wiring.id) ? 1 : 0;
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
  const { scene } = useGLTF(PLANET_PATHS[props.assetId]);
  const colorsheet = useTexture(COLORSHEET_PATH);
  const look = useMemo(() => resolvePlanetLook(props.assetId), [props.assetId]);
  const phase = useMemo(() => phaseFromId(props.wiring.id), [props.wiring.id]);
  const plan = useMemo<PlanetVisualPlan>(() => {
    configureColorsheet(colorsheet);
    return buildVisualPlan(look, cloneAndDress(scene, colorsheet, look), phase);
  }, [scene, colorsheet, look, phase]);
  const derived = useMemo(() => deriveBodyValues(scene), [scene]);
  if (props.wiring.kind === 'active') {
    const cell = props.wiring.planetRadiiRef.current.attach(
      props.wiring.id,
      props.wiring.info,
      props.wiring.placement,
    );
    cell.value = derived.activeRadius;
  }
  props.sphereCollidersRef.current.register(
    props.wiring.id,
    planetCollider(derived.extraction, props.placement, PLANET_BASE_SCALE),
  );
  const meshRef = useRef<Object3D | null>(null);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);

  usePlanetFrame(props.wiring, plan, meshRef, phase, rotationRate);

  return (
    <group position={props.placement}>
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
