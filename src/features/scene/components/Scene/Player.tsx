import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, Trail, useGLTF } from '@react-three/drei';
import type { Group, Material, Mesh, Object3D, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
import { assetUrl } from '@/lib/assetUrl';
import { clampToColliders } from '../../services/renderer/clampToColliders';
import { integrateMotion } from '../../services/renderer/integrateMotion';
import type { CameraBasis } from '../../services/renderer/integrateMotion';
import type { Sphere } from '../../types/sphere';
import { createBoostController } from '../../services/renderer/boostController';
import { createOrientationController } from '../../services/renderer/orientationController';
import { parseTrailMaterial } from '../../services/renderer/parseTrailMaterial';
import { deriveBasis, integratesIn } from '../../services/renderer/shipFrame';
import { cloneAndDressShip } from '../../services/renderer/shipVisualPlan';
import type { CompanyId } from '../../types/company';
import { INITIAL_KINEMATICS, type Kinematics } from '../../types/kinematics';
import type { Intent, IntentStream } from '../../types/intent';
import type { SceneState } from '../../types/scene-state';
import type { ShipEntry } from '../../../ships/types/ship';
import { ShipRig } from './ShipRig';
import type { BoostSignal, PlanetActivations, SphereColliders } from '../../types/scene-refs';

type PlayerProps = {
  readonly ship: ShipEntry;
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly boostSignalRef: RefObject<BoostSignal>;
};

// Engine trail — two stacked Trails cross-faded by the smoothed boost factor.
// 'base' (cyan) reads "engaged but cruising"; 'boost' (pale cyan) reads
// "burst". drei applies lineWidth = 0.1 * variant.width; buffer holds
// variant.length * 10 samples; at TRAIL_DECAY=1 and 60fps, the longer boost
// trail covers ~1.33s of history (~18.6 world units at MAX_SPEED * 3).
// decay > 1 writes the same sample N times per frame (Trail.js:52) which
// causes visible banding at thick widths — keep decay = 1. Attenuation
// pinches the tail.
type TrailRole = 'base' | 'boost';

type TrailVariant = {
  readonly role: TrailRole;
  readonly color: string;
  readonly width: number;
  readonly length: number;
  readonly initialOpacity: 0 | 1;
};

const TRAIL_VARIANTS: readonly [TrailVariant, TrailVariant] = [
  { role: 'base', color: '#5fd6ff', width: 6, length: 4, initialOpacity: 1 },
  { role: 'boost', color: '#aeefff', width: 8, length: 8, initialOpacity: 0 },
] as const;

const TAIL_OFFSET_Z = 0.75;
const TRAIL_DECAY = 1;
const TRAIL_ATTENUATION = (t: number): number => t * t;

// Trail represents engine exhaust — visible only while a directional thrust
// intent is held. Without this gate drei's buffer keeps drawing ~1.3s of
// stale samples after the player releases keys, producing the lingering
// flicker behind a stopped ship.
const THRUST_INTENTS: readonly Intent['kind'][] = [
  'move_forward',
  'move_backward',
  'strafe_left',
  'strafe_right',
];

const isThrusting = (intents: ReadonlySet<Intent['kind']>): boolean => {
  for (const kind of THRUST_INTENTS) {
    if (intents.has(kind)) return true;
  }
  return false;
};

// Cross-fade by role: 'base' fades out as boost ramps in; 'boost' fades in
// as boost ramps in. Sum stays at 1 so the visual brightness is constant.
const opacityFor = (role: TrailRole, factor: number): number =>
  role === 'base' ? 1 - factor : factor;

type TrailMaterialSlot = RefObject<Material | null>;
type TrailMaterials = { readonly [R in TrailRole]: TrailMaterialSlot };

// Capture-callback for drei's Trail ref. drei forwards a Mesh ref; we
// keep the Mesh's material handle so the frame loop can drive opacity by
// role. Side-effects (transparent / depthWrite / initialOpacity) are
// written once at capture time.
const writeTrailMaterial =
  (slot: TrailMaterialSlot, variant: TrailVariant) =>
  (mesh: Mesh | null): void => {
    if (mesh === null) {
      slot.current = null;
      return;
    }
    const mat = parseTrailMaterial(mesh);
    mat.transparent = true;
    mat.opacity = variant.initialOpacity;
    mat.depthWrite = false;
    slot.current = mat;
  };

const writeTrailOpacities = (
  mats: TrailMaterials,
  factor: number,
  thrusting: boolean,
): void => {
  for (const variant of TRAIL_VARIANTS) {
    const mat = mats[variant.role].current;
    if (mat === null) continue;
    mat.opacity = thrusting ? opacityFor(variant.role, factor) : 0;
  }
};

type Scratch = {
  readonly cameraWorldDir: Vector3Impl;
  readonly forward: Vector3Impl;
  readonly right: Vector3Impl;
  readonly up: Vector3Impl;
};

const createScratch = (): Scratch => ({
  cameraWorldDir: new Vector3(),
  forward: new Vector3(),
  right: new Vector3(),
  up: new Vector3(0, 1, 0),
});

// Integrate one frame and clamp the result out of registered collider
// spheres. Identity short-circuit (same reference) avoids reallocating the
// Kinematics object when no collider clamp was needed.
const stepKinematics = (
  current: Kinematics,
  intents: IntentStream,
  basis: CameraBasis,
  multiplier: 1 | 3,
  delta: number,
  colliders: ReadonlyArray<Sphere>,
): Kinematics => {
  const integrated = integrateMotion(current, intents.current, delta, basis, multiplier);
  const clampedPosition = clampToColliders(integrated.position, colliders);
  if (clampedPosition === integrated.position) return integrated;
  return { ...integrated, position: clampedPosition };
};

// Per-frame edge: true on the first frame where any planet id appears in
// the current activation snapshot that was absent from the previous frame.
// Steady-state proximity returns false; only the entry transition fires.
const detectNewPlanetEntry = (
  current: ReadonlySet<CompanyId>,
  previous: ReadonlySet<CompanyId>,
): boolean => {
  for (const id of current) {
    if (!previous.has(id)) return true;
  }
  return false;
};

const usePlayerFrame = (
  props: PlayerProps,
  visualRef: RefObject<Group | null>,
  trailMats: TrailMaterials,
): void => {
  const camera = useThree((three) => three.camera);
  const scratch = useMemo<Scratch>(createScratch, []);
  const boostController = useMemo(
    () => createBoostController(props.boostSignalRef.current),
    [props.boostSignalRef],
  );
  const orientationController = useMemo(() => createOrientationController(), []);
  const prevActivationsRef = useRef<ReadonlySet<CompanyId>>(new Set<CompanyId>());

  useFrame((state, delta) => {
    if (!integratesIn(props.sceneState)) return;
    const mesh = props.meshRef.current;
    if (mesh === null) return;

    const boostHeld = props.intents.current.has('boost');
    const currentActivations = props.planetActivationsRef.current.snapshot();
    const newPlanetEntry = detectNewPlanetEntry(currentActivations, prevActivationsRef.current);
    prevActivationsRef.current = currentActivations;
    const boost = boostController.tick(boostHeld, newPlanetEntry, delta);

    camera.getWorldDirection(scratch.cameraWorldDir);
    const basis = deriveBasis(scratch.cameraWorldDir, scratch.forward, scratch.right, scratch.up);

    const next = stepKinematics(
      props.kinematicsRef.current,
      props.intents,
      basis,
      boost.multiplier,
      delta,
      props.sphereCollidersRef.current.list(),
    );
    props.kinematicsRef.current = next;

    orientationController.tick(mesh, visualRef.current, next, basis, state.clock.elapsedTime);
    writeTrailOpacities(trailMats, boost.factor, isThrusting(props.intents.current));
  });
};

export const Player = (props: PlayerProps): JSX.Element => {
  const { scene } = useGLTF(assetUrl(props.ship.glbPath));
  const dressed = useMemo(() => cloneAndDressShip(scene), [scene]);
  const shipScale = useMemo<readonly [number, number, number]>(
    () => [props.ship.scale, props.ship.scale, props.ship.scale],
    [props.ship.scale],
  );
  const visualRef = useRef<Group | null>(null);
  const baseSlot = useRef<Material | null>(null);
  const boostSlot = useRef<Material | null>(null);
  const trailMats = useMemo<TrailMaterials>(() => ({ base: baseSlot, boost: boostSlot }), []);
  usePlayerFrame(props, visualRef, trailMats);
  return (
    <group ref={props.meshRef} scale={shipScale} rotation={[0, INITIAL_KINEMATICS.heading, 0, 'YXZ']}>
      {/* Rig sits outside the 180° flip so key/fill/rim stay in ship-world axes. */}
      <ShipRig />
      <group ref={visualRef}>
        <group rotation={[0, Math.PI, 0]}>
          <Center>
            <primitive object={dressed.scene} />
          </Center>
        </group>
      </group>
      <group rotation={[0, Math.PI, 0]}>
        {TRAIL_VARIANTS.map((variant) => (
          <Trail
            key={variant.role}
            width={variant.width}
            length={variant.length}
            color={variant.color}
            decay={TRAIL_DECAY}
            attenuation={TRAIL_ATTENUATION}
            ref={writeTrailMaterial(trailMats[variant.role], variant)}
          >
            <group position={[0, 0, TAIL_OFFSET_Z]} />
          </Trail>
        ))}
      </group>
    </group>
  );
};
