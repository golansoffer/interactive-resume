import type { Sphere } from '../../types/sphere';
import type { SphereColliders } from '../../types/scene-refs';

export const createSphereColliders = (): SphereColliders => {
  const inner = new Map<string, Sphere>();
  return {
    register: (id, sphere) => {
      inner.set(id, sphere);
    },
    list: () => [...inner.values()],
  };
};
