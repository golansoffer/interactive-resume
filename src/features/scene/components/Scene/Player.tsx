import type { JSX, RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import { integrateMotion } from '../../services/renderer/integrateMotion';
import type { Kinematics } from '../../services/renderer/integrateMotion';
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

const integratesIn = (state: SceneState): boolean =>
  state.kind === 'playing' || state.kind === 'revealing';

export const Player = (props: PlayerProps): JSX.Element => {
  useFrame((_root, delta) => {
    if (!integratesIn(props.sceneState)) return;
    const mesh = props.meshRef.current;
    if (mesh === null) return;
    const next = integrateMotion(
      props.kinematicsRef.current,
      props.intents.current,
      delta,
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
