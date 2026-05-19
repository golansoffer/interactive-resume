import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, Trail, useGLTF } from '@react-three/drei';
import type { Object3D, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
import { integrateMotion, MAX_SPEED } from '../../services/renderer/integrateMotion';
import type { CameraBasis, Kinematics } from '../../services/renderer/integrateMotion';
import type { IntentStream } from '../../types/intent';
import type { SceneState } from '../../types/scene-state';

type PlayerProps = {
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
};

const SHIP_PATH = '/models/kenney-space-kit/craft_speederA.glb';
const SHIP_SCALE: readonly [number, number, number] = [0.6, 0.6, 0.6];

// Visual feel — banking and pitch derived from velocity in the camera basis.
// Heading is held at the JSX-set base yaw (no input-driven yaw — camera-relative motion).
// MAX_PITCH ≈ 12° nose-down at full forward thrust.
const MAX_PITCH = Math.PI / 15;
// MAX_ROLL ≈ 26° wing-dip at full strafe.
const MAX_ROLL = Math.PI / 7;
// ORIENT_LERP — ~300ms time-to-target; floaty and weighty.
const ORIENT_LERP = 0.1;

// Engine trail — cyan wake behind the speeder. Anchored to TAIL_OFFSET_Z
// inside the flip group so heading lerp carries the trail along.
// drei applies lineWidth = 0.1 * TRAIL_WIDTH; buffer holds TRAIL_LENGTH * 10
// samples; at TRAIL_DECAY=1 and 60fps, ~0.667s of history (~9.3 world units
// at MAX_SPEED). decay > 1 writes the same sample N times per frame
// (Trail.js:52), which is invisible at thin widths but causes visible
// banding/graininess at thick widths — keep decay = 1. Attenuation
// pinches the tail to a point.
const TAIL_OFFSET_Z = 0.4;
const TRAIL_WIDTH = 6.0;
const TRAIL_LENGTH = 4;
const TRAIL_COLOR = '#5fd6ff';
const TRAIL_DECAY = 1;
const TRAIL_ATTENUATION = (t: number): number => t * t;

// Idle motion — sine oscillations always present, scaled down with speed
// (see IDLE_RATIO_FLOOR in computeIdleMotion). The aircraft is the LIGHT
// object in the scene, so its flutter should always be visible — contrast
// against the heavier, slower-bobbing planets. Two distinct frequencies
// so bob and sway never lock into a single rhythm.
const IDLE_BOB_AMPLITUDE = 0.12;
const IDLE_BOB_FREQ_HZ = 0.85;
const IDLE_SWAY_AMPLITUDE = Math.PI / 110;
const IDLE_SWAY_FREQ_HZ = 0.55;
const IDLE_RATIO_FLOOR = 0.4;

// Velocity-derived heading — outer yaw lerps toward atan2(vx, vz) so the
// ship faces its motion direction on diagonal moves. Held below threshold
// to avoid jitter at near-zero speed.
const HEADING_LERP = 0.06;
const HEADING_THRESHOLD = 0.5;
const TWO_PI = Math.PI * 2;

const FORWARD_EPSILON = 1e-6;

const DEFAULT_BASIS: CameraBasis = {
  forward: { x: 0, y: 0, z: -1 },
  right: { x: 1, y: 0, z: 0 },
};

const integratesIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

const deriveBasis = (
  cameraForward: Vector3Impl,
  forwardScratch: Vector3Impl,
  rightScratch: Vector3Impl,
  upScratch: Vector3Impl,
): CameraBasis => {
  forwardScratch.copy(cameraForward);
  forwardScratch.y = 0;
  const forwardLength = forwardScratch.length();
  if (forwardLength < FORWARD_EPSILON) return DEFAULT_BASIS;
  forwardScratch.divideScalar(forwardLength);
  rightScratch.crossVectors(forwardScratch, upScratch);
  return {
    forward: { x: forwardScratch.x, y: forwardScratch.y, z: forwardScratch.z },
    right: { x: rightScratch.x, y: rightScratch.y, z: rightScratch.z },
  };
};

type IdleMotion = { readonly bobY: number; readonly swayZ: number };

const computeIdleMotion = (speedRatio: number, time: number): IdleMotion => {
  // Floor at IDLE_RATIO_FLOOR so the ship keeps fluttering during flight,
  // not just at rest. Lighter object = always-visible micro-motion.
  const idleRatio = IDLE_RATIO_FLOOR + (1 - IDLE_RATIO_FLOOR) * (1 - speedRatio);
  return {
    bobY: Math.sin(time * IDLE_BOB_FREQ_HZ * 2 * Math.PI) * IDLE_BOB_AMPLITUDE * idleRatio,
    swayZ: Math.sin(time * IDLE_SWAY_FREQ_HZ * 2 * Math.PI) * IDLE_SWAY_AMPLITUDE * idleRatio,
  };
};

type RotationTargets = { readonly pitch: number; readonly roll: number };

const computeRotationTargets = (
  velocity: { readonly x: number; readonly z: number },
  basis: CameraBasis,
): RotationTargets => {
  const forwardSpeed = velocity.x * basis.forward.x + velocity.z * basis.forward.z;
  const rightSpeed = velocity.x * basis.right.x + velocity.z * basis.right.z;
  return {
    pitch: -(forwardSpeed / MAX_SPEED) * MAX_PITCH,
    roll: -(rightSpeed / MAX_SPEED) * MAX_ROLL,
  };
};

const applyHeadingLerp = (
  mesh: Object3D,
  velocity: { readonly x: number; readonly z: number },
  speed: number,
): void => {
  if (speed <= HEADING_THRESHOLD) return;
  const targetHeading = Math.atan2(velocity.x, velocity.z);
  let headingDelta = targetHeading - mesh.rotation.y;
  while (headingDelta > Math.PI) {
    headingDelta -= TWO_PI;
  }
  while (headingDelta < -Math.PI) {
    headingDelta += TWO_PI;
  }
  mesh.rotation.y += headingDelta * HEADING_LERP;
};

const usePlayerFrame = (props: PlayerProps): void => {
  const camera = useThree((three) => three.camera);
  const cameraWorldDir = useMemo(() => new Vector3(), []);
  const forwardScratch = useMemo(() => new Vector3(), []);
  const rightScratch = useMemo(() => new Vector3(), []);
  const upScratch = useMemo(() => new Vector3(0, 1, 0), []);
  const baselinePitch = useRef(0);
  const baselineRoll = useRef(0);

  useFrame((state, delta) => {
    if (!integratesIn(props.sceneState)) return;
    const mesh = props.meshRef.current;
    if (mesh === null) return;
    camera.getWorldDirection(cameraWorldDir);
    const basis = deriveBasis(cameraWorldDir, forwardScratch, rightScratch, upScratch);
    const next = integrateMotion(
      props.kinematicsRef.current,
      props.intents.current,
      delta,
      basis,
    );
    props.kinematicsRef.current = next;

    const speed = Math.hypot(next.velocity.x, next.velocity.z);
    const speedRatio = speed === 0 ? 0 : Math.min(1, speed / MAX_SPEED);
    const idle = computeIdleMotion(speedRatio, state.clock.elapsedTime);
    mesh.position.set(next.position.x, next.position.y + idle.bobY, next.position.z);

    applyHeadingLerp(mesh, next.velocity, speed);

    const target = computeRotationTargets(next.velocity, basis);
    baselinePitch.current += (target.pitch - baselinePitch.current) * ORIENT_LERP;
    baselineRoll.current += (target.roll - baselineRoll.current) * ORIENT_LERP;
    mesh.rotation.x = baselinePitch.current;
    mesh.rotation.z = baselineRoll.current + idle.swayZ;
  });
};

export const Player = (props: PlayerProps): JSX.Element => {
  const { scene } = useGLTF(SHIP_PATH);
  usePlayerFrame(props);
  return (
    <group ref={props.meshRef} scale={SHIP_SCALE} rotation={[0, 0, 0, 'YXZ']}>
      <group rotation={[0, Math.PI, 0]}>
        <Center>
          <primitive object={scene} />
        </Center>
        <Trail
          width={TRAIL_WIDTH}
          length={TRAIL_LENGTH}
          color={TRAIL_COLOR}
          decay={TRAIL_DECAY}
          attenuation={TRAIL_ATTENUATION}
        >
          <group position={[0, 0, TAIL_OFFSET_Z]} />
        </Trail>
      </group>
    </group>
  );
};

useGLTF.preload(SHIP_PATH);
