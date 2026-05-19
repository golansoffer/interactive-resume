import type { RefObject } from 'react';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type { Kinematics } from '../../services/renderer/integrateMotion';
import type { CompanyId } from '../../types/company';

// TotalMap-style proof-bearing registry for per-planet activation radii.
// `read` always returns `number` — the internal "not-yet-measured" case is
// folded into 0 inside the boundary, never surfacing as `number | undefined`.
// Callers never write lookup-shaped `??` or undefined-narrows at the call
// site (Iron Law 3, producer-reshape rule).
export type PlanetRadii = {
  readonly read: (id: CompanyId) => number;
  readonly write: (id: CompanyId, value: number) => void;
};

const createPlanetRadii = (): PlanetRadii => {
  const inner = new Map<CompanyId, number>();
  return {
    read: (id) => {
      const value = inner.get(id);
      if (value === undefined) return 0;
      return value;
    },
    write: (id, value) => {
      inner.set(id, value);
    },
  };
};

// Visual-activation registry — independent of the SceneMachine's single
// `revealing.objectId`. Each Planet asks "am I currently inside my own
// activation radius?" and the answer is a per-planet boolean, so multiple
// planets can be visually active at once if the player is within several
// activation radii simultaneously. ProximityWatcher publishes the current
// set every frame.
export type PlanetActivations = {
  readonly isActive: (id: CompanyId) => boolean;
  readonly publish: (active: ReadonlySet<CompanyId>) => void;
};

const createPlanetActivations = (): PlanetActivations => {
  let active: ReadonlySet<CompanyId> = new Set();
  return {
    isActive: (id) => active.has(id),
    publish: (next) => {
      active = next;
    },
  };
};

type SceneRefs = {
  readonly kinematicsRef: RefObject<Kinematics>;
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
};

const INITIAL_KINEMATICS: Kinematics = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  heading: 0,
};

export const useSceneRefs = (): SceneRefs => {
  const kinematicsRef = useRef<Kinematics>(INITIAL_KINEMATICS);
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  return { kinematicsRef, meshRef, planetRadiiRef, planetActivationsRef };
};

export type { SceneRefs };
