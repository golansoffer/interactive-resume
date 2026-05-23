import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, useGLTF, useTexture } from '@react-three/drei';
import type { Object3D } from 'three';
import { assetUrl } from '@/lib/assetUrl';
import type { PlanetAssetId } from '../../types/planet';
import type { PlanetRole } from '../../types/planet-role';
import type { SatelliteSpec } from '../../types/satellite';
import { rotationRateFor } from '../../services/renderer/planetVisualPlan';
import type { BodyExtraction, PlanetVisualPlan } from '../../services/renderer/planetTypes';
import { planetCollider } from '../../services/renderer/planetCollider';
import { animatePlan } from '../../services/renderer/planetAnimation';
import { COLORSHEET_PATH, PLANET_PATHS } from '../../services/renderer/planetAssets';
import { phaseFromId } from '../../services/renderer/phaseFromId';
import { PLANET_BASE_SCALE } from '../../services/renderer/planetScale';
import type { CompanyInfo } from '../../types/company-info';
import type { PlanetActivations, PlanetRadii, SphereColliders } from '../../types/scene-refs';
import { usePlanetVisual } from './usePlanetVisual';
import { Satellite } from './Satellite';

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
  readonly satellites: ReadonlyArray<SatelliteSpec>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly wiring: PlanetWiring;
};

export type { PlanetWiring };

const PLANET_SWAY_AMPLITUDE = Math.PI / 220;
const PLANET_SWAY_FREQ_HZ = 0.05;
const SCALE_BREATH_AMP = 0.025;
const SCALE_BREATH_FREQ_HZ = 0.05;
const ACTIVATION_LERP_RATE = 4.0;
const ACTIVATION_RADIUS_MULTIPLIER = 6.0;
const TWO_PI = Math.PI * 2;

const activeRadiusFor = (extraction: BodyExtraction): number => {
  if (extraction.kind === 'no_body') return 0;
  return extraction.radius * PLANET_BASE_SCALE * ACTIVATION_RADIUS_MULTIPLIER;
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
  const phase = useMemo(() => phaseFromId(props.wiring.id), [props.wiring.id]);
  const { plan, pose, extraction } = usePlanetVisual(props.assetId, phase);
  if (props.wiring.kind === 'active') {
    const cell = props.wiring.planetRadiiRef.current.attach(
      props.wiring.id,
      props.wiring.info,
      props.wiring.placement,
    );
    cell.value = activeRadiusFor(extraction);
  }
  props.sphereCollidersRef.current.register(
    props.wiring.id,
    planetCollider(extraction, props.placement, PLANET_BASE_SCALE),
  );
  const meshRef = useRef<Object3D | null>(null);
  const rotationRate = useMemo(() => rotationRateFor(phase), [phase]);

  usePlanetFrame(props.wiring, plan, meshRef, phase, rotationRate);

  return (
    <group position={props.placement}>
      <group ref={meshRef}>
        <group quaternion={pose.alignQuaternion}>
          <Center>
            <primitive object={plan.scene} />
          </Center>
        </group>
      </group>
      {props.satellites.map((spec) => (
        <Satellite key={spec.id} spec={spec} />
      ))}
    </group>
  );
};

useTexture.preload(assetUrl(COLORSHEET_PATH));
for (const path of Object.values(PLANET_PATHS)) useGLTF.preload(assetUrl(path));
