import type { RefObject } from 'react';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type {
  BoostSignal,
  PlanetActivations,
  PlanetRadii,
  SphereColliders,
} from '../../types/scene-refs';
import { createBoostSignal } from '../../services/registries/boostSignal';
import { createPlanetActivations } from '../../services/registries/planetActivations';
import { createPlanetRadii } from '../../services/registries/planetRadii';
import { createSphereColliders } from '../../services/registries/sphereColliders';

type SceneRefs = {
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sphereCollidersRef: RefObject<SphereColliders>;
  readonly boostSignalRef: RefObject<BoostSignal>;
};

export const useSceneRefs = (): SceneRefs => {
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  const sphereCollidersRef = useRef<SphereColliders>(createSphereColliders());
  const boostSignalRef = useRef<BoostSignal>(createBoostSignal());
  return { meshRef, planetRadiiRef, planetActivationsRef, sphereCollidersRef, boostSignalRef };
};

export type { SceneRefs };
