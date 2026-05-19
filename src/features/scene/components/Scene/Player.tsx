import type { JSX, RefObject } from 'react';
import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Mesh, Vector3 as Vector3Impl } from 'three';
import { Vector3 } from 'three';
import { integrateMotion } from '../../services/renderer/integrateMotion';
import type { CameraBasis, Kinematics } from '../../services/renderer/integrateMotion';
import type { IntentStream } from '../../types/intent';
import type { SceneState } from '../../types/scene-state';

type PlayerProps = {
  readonly sceneState: SceneState;
  readonly intents: IntentStream;
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Mesh | null>;
};

const PLAYER_RADIUS = 0.5;
const PLAYER_COLOR = '#5cf0ff';
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
    mesh.rotation.y = next.heading;
  });

  return (
    <mesh ref={props.meshRef}>
      <sphereGeometry args={[PLAYER_RADIUS, 24, 16]} />
      <meshStandardMaterial color={PLAYER_COLOR} emissive={PLAYER_COLOR} emissiveIntensity={0.3} />
    </mesh>
  );
};
