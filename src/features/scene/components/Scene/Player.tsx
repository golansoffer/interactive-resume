import type { JSX, RefObject } from 'react';
import { useMemo } from 'react';
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
// MAX_PITCH ≈ 15° nose-down at full forward thrust.
const MAX_PITCH = Math.PI / 12;
// MAX_ROLL ≈ 30° wing-dip at full strafe.
const MAX_ROLL = Math.PI / 6;
// ORIENT_LERP — ~150ms time-to-target; snappy but smooth.
const ORIENT_LERP = 0.18;

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

export const Player = (props: PlayerProps): JSX.Element => {
  const { scene } = useGLTF(SHIP_PATH);
  const camera = useThree((three) => three.camera);
  const cameraWorldDir = useMemo(() => new Vector3(), []);
  const forwardScratch = useMemo(() => new Vector3(), []);
  const rightScratch = useMemo(() => new Vector3(), []);
  const upScratch = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_root, delta) => {
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
    mesh.position.set(next.position.x, next.position.y, next.position.z);

    const forwardSpeed = next.velocity.x * basis.forward.x + next.velocity.z * basis.forward.z;
    const rightSpeed = next.velocity.x * basis.right.x + next.velocity.z * basis.right.z;
    const targetPitch = -(forwardSpeed / MAX_SPEED) * MAX_PITCH;
    const targetRoll = -(rightSpeed / MAX_SPEED) * MAX_ROLL;
    mesh.rotation.x += (targetPitch - mesh.rotation.x) * ORIENT_LERP;
    mesh.rotation.z += (targetRoll - mesh.rotation.z) * ORIENT_LERP;
  });

  return (
    <group ref={props.meshRef} scale={SHIP_SCALE}>
      <Center>
        <primitive object={scene} />
      </Center>
    </group>
  );
};

useGLTF.preload(SHIP_PATH);
