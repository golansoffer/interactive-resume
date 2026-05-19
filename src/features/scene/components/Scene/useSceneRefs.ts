import type { RefObject } from 'react';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type { Kinematics } from '../../services/renderer/integrateMotion';

type SceneRefs = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
};

const INITIAL_KINEMATICS: Kinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
};

export const useSceneRefs = (): SceneRefs => {
  const kinematicsRef = useRef<Kinematics>(INITIAL_KINEMATICS);
  const meshRef = useRef<Object3D | null>(null);
  return { kinematicsRef, meshRef };
};

export type { SceneRefs };
