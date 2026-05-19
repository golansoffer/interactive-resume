import type { JSX, RefObject } from 'react';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Center, useGLTF } from '@react-three/drei';
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

// Idle motion — sine oscillations gated by (1 - speedRatio); full at rest, zero at top speed.
// Two distinct frequencies so bob and sway never lock into a single rhythm.
const IDLE_BOB_AMPLITUDE = 0.15;
const IDLE_BOB_FREQ_HZ = 0.7;
const IDLE_SWAY_AMPLITUDE = Math.PI / 100;
const IDLE_SWAY_FREQ_HZ = 0.45;

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
  const idleRatio = 1 - speedRatio;
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

export const Player = (props: PlayerProps): JSX.Element => {
  const { scene } = useGLTF(SHIP_PATH);
  const camera = useThree((three) => three.camera);
  const cameraWorldDir = useMemo(() => new Vector3(), []);
  const forwardScratch = useMemo(() => new Vector3(), []);
  const rightScratch = useMemo(() => new Vector3(), []);
  const upScratch = useMemo(() => new Vector3(0, 1, 0), []);
  // Baselines tracked separately from the rendered rotation so the sway
  // oscillation cannot decay into the lerp state.
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

    const target = computeRotationTargets(next.velocity, basis);
    baselinePitch.current += (target.pitch - baselinePitch.current) * ORIENT_LERP;
    baselineRoll.current += (target.roll - baselineRoll.current) * ORIENT_LERP;
    mesh.rotation.x = baselinePitch.current;
    mesh.rotation.z = baselineRoll.current + idle.swayZ;
  });

  return (
    <group ref={props.meshRef} scale={SHIP_SCALE}>
      <group rotation={[0, Math.PI, 0]}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
};

useGLTF.preload(SHIP_PATH);
