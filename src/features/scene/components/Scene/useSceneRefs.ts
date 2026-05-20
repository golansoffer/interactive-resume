import type { RefObject } from 'react';
import { useRef } from 'react';
import type { Object3D } from 'three';
import type { CompanyId } from '../../types/company';
import type { Sphere } from '../../services/renderer/clampOutOfSphere';

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

// Single-sphere collider registry for the sun. `read` always returns a
// `Sphere` — the unmeasured case is folded into a degenerate radius-0
// sphere so callers never see undefined. `clampOutOfSphere` treats
// radius-0 as a no-op, so an unmeasured sun produces no clamp side-effect.
export type SunCollider = {
  readonly read: () => Sphere;
  readonly write: (sphere: Sphere) => void;
};

const EMPTY_SPHERE: Sphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };

const createSunCollider = (): SunCollider => {
  let current: Sphere = EMPTY_SPHERE;
  return {
    read: () => current,
    write: (sphere) => {
      current = sphere;
    },
  };
};

type SceneRefs = {
  readonly meshRef: RefObject<Object3D | null>;
  readonly planetRadiiRef: RefObject<PlanetRadii>;
  readonly planetActivationsRef: RefObject<PlanetActivations>;
  readonly sunColliderRef: RefObject<SunCollider>;
};

export const useSceneRefs = (): SceneRefs => {
  const meshRef = useRef<Object3D | null>(null);
  const planetRadiiRef = useRef<PlanetRadii>(createPlanetRadii());
  const planetActivationsRef = useRef<PlanetActivations>(createPlanetActivations());
  const sunColliderRef = useRef<SunCollider>(createSunCollider());
  return { meshRef, planetRadiiRef, planetActivationsRef, sunColliderRef };
};

export type { SceneRefs };
